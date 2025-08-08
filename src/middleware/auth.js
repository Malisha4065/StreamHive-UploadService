const jwt = require('jsonwebtoken')
const logger = require('../utils/logger')

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`Invalid token attempt from IP: ${req.ip}`)
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      })
    }

    req.user = user
    next()
  })
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
