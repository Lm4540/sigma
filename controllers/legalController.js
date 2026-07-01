'use strict';

const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const { LegalCase, LegalDocument, Client, User, Task, ClientContact, sequelize } = require('../models');
const auditService = require('../services/auditService');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'legal');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ── Lista de procesos legales ─────────────────────────────── */
const index = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const { status = '' } = req.query;

    const where = {};
    if (status) where.status = status;

    const cases = await LegalCase.findAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'clientCode', 'loanNumber', 'riskCategory', 'daysLate', 'balance', 'branchId'],
          where: roleId !== 1 ? { branchId } : undefined,
          required: true,
        },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
      ],
      order: [['openedAt', 'DESC']],
    });

    const users = await User.findAll({
      where: { status: 'on', roleId: [1, 2] },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    res.render('legal/index', { title: 'Procesos Legales', user: req.user, cases, users, filters: { status } });
  } catch (err) { next(err); }
};

/* ── Detalle de un proceso legal ───────────────────────────── */
const show = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const legalCase = await LegalCase.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client', attributes: { include: ['riskCategory'] } },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
        { model: LegalDocument, as: 'documents', include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }], order: [['createdAt', 'DESC']] },
      ],
    });

    if (!legalCase) return res.status(404).render('error', { title: 'No encontrado', message: 'Caso no encontrado', status: 404, user: req.user });

    // Acceso por sucursal para supervisores
    if (roleId !== 1 && legalCase.client.branchId !== branchId) {
      return res.status(403).render('error', { title: 'Sin acceso', message: 'Caso de otra sucursal', status: 403, user: req.user });
    }

    const [contacts, tasks, taskUsers] = await Promise.all([
      ClientContact.findAll({ where: { clientId: legalCase.clientId } }),
      Task.findAll({
        where: { clientId: legalCase.clientId },
        include: [{ model: User, attributes: ['id', 'name'] }],
        order: [['dueDate', 'ASC']],
      }),
      User.findAll({ where: { status: 'on' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    ]);

    res.render('legal/show', {
      title: `Proceso Legal — ${legalCase.client.name}`,
      user: req.user,
      legalCase,
      contacts,
      tasks,
      taskUsers,
    });
  } catch (err) { next(err); }
};

/* ── Abrir proceso legal para un cliente ───────────────────── */
const create = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;
    const { clientId, assignedTo, notes } = req.body;

    const client = await Client.findByPk(clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    if (roleId !== 1 && client.branchId !== branchId) {
      return res.status(403).json({ success: false, message: 'Cliente de otra sucursal' });
    }

    // Solo un proceso activo por cliente
    const existing = await LegalCase.findOne({ where: { clientId, status: 'activo' } });
    if (existing) return res.status(409).json({ success: false, message: 'Este cliente ya tiene un proceso legal activo' });

    const legalCase = await LegalCase.create({
      clientId,
      status: 'activo',
      assignedTo: assignedTo || null,
      openedAt: new Date(),
      notes: notes || null,
      createdBy: userId,
    });

    auditService.log({
      userId,
      action: 'legal.case_opened',
      entity: 'LegalCases',
      entityId: legalCase.id,
      newValue: { clientId, clientName: client.name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ success: true, data: { id: legalCase.id } });
  } catch (err) { next(err); }
};

/* ── Actualizar caso (notas, estado, responsable) ───────────── */
const update = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;
    const legalCase = await LegalCase.findByPk(req.params.id, {
      include: [{ model: Client, as: 'client', attributes: ['name', 'branchId'] }],
    });
    if (!legalCase) return res.status(404).json({ success: false, message: 'Caso no encontrado' });

    // Verificar acceso por sucursal
    if (roleId !== 1 && legalCase.client.branchId !== branchId) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este proceso legal' });
    }

    const { status, assignedTo, notes } = req.body;
    const updateData = {};
    if (notes    !== undefined) updateData.notes      = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (status   !== undefined) {
      updateData.status = status;
      if (status !== 'activo') updateData.closedAt = new Date();
    }

    await legalCase.update(updateData);

    if (status && status !== 'activo') {
      auditService.log({
        userId,
        action: 'legal.case_closed',
        entity: 'LegalCases',
        entityId: legalCase.id,
        newValue: { status, clientName: legalCase.client ? legalCase.client.name : null },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
};

// Extensiones permitidas para documentos legales
const ALLOWED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.txt'];

/* ── Subir documento ───────────────────────────────────────── */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

    // Validar tipo de archivo
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_DOC_EXTS.includes(ext)) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({ success: false, message: 'Tipo de archivo no permitido. Use: PDF, Word, Excel, imagen o texto.' });
    }

    const { userId, roleId, branchId } = req.user;
    const legalCase = await LegalCase.findByPk(req.params.id, {
      include: [{ model: Client, as: 'client', attributes: ['id', 'name', 'branchId'] }],
    });
    if (!legalCase) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Caso no encontrado' });
    }

    // Verificar acceso por sucursal
    if (roleId !== 1 && legalCase.client.branchId !== branchId) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: 'Sin acceso a este proceso legal' });
    }

    const { type = 'otro', description = '' } = req.body;
    const storedName   = `${uuidv4()}${ext}`;
    const destPath     = path.join(UPLOAD_DIR, storedName);

    fs.renameSync(req.file.path, destPath);

    const doc = await LegalDocument.create({
      caseId:       legalCase.id,
      clientId:     legalCase.clientId,
      type,
      originalName: req.file.originalname,
      storedName,
      url:          `/uploads/legal/${storedName}`,
      description:  description || null,
      uploadedBy:   userId,
      createdBy:    userId,
    });

    auditService.log({
      userId,
      action: 'legal.document_uploaded',
      entity: 'LegalDocuments',
      entityId: doc.id,
      newValue: { caseId: legalCase.id, clientName: legalCase.client ? legalCase.client.name : null, originalName: req.file.originalname, type },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ success: true, data: { id: doc.id, url: doc.url, originalName: doc.originalName } });
  } catch (err) { next(err); }
};

/* ── Eliminar documento ────────────────────────────────────── */
const deleteDocument = async (req, res, next) => {
  try {
    // Solo administradores pueden eliminar documentos legales
    if (req.user.roleId !== 1) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede eliminar documentos' });
    }

    const doc = await LegalDocument.findByPk(req.params.docId);
    // Verificar que el documento pertenece al caso indicado en la URL
    if (!doc || doc.caseId !== parseInt(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    // Borrar archivo físico
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await doc.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { index, show, create, update, uploadDocument, deleteDocument };
