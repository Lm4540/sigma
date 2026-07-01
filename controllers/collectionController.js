'use strict';

const path = require('path');
const { CollectionLog, ClientAssignment, Client } = require('../models');
const auditService = require('../services/auditService');
const paymentService = require('../services/paymentService');

const create = async (req, res, next) => {
  try {
    const { userId, roleId } = req.user;
    const { clientId, type, comment, latitude, longitude, paymentAmount, paymentType } = req.body;

    // Verificar asignación activa
    const assignment = await ClientAssignment.findOne({ where: { clientId, userId, isActive: 1 } });
    if (!assignment) return res.status(403).json({ success: false, message: 'No tienes asignado este cliente' });

    let gpsAlertTriggered = 0;

    // GPS obligatorio para visitas
    if (type === 'Visita') {
      if (!latitude || !longitude) {
        return res.status(422).json({ success: false, message: 'La ubicación GPS es obligatoria para visitas' });
      }

      // Validar cercanía
      const client = await Client.findByPk(clientId, { attributes: ['addressLat', 'addressLng'] });
      if (client && client.addressLat != null && client.addressLng != null) {
        const gpsService = require('../services/gpsService');
        const distance = gpsService.calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(client.addressLat),
          parseFloat(client.addressLng)
        );
        const maxDistance = parseFloat(process.env.GPS_MAX_DISTANCE_KM || 0.1);
        if (distance > maxDistance) {
          gpsAlertTriggered = 1;
        }
      }
    }

    // Evidencia requerida para pagos
    if (paymentAmount && !req.file) {
      return res.status(422).json({ success: false, message: 'Se requiere foto de evidencia para registrar un pago' });
    }

    const evidenceUrl = req.file ? `/uploads/evidence/${req.file.filename}` : null;

    const log = await CollectionLog.create({
      clientId,
      userId,
      type,
      comment,
      evidenceUrl,
      latitude: latitude || null,
      longitude: longitude || null,
      gpsAlertTriggered,
      paymentAmount: paymentAmount || null,
      paymentType: paymentType || null,
      status: 'pendiente',
      createdBy: userId,
    });

    // Actualizar lastActivity del cliente
    await Client.update({ lastActivity: new Date() }, { where: { id: clientId } });

    const clientRecord = await Client.findByPk(clientId, { attributes: ['name', 'loanNumber'] });
    auditService.log({
      userId,
      action: 'collection.created',
      entity: 'CollectionLogs',
      entityId: log.id,
      newValue: {
        clientId,
        clientName: clientRecord ? clientRecord.name : null,
        loanNumber: clientRecord ? clientRecord.loanNumber : null,
        type,
        hasPayment: !!paymentAmount,
        paymentAmount: paymentAmount || null,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Si se activa alerta GPS, loguear auditoría específica
    if (gpsAlertTriggered === 1) {
      auditService.log({
        userId,
        action: 'gps.alert',
        entity: 'CollectionLogs',
        entityId: log.id,
        newValue: {
          clientId,
          clientName: clientRecord ? clientRecord.name : null,
          latitude,
          longitude,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    // Emitir evento Socket.io al dashboard
    const io = req.app.get('io');
    if (io) io.emit('collection:new', { logId: log.id, clientId, type, userId, gpsAlertTriggered });

    res.status(201).json({ success: true, message: 'Gestión registrada', data: { id: log.id } });
  } catch (err) {
    next(err);
  }
};

const authorizePayment = async (req, res, next) => {
  try {
    const { action } = req.body; // 'autorizar' | 'rechazar'
    const log = await paymentService.authorize({
      logId: parseInt(req.params.id),
      action,
      authorizedById: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ success: true, data: { status: log.status } });
  } catch (err) {
    next(err);
  }
};

const applyPayment = async (req, res, next) => {
  try {
    const log = await paymentService.apply({
      logId: parseInt(req.params.id),
      appliedById: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ success: true, data: { status: log.status } });
  } catch (err) {
    next(err);
  }
};

const pendingPayments = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const { sequelize } = require('../models');

    // Secretaria ve pagos autorizados pendientes de aplicar; admin/supervisor ven pendientes de autorizar
    const targetStatus = roleId === 4 ? 'autorizado' : 'pendiente';
    const branchFilter = roleId !== 1 ? 'AND c.branchId = :branchId' : '';
    const pageTitle    = roleId === 4 ? 'Pagos por Aplicar en ERP' : 'Pagos Pendientes de Autorización';

    const [rows] = await sequelize.query(`
      SELECT cl.id, cl.paymentAmount, cl.paymentType, cl.status, cl.createdAt,
             cl.evidenceUrl, c.name as clientName, c.loanNumber,
             u.name as gestorName
      FROM CollectionLogs cl
      JOIN Clients c ON cl.clientId = c.id
      JOIN Users u ON cl.userId = u.id
      WHERE cl.paymentAmount IS NOT NULL
        AND cl.status = :targetStatus
        ${branchFilter}
      ORDER BY cl.createdAt ASC
    `, { replacements: { targetStatus, branchId } });

    res.render('collections/pending', { title: pageTitle, user: req.user, payments: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, authorizePayment, applyPayment, pendingPayments };
