const logger = require('../utils/logger')
const { createFetchBreaker, withRetry } = require('../lib/resilience')

// Reuse a single circuit breaker instance for auth validation
const authBreaker = createFetchBreaker({
  timeout: parseInt(process.env.AUTH_TIMEOUT_MS || '3000'),
  errorThresholdPercentage: parseInt(process.env.AUTH_CB_ERROR_PCT || '50'),
  resetTimeout: parseInt(process.env.AUTH_CB_RESET_MS || '10000'),
  volumeThreshold: parseInt(process.env.AUTH_CB_VOLUME || '5')
})

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    })
  }

  try {
    // Define the URL for the security service
    const securityServiceUrl = process.env.SECURITY_SERVICE_URL || 'http://security-service:8080/auth/validate'

    const response = await withRetry(
      () => authBreaker.fire(securityServiceUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }),
      {
        retries: parseInt(process.env.AUTH_RETRIES || '2'),
        minTimeout: parseInt(process.env.AUTH_RETRY_MIN || '200'),
        maxTimeout: parseInt(process.env.AUTH_RETRY_MAX || '1000')
      }
    )

    if (!response.ok) {
      throw new Error(`Token validation failed with status: ${response.status}`)
    }

    const responseData = await response.json()
    req.user = responseData.user
    next()
  } catch (err) {
    // Network/timeout/circuit errors vs actual 4xx auth failures
    const msg = err?.message || ''
    if (/^HTTP 4\d\d/.test(msg)) {
      logger.warn(`Invalid token attempt from IP: ${req.ip} - ${msg}`)
      return res.status(403).json({ success: false, error: 'Invalid or expired token' })
    }

    logger.error(`Auth service unavailable for IP ${req.ip}: ${msg}`)
    return res.status(503).json({ success: false, error: 'Authentication service unavailable' })
  }
}

const authorizeUpload = (req, res, next) => {
  // Check if user has upload permissions
  if (!req.user || !req.user.permissions || !req.user.permissions.includes('upload')) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions for upload'
    })
  }

  next()
}

module.exports = {
  authenticateToken,
  authorizeUpload
}
