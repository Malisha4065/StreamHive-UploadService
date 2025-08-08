const amqp = require('amqplib')
const logger = require('../utils/logger')

let connection = null
let channel = null

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL)
    channel = await connection.createChannel()

    // Create transcode queue
    const queueName = process.env.TRANSCODE_QUEUE || 'video_transcode_queue'
    await channel.assertQueue(queueName, {
      durable: true // Queue survives broker restarts
    })

    logger.info(`RabbitMQ connected and queue '${queueName}' ready`)

    // Handle connection events
    connection.on('error', (error) => {
      logger.error('RabbitMQ connection error:', error)
    })

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed')
    })

    return { connection, channel }
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error)
    throw error
  }
}

const publishToTranscodeQueue = async (message) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized')
    }

    const queueName = process.env.TRANSCODE_QUEUE || 'video_transcode_queue'
    const messageBuffer = Buffer.from(JSON.stringify(message))

    await channel.sendToQueue(queueName, messageBuffer, {
      persistent: true, // Message survives broker restarts
      timestamp: Date.now(),
      messageId: message.uploadId
    })

    logger.info(`Message published to transcode queue: ${message.uploadId}`)
  } catch (error) {
    logger.error('Failed to publish to transcode queue:', error)
    throw error
  }
}

const getRabbitMQChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized')
  }
  return channel
}

const closeRabbitMQ = async () => {
  try {
    if (channel) {
      await channel.close()
    }
    if (connection) {
      await connection.close()
    }
    logger.info('RabbitMQ connection closed')
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error)
  }
}

module.exports = {
  connectRabbitMQ,
  publishToTranscodeQueue,
  getRabbitMQChannel,
  closeRabbitMQ
}
