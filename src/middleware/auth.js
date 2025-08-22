const axios = require('axios')
const logger = require('../utils/logger')

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
    // Validate token with SecurityService
    const response = await axios.post(
      process.env.SECURITY_SERVICE_URL || 'http://security-service:8080/auth/validate',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    req.user = response.data.user
    next()
  } catch (err) {
    logger.warn(`Invalid token attempt from IP: ${req.ip}`)
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    })
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
