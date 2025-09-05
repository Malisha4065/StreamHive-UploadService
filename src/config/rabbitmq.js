const amqp = require('amqplib')
const logger = require('../utils/logger')
const { withRetry } = require('../lib/resilience')

let connection = null
let channel = null
let connecting = false
let reconnectTimer = null

const connectRabbitMQ = async () => {
  if (connecting) return { connection, channel }
  connecting = true
  try {
    const url = process.env.RABBITMQ_URL
    if (!url) throw new Error('RABBITMQ_URL not set')
    connection = await withRetry(() => amqp.connect(url), {
      retries: parseInt(process.env.AMQP_CONNECT_RETRIES || '5'),
      minTimeout: parseInt(process.env.AMQP_CONNECT_MIN || '500'),
      maxTimeout: parseInt(process.env.AMQP_CONNECT_MAX || '5000')
    })
    channel = await connection.createChannel()

    // Declare topic exchange for event routing
    const exchange = process.env.AMQP_EXCHANGE || 'streamhive'
    await channel.assertExchange(exchange, 'topic', { durable: true })

    // (Optional) declare upload queue for local diagnostics (transcoder will declare its own)
    const uploadRoutingKey = process.env.AMQP_UPLOAD_ROUTING_KEY || 'video.uploaded'
    logger.info(`RabbitMQ connected. Using exchange='${exchange}', routingKey='${uploadRoutingKey}'`)

    const scheduleReconnect = () => {
      if (reconnectTimer) return
      const backoff = parseInt(process.env.AMQP_RECONNECT_MS || '3000')
      reconnectTimer = setTimeout(async () => {
        reconnectTimer = null
        logger.info('Attempting RabbitMQ reconnect...')
        try {
          await connectRabbitMQ()
          logger.info('RabbitMQ reconnected')
        } catch (err) {
          logger.error('RabbitMQ reconnect failed:', err)
          scheduleReconnect()
        }
      }, backoff)
    }

    connection.on('error', (error) => {
      logger.error('RabbitMQ connection error:', error)
    })

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed')
      channel = null
      connection = null
      connecting = false
      scheduleReconnect()
    })

    return { connection, channel }
  } catch (error) {
    connecting = false
    logger.error('RabbitMQ connection failed:', error)
    throw error
  } finally {
    connecting = false
  }
}

const publishToTranscodeQueue = async (message) => {
  try {
    if (!channel) {
      // try to reconnect lazily
      await connectRabbitMQ()
    }
    if (!channel) throw new Error('RabbitMQ channel not initialized')

    const exchange = process.env.AMQP_EXCHANGE || 'streamhive'
    const uploadRoutingKey = process.env.AMQP_UPLOAD_ROUTING_KEY || 'video.uploaded'

    const payload = Buffer.from(JSON.stringify(message))

    const publishFn = () => new Promise((resolve, reject) => {
      try {
        const ok = channel.publish(exchange, uploadRoutingKey, payload, {
          contentType: 'application/json',
          persistent: true,
          timestamp: Date.now(),
          messageId: message.uploadId
        })
        // If internal buffer is full, wait for drain event
        if (!ok) {
          channel.once('drain', resolve)
        } else {
          resolve()
        }
      } catch (err) {
        reject(err)
      }
    })

    await withRetry(publishFn, {
      retries: parseInt(process.env.AMQP_PUBLISH_RETRIES || '3'),
      minTimeout: parseInt(process.env.AMQP_PUBLISH_MIN || '200'),
      maxTimeout: parseInt(process.env.AMQP_PUBLISH_MAX || '2000')
    })

    logger.info(`Published upload event: ${message.uploadId}`)
  } catch (error) {
    logger.error('Failed to publish upload event:', error)
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
    if (channel) await channel.close()
    if (connection) await connection.close()
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
