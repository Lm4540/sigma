'use strict';

const { AuditLog } = require('../models');

/**
 * Registra una acción en AuditLogs de forma no bloqueante.
 * Los errores de auditoría nunca interrumpen el flujo principal.
 */
const log = ({ userId = null, action, entity = null, entityId = null, previousValue = null, newValue = null, ipAddress = null, userAgent = null }) => {
  AuditLog.create({ userId, action, entity, entityId, previousValue, newValue, ipAddress, userAgent })
    .catch(err => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AuditService] Error al registrar:', err.message);
      }
    });
};

module.exports = { log };
