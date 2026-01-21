const rateLimit = require('express-rate-limit');

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 accounts per IP per hour (increased for testing)
  message: {
    status: 'error',
    message: 'Too many accounts created from this IP, please try again after an hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 login attempts per IP per 15 minutes (increased for testing)
  message: {
    status: 'error', 
    message: 'Too many login attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per IP per minute
  message: {
    status: 'error',
    message: 'Too many requests from this IP'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  createAccountLimiter,
  loginLimiter,
  generalLimiter
};