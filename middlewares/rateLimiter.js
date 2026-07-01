'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const general = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 100,
  keyGenerator: (req) => ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Demasiadas peticiones, intente más tarde' }),
});

const sensitive = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max:      parseInt(process.env.RATE_LIMIT_SENSITIVE_MAX) || 20,
  // Usar userId cuando está autenticado para que cada gestor tenga su propio bucket
  keyGenerator: (req) => req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429)
    .set('Retry-After', Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000))
    .json({ success: false, message: 'Límite de peticiones alcanzado' }),
});

module.exports = { general, sensitive };
