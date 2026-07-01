'use strict';

const { Op } = require('sequelize');
const { Client, ClientAssignment, ClientContact, CollectionLog, User, Task, LegalCase, sequelize } = require('../models');
const auditService = require('../services/auditService');
const XLSX = require('xlsx');

const index = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;
    const { q = '', page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    let where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { clientCode: { [Op.like]: `%${q}%` } },
        { loanNumber: { [Op.like]: `%${q}%` } },
      ];
    }

    // Gestores: solo ven clientes asignados
    let clientIds = null;
    if (roleId === 3) {
      const assignments = await ClientAssignment.findAll({
        where: { userId, isActive: 1 },
        attributes: ['clientId'],
      });
      clientIds = assignments.map(a => a.clientId);
      where.id = { [Op.in]: clientIds.length ? clientIds : [0] };
    } else if (roleId !== 1) {
      where.branchId = branchId;
    }

    const { rows: clients, count } = await Client.findAndCountAll({
      where,
      limit,
      offset,
      order: [['daysLate', 'DESC']],
      attributes: { include: ['riskCategory'] },
    });

    res.render('clients/index', {
      title: 'Clientes',
      user: req.user,
      clients,
      q,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      total: count,
    });
  } catch (err) {
    next(err);
  }
};

const show = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;
    const client = await Client.findByPk(req.params.id, {
      attributes: { include: ['riskCategory'] },
    });
    if (!client) return res.status(404).render('error', { title: 'No encontrado', message: 'Cliente no encontrado', status: 404, user: req.user });

    // Acceso restringido para gestores
    if (roleId === 3) {
      const assignment = await ClientAssignment.findOne({ where: { clientId: client.id, userId, isActive: 1 } });
      if (!assignment) return res.status(403).render('error', { title: 'Sin acceso', message: 'No tienes asignado este cliente', status: 403, user: req.user });
    } else if (roleId !== 1 && client.branchId !== branchId) {
      return res.status(403).render('error', { title: 'Sin acceso', message: 'Cliente de otra sucursal', status: 403, user: req.user });
    }

    const [logs, contacts, activeAssignment, clientTasks, taskUsers, legalCase] = await Promise.all([
      CollectionLog.findAll({
        where: { clientId: client.id },
        include: [{ model: User, as: 'gestor', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
        limit: 50,
      }),
      ClientContact.findAll({ where: { clientId: client.id } }),
      ClientAssignment.findOne({
        where: { clientId: client.id, isActive: 1 },
        include: [{ model: User, as: 'gestor', attributes: ['id', 'name'] }],
      }),
      Task.findAll({
        where: { clientId: client.id },
        include: [{ model: User, attributes: ['id', 'name'] }],
        order: [['dueDate', 'ASC']],
        limit: 10,
      }),
      roleId !== 3
        ? User.findAll({ where: { status: 'on' }, attributes: ['id', 'name'], order: [['name', 'ASC']] })
        : Promise.resolve([]),
      LegalCase.findOne({ where: { clientId: client.id, status: 'activo' } }),
    ]);

    res.render('clients/show', {
      title: client.name,
      user: req.user,
      client,
      logs,
      contacts,
      activeAssignment,
      clientTasks,
      taskUsers,
      legalCase,
    });
  } catch (err) {
    next(err);
  }
};

const importData = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

    const { userId, branchId } = req.user;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let created = 0, updated = 0;

    for (const row of rows) {
      const clientCode = row['clientCode'] || row['Código'] || null;
      const loanNumber  = row['loanNumber']  || row['Préstamo'] || null;

      if (!clientCode && !loanNumber) continue;

      const existing = await Client.findOne({
        where: clientCode ? { clientCode } : { loanNumber },
      });

      const updateData = {
        balance:         parseFloat(row['balance'] || row['Saldo'] || 0),
        insurance:       parseFloat(row['insurance'] || row['Seguro'] || 0),
        otherFees:       parseFloat(row['otherFees'] || row['OtrosCargos'] || 0),
        daysLate:        parseInt(row['daysLate'] || row['DiasMora'] || 0),
        nextPaymentDate: row['nextPaymentDate'] || row['ProximoPago'] || null,
      };

      if (existing) {
        await existing.update(updateData);
        updated++;
      } else {
        await Client.create({
          clientCode,
          loanNumber,
          name: row['name'] || row['Nombre'] || 'Sin nombre',
          address: row['address'] || row['Dirección'] || null,
          branchId,
          ...updateData,
          createdBy: null,
        });
        created++;
      }
    }

    auditService.log({
      userId,
      action: 'import.executed',
      entity: 'Clients',
      newValue: { created, updated, total: rows.length },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: `Importación completada: ${created} creados, ${updated} actualizados` });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { userId, branchId } = req.user;
    const { name, clientCode, loanNumber, address, daysLate, balance, insurance, otherFees, nextPaymentDate } = req.body;

    const client = await Client.create({
      name: name.trim(),
      clientCode:      clientCode      ? clientCode.trim()      : null,
      loanNumber:      loanNumber      ? loanNumber.trim()      : null,
      address:         address         ? address.trim()         : null,
      daysLate:        parseInt(daysLate)   || 0,
      balance:         parseFloat(balance)  || 0,
      insurance:       parseFloat(insurance)|| 0,
      otherFees:       parseFloat(otherFees)|| 0,
      nextPaymentDate: nextPaymentDate || null,
      branchId,
      createdBy: userId,
    });

    auditService.log({
      userId,
      action: 'client.created',
      entity: 'Clients',
      entityId: client.id,
      newValue: { name: client.name, clientCode: client.clientCode, loanNumber: client.loanNumber },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ success: true, data: { id: client.id } });
  } catch (err) {
    // Error de unicidad (clientCode / loanNumber duplicado)
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'El código de cliente o número de préstamo ya existe' });
    }
    next(err);
  }
};

const createContact = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

    // Verificar acceso por sucursal/asignación
    if (roleId === 3) {
      const assignment = await ClientAssignment.findOne({ where: { clientId: client.id, userId, isActive: 1 } });
      if (!assignment) return res.status(403).json({ success: false, message: 'No tienes asignado este cliente' });
    } else if (roleId !== 1 && client.branchId !== branchId) {
      return res.status(403).json({ success: false, message: 'Cliente de otra sucursal' });
    }

    const { phone, name, relationship } = req.body;
    const contact = await ClientContact.create({
      clientId: client.id,
      phone: phone.trim(),
      name: name ? name.trim() : null,
      relationship: relationship ? relationship.trim() : null,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: { id: contact.id, phone: contact.phone, name: contact.name, relationship: contact.relationship } });
  } catch (err) { next(err); }
};

const deleteContact = async (req, res, next) => {
  try {
    const { roleId } = req.user;
    // Solo administradores pueden eliminar contactos
    if (roleId !== 1) return res.status(403).json({ success: false, message: 'Solo el administrador puede eliminar contactos' });

    const contact = await ClientContact.findByPk(req.params.cid);
    if (!contact || contact.clientId !== parseInt(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Contacto no encontrado' });
    }

    await contact.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { index, show, importData, create, createContact, deleteContact };
