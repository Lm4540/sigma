'use strict';

const { ClientAssignment, sequelize } = require('../models');
const auditService = require('./auditService');

/**
 * Asigna un cliente a un gestor.
 * Cierra la asignación activa anterior si existe.
 */
const assign = async ({ clientId, userId, assignedBy, ipAddress, userAgent }) => {
  const t = await sequelize.transaction();
  try {
    // Cerrar asignación activa anterior
    const previous = await ClientAssignment.findOne({
      where: { clientId, isActive: 1 },
      transaction: t,
    });

    if (previous) {
      await previous.update({ isActive: 0, releasedAt: new Date() }, { transaction: t });
      auditService.log({
        userId: assignedBy,
        action: 'assignment.released',
        entity: 'ClientAssignments',
        entityId: previous.id,
        previousValue: { userId: previous.userId, isActive: 1 },
        newValue: { isActive: 0 },
        ipAddress,
        userAgent,
      });
    }

    // Crear nueva asignación
    const newAssignment = await ClientAssignment.create(
      { clientId, userId, assignedBy, isActive: 1 },
      { transaction: t }
    );

    await t.commit();

    auditService.log({
      userId: assignedBy,
      action: 'assignment.created',
      entity: 'ClientAssignments',
      entityId: newAssignment.id,
      newValue: { clientId, userId },
      ipAddress,
      userAgent,
    });

    return newAssignment;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { assign };
