const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob')
const logger = require('../utils/logger')
const fs = require('fs')

let blobServiceClient = null

// Helper function to read secret from file or fallback to environment variable
const getSecret = (filePath, envVar) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim()
    }
  } catch (error) {
    logger.warn(`Failed to read secret from file ${filePath}: ${error.message}`)
  }
  return process.env[envVar]
}

// Sanitize metadata to conform to Azure rules:
// - Keys must start with a letter or underscore; subsequent chars letters, numbers, or underscores
// - Keys/values must be ASCII
const sanitizeAzureMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return {}
  const sanitized = {}
  for (const [rawKey, rawVal] of Object.entries(metadata)) {
    if (rawVal === undefined || rawVal === null) continue
    let key = String(rawKey)
      .replace(/[^A-Za-z0-9_]/g, '_') // replace invalid chars with underscore
      .replace(/_+/g, '_') // collapse multiple underscores
    if (!/^[A-Za-z_]/.test(key)) {
      key = `_${key}`
    }
    // Ensure value is ASCII and avoid control characters
    const val = String(rawVal)
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
    sanitized[key] = val
  }
  return sanitized
}

const connectAzureBlob = async () => {
  try {
    const accountName = getSecret('/mnt/secrets-store/azure-storage-account', 'AZURE_STORAGE_ACCOUNT_NAME')
    const accountKey = getSecret('/mnt/secrets-store/azure-storage-key', 'AZURE_STORAGE_ACCOUNT_KEY')
    const connectionString = getSecret('/mnt/secrets-store/azure-storage-connection-string', 'AZURE_STORAGE_CONNECTION_STRING')
    
    if (connectionString) {
      // Use connection string if provided
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    } else if (accountName && accountKey) {
      // Use account name and key
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey)
      blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
      )
    } else {
      throw new Error('Azure Storage credentials not provided. Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY')
    }

    // Check if containers exist, create if not
    const rawContainer = getSecret('/mnt/secrets-store/azure-storage-raw-container', 'AZURE_STORAGE_RAW_CONTAINER') || 'streamhive-raw-videos'
    const processedContainer = getSecret('/mnt/secrets-store/azure-storage-processed-container', 'AZURE_STORAGE_PROCESSED_CONTAINER') || 'streamhive-processed-videos'
    
    const rawContainerClient = blobServiceClient.getContainerClient(rawContainer)
    const processedContainerClient = blobServiceClient.getContainerClient(processedContainer)
    
    // Create containers if they don't exist
    try {
      await rawContainerClient.createIfNotExists({
        access: 'blob', // Private container
        metadata: sanitizeAzureMetadata({
          purpose: 'Raw video uploads',
          service: 'streamhive-upload'
        })
      })
      logger.info(`Raw container ready: ${rawContainer}`)
    } catch (error) {
      if (error.statusCode !== 409) { // 409 = container already exists
        throw error
      }
    }

    try {
      await processedContainerClient.createIfNotExists({
        access: 'blob', // Public read access for processed videos
        metadata: sanitizeAzureMetadata({
          purpose: 'Processed video files',
          service: 'streamhive-transcode'
        })
      })
      logger.info(`Processed container ready: ${processedContainer}`)
    } catch (error) {
      if (error.statusCode !== 409) {
        throw error
      }
    }

    logger.info('Azure Blob Storage connection established')
    return blobServiceClient
  } catch (error) {
    logger.error('Azure Blob Storage connection failed:', error)
    throw error
  }
}

const getBlobServiceClient = () => {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage client not initialized')
  }
  return blobServiceClient
}

const uploadBlob = async (containerName, blobName, data, options = {}) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    const uploadOptions = {
      ...options,
      blobHTTPHeaders: {
        blobContentType: options.contentType || 'application/octet-stream'
      },
      metadata: sanitizeAzureMetadata(options.metadata || {}),
      tags: options.tags || {}
    }

    const uploadResponse = await blockBlobClient.upload(data, data.length, uploadOptions)
    
    logger.info(`Blob uploaded successfully: ${blobName}`)
    return {
      url: blockBlobClient.url,
      etag: uploadResponse.etag,
      lastModified: uploadResponse.lastModified,
      requestId: uploadResponse.requestId
    }
  } catch (error) {
    logger.error(`Failed to upload blob ${blobName}:`, error)
    throw error
  }
}

const generateSASUrl = (containerName, blobName, permissions = 'r', expiryHours = 24) => {
  try {
    const accountName = getSecret('/mnt/secrets-store/azure-storage-account', 'AZURE_STORAGE_ACCOUNT_NAME')
    const accountKey = getSecret('/mnt/secrets-store/azure-storage-key', 'AZURE_STORAGE_ACCOUNT_KEY')

    if (!accountName || !accountKey) {
      throw new Error('Account name and key required for SAS generation')
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey)
    
    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse(permissions),
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + expiryHours * 60 * 60 * 1000),
      protocol: 'HttpsOnly'
    }

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString()
    const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`

    return sasUrl
  } catch (error) {
    logger.error('Failed to generate SAS URL:', error)
    throw error
  }
}

const deleteBlob = async (containerName, blobName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.deleteIfExists()
    logger.info(`Blob deleted: ${blobName}`)
  } catch (error) {
    logger.error(`Failed to delete blob ${blobName}:`, error)
    throw error
  }
}

const getBlobMetadata = async (containerName, blobName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    const properties = await blockBlobClient.getProperties()
    return {
      size: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
      etag: properties.etag,
      metadata: properties.metadata,
      tags: properties.tagCount > 0 ? await blockBlobClient.getTags() : {}
    }
  } catch (error) {
    logger.error(`Failed to get blob metadata ${blobName}:`, error)
    throw error
  }
}

module.exports = {
  connectAzureBlob,
  getBlobServiceClient,
  uploadBlob,
  generateSASUrl,
  deleteBlob,
  getBlobMetadata
}
