import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes
 * 10 requests per minute
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: 'Too many authentication requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for trading routes
 * 30 requests per minute
 */
export const tradingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message: 'Too many trading requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

