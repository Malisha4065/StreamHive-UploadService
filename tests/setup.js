// Test setup file
require('dotenv').config({ path: '.env.test' })

// Mock external dependencies for tests
jest.mock('../src/config/azureBlob', () => ({
  connectAzureBlob: jest.fn(),
  getBlobServiceClient: jest.fn(() => ({
    getContainerClient: jest.fn(() => ({
      getProperties: jest.fn(),
      createIfNotExists: jest.fn(),
      getBlockBlobClient: jest.fn(() => ({
        upload: jest.fn(() => ({
          url: 'https://test.blob.core.windows.net/container/blob',
          etag: 'test-etag',
          lastModified: new Date(),
          requestId: 'test-request-id'
        }))
      }))
    }))
  })),
  uploadBlob: jest.fn(() => ({
    url: 'https://test.blob.core.windows.net/container/blob',
    etag: 'test-etag',
    lastModified: new Date(),
    requestId: 'test-request-id'
  }))
}))

jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn(),
  publishToTranscodeQueue: jest.fn(),
  getRabbitMQChannel: jest.fn(() => ({
    checkQueue: jest.fn()
  }))
}))
