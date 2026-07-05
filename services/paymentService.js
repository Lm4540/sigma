'use strict';

const { CollectionLog, Client } = require('../models');
const auditService = require('./auditService');

/**
 * Revisa un pago (Jefe de Operaciones). Solo ejecutable desde pendiente.
 */
const review = async ({ logId, action, reviewedById, ipAddress, userAgent }) => {
  const log = await CollectionLog.findByPk(logId);
  if (!log) throw Object.assign(new Error('Gestión no encontrada'), { status: 404 });
  if (log.status !== 'pendiente') throw Object.assign(new Error('Solo se pueden revisar pagos en estado pendiente'), { status: 422 });

  const previousValue = { status: log.status };
  const newStatus = action === 'solicitar_autorizacion' ? 'revisado' : 'rechazado';

  const client = await Client.findByPk(log.clientId, { attributes: ['name'] });

  await log.update({
    status: newStatus,
    reviewedBy: reviewedById,
    reviewedAt: new Date(),
  });

  auditService.log({
    userId: reviewedById,
    action: newStatus === 'revisado' ? 'payment.reviewed' : 'payment.rejected',
    entity: 'CollectionLogs',
    entityId: logId,
    previousValue,
    newValue: { status: newStatus, clientName: client?.name || null, paymentAmount: log.paymentAmount },
    ipAddress,
    userAgent,
  });

  return log;
};

/**
 * Autoriza o rechaza un pago. Solo ejecutable desde revisado.
 */
const authorize = async ({ logId, action, authorizedById, ipAddress, userAgent }) => {
  const log = await CollectionLog.findByPk(logId);
  if (!log) throw Object.assign(new Error('Gestión no encontrada'), { status: 404 });
  if (log.status !== 'revisado') throw Object.assign(new Error('Solo se pueden autorizar pagos en estado revisado'), { status: 422 });

  const previousValue = { status: log.status };
  const newStatus = action === 'autorizar' ? 'autorizado' : 'rechazado';

  const client = await Client.findByPk(log.clientId, { attributes: ['name'] });

  await log.update({
    status: newStatus,
    authorizedBy: authorizedById,
    authorizedAt: new Date(),
  });

  auditService.log({
    userId: authorizedById,
    action: newStatus === 'autorizado' ? 'payment.authorized' : 'payment.rejected',
    entity: 'CollectionLogs',
    entityId: logId,
    previousValue,
    newValue: { status: newStatus, clientName: client?.name || null, paymentAmount: log.paymentAmount },
    ipAddress,
    userAgent,
  });

  return log;
};

/**
 * Marca un pago autorizado como aplicado en ERP.
 */
const apply = async ({ logId, appliedById, ipAddress, userAgent }) => {
  const log = await CollectionLog.findByPk(logId);
  if (!log) throw Object.assign(new Error('Gestión no encontrada'), { status: 404 });
  if (log.status !== 'autorizado') throw Object.assign(new Error('Solo se pueden aplicar pagos en estado autorizado'), { status: 422 });

  const previousValue = { status: log.status };
  const client = await Client.findByPk(log.clientId, { attributes: ['name'] });

  await log.update({
    status: 'aplicado',
    appliedBy: appliedById,
    appliedAt: new Date(),
  });

  auditService.log({
    userId: appliedById,
    action: 'payment.applied',
    entity: 'CollectionLogs',
    entityId: logId,
    previousValue,
    newValue: { status: 'aplicado', clientName: client?.name || null, paymentAmount: log.paymentAmount },
    ipAddress,
    userAgent,
  });

  return log;
};

module.exports = { review, authorize, apply };
