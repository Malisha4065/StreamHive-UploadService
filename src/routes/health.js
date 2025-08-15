const express = require('express')
const { getBlobServiceClient } = require('../config/azureBlob')
const { getRabbitMQChannel } = require('../config/rabbitmq')
const logger = require('../utils/logger')
const fs = require('fs')

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

const router = express.Router()

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'streamhive-upload-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    dependencies: {}
  }

  // Check Azure Blob Storage connection
  try {
    const blobServiceClient = getBlobServiceClient()
    const containerName = getSecret('/mnt/secrets-store/azure-storage-raw-container', 'AZURE_STORAGE_RAW_CONTAINER') || 'streamhive-raw-videos'
    const containerClient = blobServiceClient.getContainerClient(containerName)
    await containerClient.getProperties()
    health.dependencies.azureBlob = 'healthy'
  } catch (error) {
    health.dependencies.azureBlob = 'unhealthy'
    health.status = 'degraded'
    logger.warn('Azure Blob Storage health check failed:', error.message)
  }

  // Check RabbitMQ connection
  try {
    const channel = getRabbitMQChannel()
    await channel.checkQueue(process.env.TRANSCODE_QUEUE || 'video_transcode_queue')
    health.dependencies.rabbitmq = 'healthy'
  } catch (error) {
    health.dependencies.rabbitmq = 'unhealthy'
    health.status = 'degraded'
    logger.warn('RabbitMQ health check failed:', error.message)
  }

  // Check memory usage
  const memUsage = process.memoryUsage()
  health.memory = {
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
  }

  const statusCode = health.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(health)
})

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check if all dependencies are ready
    const blobServiceClient = getBlobServiceClient()
    const containerName = getSecret('/mnt/secrets-store/azure-storage-raw-container', 'AZURE_STORAGE_RAW_CONTAINER') || 'streamhive-raw-videos'
    const containerClient = blobServiceClient.getContainerClient(containerName)
    await containerClient.getProperties()
    
    const channel = getRabbitMQChannel()
    await channel.checkQueue(process.env.TRANSCODE_QUEUE || 'video_transcode_queue')

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// Liveness probe
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

module.exports = router
