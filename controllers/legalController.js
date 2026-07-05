'use strict';

const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const { LegalCase, LegalDocument, Client, User, Task, ClientContact, CollectionLog, sequelize } = require('../models');
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

/* ── Generar reporte de expediente legal en PDF ───────────────────────────── */
const exportReportPdf = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const caseId = parseInt(req.params.id);

    const legalCase = await LegalCase.findByPk(caseId, {
      include: [
        { model: Client, as: 'client' },
        { model: User, as: 'assignee', attributes: ['id', 'name'] },
        { model: LegalDocument, as: 'documents', include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }], order: [['createdAt', 'DESC']] },
      ],
    });

    if (!legalCase) {
      return res.status(404).render('error', { title: 'No encontrado', message: 'Caso no encontrado', status: 404, user: req.user });
    }

    // Acceso por sucursal para supervisores
    if (roleId !== 1 && legalCase.client.branchId !== branchId) {
      return res.status(403).render('error', { title: 'Sin acceso', message: 'Caso de otra sucursal', status: 403, user: req.user });
    }

    const [contacts, tasks, collectionLogs] = await Promise.all([
      ClientContact.findAll({ where: { clientId: legalCase.clientId } }),
      Task.findAll({
        where: { clientId: legalCase.clientId },
        include: [{ model: User, attributes: ['id', 'name'] }],
        order: [['dueDate', 'ASC']],
      }),
      CollectionLog.findAll({
        where: { clientId: legalCase.clientId },
        include: [{ model: User, as: 'gestor', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const wkhtmltopdf = require('wkhtmltopdf');
    if (process.env.WKHTMLTOPDF_PATH) {
      wkhtmltopdf.command = process.env.WKHTMLTOPDF_PATH
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/\\\\/g, '\\');
    }

    const fmt = (n) => n != null ? parseFloat(n).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '—';
    const fmtDT   = (d) => d ? new Date(d).toLocaleString('es-SV')     : '—';

    const STATUS_LABEL = { activo: 'Activo', resuelto: 'Resuelto', archivado: 'Archivado' };
    const DOC_TYPE_LABEL = { demanda: 'Demanda', notificacion: 'Notificación', resolucion: 'Resolución judicial', contrato: 'Contrato', poder: 'Poder notarial', resumen: 'Resumen / notas',  otro: 'Otro' };
    const TASK_STATUS_LABEL = { pendiente: 'Pendiente', completada: 'Completada', vencida: 'Vencida' };
    const PRIORITY_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
    const PAY_TYPE_LABEL = { efectivo: 'Efectivo', nota_abono: 'Nota de Abono', especie: 'Especie', cheque: 'Cheque', transferencia: 'Transferencia' };

    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1f2e; padding: 32px; background: #fff; }
  h1 { font-size: 18px; font-weight: 700; color: #1a2744; margin-bottom: 4px; }
  h2 { font-size: 12px; font-weight: 700; color: #1a2744; margin-top: 20px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #1a2744; page-break-after: avoid; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .header-right { text-align: right; font-size: 9px; color: #7a8099; }
  .grid-2 { display: flex; gap: 16px; margin-bottom: 16px; }
  .card-half { flex: 1; border: 1px solid rgba(26, 39, 68, 0.10); padding: 12px; background: #f8f6f3; }
  .field { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .field-label { color: #7a8099; font-weight: 500; }
  .field-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0ede8; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f6f3; }
  .right { text-align: right; }
  .mono { font-family: Courier, monospace; }
  .comment { color: #555; font-style: italic; margin-top: 3px; font-size: 9px; }
  .footer { margin-top: 32px; border-top: 1px solid #e0ddd8; padding-top: 10px; font-size: 8px; color: #b0b5c8; text-align: center; }
  .notes-box { border: 1px solid rgba(26, 39, 68, 0.10); padding: 10px; background: #fcfcfc; white-space: pre-wrap; font-size: 9px; color: #2e354f; }
  .page-break { page-break-before: always; }
</style>
</head><body>
<div class="header">
  <div>
    <h1>SIGMA — Expediente Resumen Judicial</h1>
    <div style="color:#7a8099;font-size:10px;margin-top:2px">Cliente: ${legalCase.client.name}</div>
  </div>
  <div class="header-right">
    Generado: ${new Date().toLocaleString('es-SV')}<br>
    SIGMA v2 · Departamento Legal
  </div>
</div>

<h2>Detalles del Expediente</h2>
<div class="grid-2">
  <div class="card-half">
    <div class="field"><span class="field-label">Estado:</span><span class="field-value">${STATUS_LABEL[legalCase.status] || legalCase.status}</span></div>
    <div class="field"><span class="field-label">Fecha Apertura:</span><span class="field-value">${fmtDate(legalCase.openedAt)}</span></div>
    <div class="field"><span class="field-label">Responsable:</span><span class="field-value">${legalCase.assignee ? legalCase.assignee.name : 'Sin asignar'}</span></div>
  </div>
  <div class="card-half">
    <div class="field"><span class="field-label">Código Cliente:</span><span class="field-value mono">${legalCase.client.clientCode || '—'}</span></div>
    <div class="field"><span class="field-label">Nº Préstamo:</span><span class="field-value mono">${legalCase.client.loanNumber || '—'}</span></div>
    <div class="field"><span class="field-label">Deuda Total:</span><span class="field-value mono" style="color:#7f1d1d">$ ${fmt(parseFloat(legalCase.client.balance || 0) + parseFloat(legalCase.client.insurance || 0) + parseFloat(legalCase.client.otherFees || 0))}</span></div>
  </div>
</div>

${legalCase.notes ? `
  <div style="margin-bottom:16px">
    <div style="font-weight:600;font-size:9px;color:#7a8099;margin-bottom:4px;text-transform:uppercase">Notas del caso:</div>
    <div class="notes-box">${legalCase.notes}</div>
  </div>
` : ''}

<h2>Procedimientos y Gestiones Realizadas (Historial de Cobro)</h2>
<table>
  <thead>
    <tr>
      <th style="width:110px">Fecha</th>
      <th style="width:70px">Tipo</th>
      <th>Gestor / Comentario</th>
      <th class="right" style="width:90px">Monto</th>
      <th style="width:80px">Estado Pago</th>
    </tr>
  </thead>
  <tbody>
    ${collectionLogs.length === 0 ? '<tr><td colspan="5" style="text-align:center" class="text-muted">No se registran gestiones de cobro para este cliente.</td></tr>' : 
      collectionLogs.map(log => `<tr>
        <td class="mono">${fmtDT(log.createdAt)}</td>
        <td><strong>${log.type}</strong></td>
        <td>
          <div>${log.comment}</div>
          <div style="font-size:8px;color:#7a8099;margin-top:2px">Gestor: ${log.gestor ? log.gestor.name : 'Sistema'}</div>
        </td>
        <td class="right mono">${log.paymentAmount ? `$ ${fmt(log.paymentAmount)}<br><span style="font-size:8px;color:#7a8099">(${PAY_TYPE_LABEL[log.paymentType] || log.paymentType})</span>` : '—'}</td>
        <td>${log.paymentAmount ? `<span class="chip">${log.status}</span>` : '—'}</td>
      </tr>`).join('')
    }
  </tbody>
</table>

<div class="page-break"></div>

<h2>Contactos de Referencia</h2>
<table>
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Relación</th>
      <th class="right">Teléfono</th>
    </tr>
  </thead>
  <tbody>
    ${contacts.length === 0 ? '<tr><td colspan="3" style="text-align:center" class="text-muted">Sin contactos de referencia registrados</td></tr>' : 
      contacts.map(c => `<tr>
        <td><strong>${c.name || '—'}</strong></td>
        <td>${c.relationship || 'Referencia'}</td>
        <td class="right mono">${c.phone}</td>
      </tr>`).join('')
    }
  </tbody>
</table>

<h2>Documentos Legales Expedidos</h2>
<table>
  <thead>
    <tr>
      <th>Nombre Documento</th>
      <th>Tipo</th>
      <th>Descripción</th>
      <th>Subido por</th>
      <th>Fecha</th>
    </tr>
  </thead>
  <tbody>
    ${legalCase.documents.length === 0 ? '<tr><td colspan="5" style="text-align:center" class="text-muted">No se han cargado documentos en este expediente</td></tr>' : 
      legalCase.documents.map(d => `<tr>
        <td><strong>${d.originalName}</strong></td>
        <td>${DOC_TYPE_LABEL[d.type] || d.type}</td>
        <td>${d.description || '—'}</td>
        <td>${d.uploader ? d.uploader.name : '—'}</td>
        <td>${fmtDate(d.createdAt)}</td>
      </tr>`).join('')
    }
  </tbody>
</table>

<h2>Tareas de Seguimiento</h2>
<table>
  <thead>
    <tr>
      <th>Título / Descripción</th>
      <th>Responsable</th>
      <th>Fecha Límite</th>
      <th>Prioridad</th>
      <th>Estado</th>
    </tr>
  </thead>
  <tbody>
    ${tasks.length === 0 ? '<tr><td colspan="5" style="text-align:center" class="text-muted">Sin tareas de seguimiento programadas</td></tr>' : 
      tasks.map(t => `<tr>
        <td>
          <strong>${t.title}</strong>
          ${t.description ? `<div class="comment">${t.description}</div>` : ''}
        </td>
        <td>${t.User ? t.User.name : '—'}</td>
        <td>${fmtDate(t.dueDate)}</td>
        <td>${PRIORITY_LABEL[t.priority] || t.priority}</td>
        <td>${TASK_STATUS_LABEL[t.status] || t.status}</td>
      </tr>`).join('')
    }
  </tbody>
</table>

<div class="footer">SIGMA Sistema de Gestión de Cobranza Móvil · Documento Resumen Legal Confidencial</div>
</body></html>`;

    const filename = `resumen-caso-${legalCase.client.name.replace(/\s+/g, '_')}-${caseId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    wkhtmltopdf(html, {
      pageSize:     'Letter',
      marginTop:    '10mm',
      marginBottom: '10mm',
      marginLeft:   '10mm',
      marginRight:  '10mm',
      encoding:     'utf-8',
    }).pipe(res);

  } catch (err) {
    next(err);
  }
};

module.exports = { index, show, create, update, uploadDocument, deleteDocument, exportReportPdf };
