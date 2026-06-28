const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Get rate limits from environment variables or use defaults
const STRICT_LIMIT = parseInt(process.env.RATE_LIMIT_STRICT) || 10;    // 10 requests
const STRICT_WINDOW = parseInt(process.env.RATE_LIMIT_STRICT_WINDOW) || 60; // per minute
const STANDARD_LIMIT = parseInt(process.env.RATE_LIMIT_STANDARD) || 60; // 60 requests
const STANDARD_WINDOW = parseInt(process.env.RATE_LIMIT_STANDARD_WINDOW) || 60; // per minute

/**
 * Strict rate limiter for sensitive endpoints (loan/repay)
 * 10 requests per minute per IP
 */
const strictLimiter = rateLimit({
  windowMs: STRICT_WINDOW * 1000, // Convert to milliseconds
  max: STRICT_LIMIT,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(STRICT_WINDOW / 60), // Minutes
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit for this endpoint.',
      retryAfter: Math.ceil(options.windowMs / 60000),
      limit: options.max,
      current: req.rateLimit?.current || 0,
    });
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
  },
});

/**
 * Standard rate limiter for read-only endpoints
 * 60 requests per minute per IP
 */
const standardLimiter = rateLimit({
  windowMs: STANDARD_WINDOW * 1000,
  max: STANDARD_LIMIT,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please slow down.',
    retryAfter: Math.ceil(STANDARD_WINDOW / 60),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit for this endpoint.',
      retryAfter: Math.ceil(options.windowMs / 60000),
      limit: options.max,
      current: req.rateLimit?.current || 0,
    });
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
  },
});

/**
 * Slow down middleware for gradual throttling
 * Slows down responses when approaching limit
 */
const speedLimiter = slowDown({
  windowMs: STANDARD_WINDOW * 1000,
  delayAfter: Math.floor(STANDARD_LIMIT * 0.7), // Start slowing at 70%
  delayMs: 500, // Add 500ms delay per request
  maxDelayMs: 5000, // Max 5 seconds delay
});

// Export limiters
module.exports = {
  strictLimiter,
  standardLimiter,
  speedLimiter,
};
