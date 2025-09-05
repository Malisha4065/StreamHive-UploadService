const fetch = global.fetch || require('node-fetch')
const CircuitBreaker = require('opossum')

// Generic timeout wrapper for promises
function withTimeout (promise, ms, errMsg = 'Operation timed out') {
  let to
  const timeout = new Promise((resolve, reject) => { to = setTimeout(() => reject(new Error(errMsg)), ms) })
  return Promise.race([promise.finally(() => clearTimeout(to)), timeout])
}

// Create a circuit breaker for HTTP fetch
function createFetchBreaker (options = {}) {
  const {
    timeout = 3000,
    errorThresholdPercentage = 50,
    resetTimeout = 10000,
    volumeThreshold = 5
  } = options

  const exec = async (url, init = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  const breaker = new CircuitBreaker(exec, {
    timeout: timeout + 500, // opossum internal timeout
    errorThresholdPercentage,
    resetTimeout,
    volumeThreshold
  })

  return breaker
}

// Retry helper around a function returning a promise (exponential backoff)
async function withRetry (fn, opts = {}) {
  const {
    retries = 3,
    minTimeout = 300,
    maxTimeout = 1500,
    factor = 2
  } = opts

  let attempt = 0
  let delay = minTimeout
  let lastErr
  while (attempt <= retries) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === retries) break
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, maxTimeout)))
      delay = Math.min(delay * factor, maxTimeout)
      attempt += 1
    }
  }
  throw lastErr
}

module.exports = {
  withTimeout,
  withRetry,
  createFetchBreaker
}
