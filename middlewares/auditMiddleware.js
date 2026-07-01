'use strict';

const auditService = require('../services/auditService');

/**
 * Middleware para auditar accesos denegados a nivel de ruta.
 * Usar en rutas protegidas antes del controlador.
 */
const auditAccess = (action) => (req, res, next) => {
  auditService.log({
    userId: req.user?.userId || null,
    action,
    entity: req.baseUrl,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
};

module.exports = { auditAccess };
