'use strict';

const wkhtmltopdf = require('wkhtmltopdf');

// Valida que el string sea una fecha ISO YYYY-MM-DD válida
const isValidDate = (str) => typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
const { sequelize } = require('../models');

// Configurar ruta del binario desde variable de entorno
if (process.env.WKHTMLTOPDF_PATH) {
  wkhtmltopdf.command = process.env.WKHTMLTOPDF_PATH
    .replace(/^['"]+|['"]+$/g, '')  // quitar comillas envolventes
    .replace(/\\\\/g, '\\');         // normalizar dobles barras invertidas
}

const reportPdf = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const { from, to, branch: branchFilter } = req.query;

    const branchSql = roleId === 1
      ? (branchFilter ? `AND c.branchId = ${parseInt(branchFilter)}` : '')
      : `AND c.branchId = ${parseInt(branchId)}`;

    const dateFrom = isValidDate(from) ? from : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dateTo   = isValidDate(to)   ? to   : new Date().toISOString().split('T')[0];
    const dateSql  = `AND DATE(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00')) BETWEEN '${dateFrom}' AND '${dateTo}'`;

    const [
      [riskDist],
      [paymentStatus],
      [byGestor],
      [topClients],
      [paymentsByGestor],
      [paymentsPending],
    ] = await Promise.all([
      sequelize.query(`
        SELECT riskCategory, COUNT(*) AS total, SUM(balance + insurance + otherFees) AS totalBalance
        FROM clients c WHERE 1=1 ${branchSql} GROUP BY riskCategory ORDER BY riskCategory
      `),
      sequelize.query(`
        SELECT cl.status, COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL ${dateSql} ${branchSql} GROUP BY cl.status
      `),
      sequelize.query(`
        SELECT u.name,
          COUNT(cl.id) AS totalGestiones,
          SUM(CASE WHEN cl.status IN ('revisado','autorizado','aplicado') THEN cl.paymentAmount ELSE 0 END) AS recuperado
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on' ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name ORDER BY recuperado DESC
      `),
      sequelize.query(`
        SELECT c.name, c.riskCategory, c.daysLate,
               (c.balance + c.insurance + c.otherFees) AS totalDeuda
        FROM clients c WHERE 1=1 ${branchSql} ORDER BY totalDeuda DESC LIMIT 10
      `),
      // Pagos recibidos por gestor
      sequelize.query(`
        SELECT u.name,
          COUNT(cl.id) AS totalCount,
          COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount,
          COALESCE(SUM(CASE WHEN cl.status='pendiente' THEN cl.paymentAmount ELSE 0 END), 0) AS pendingAmount,
          COALESCE(SUM(CASE WHEN cl.status='revisado' THEN cl.paymentAmount ELSE 0 END), 0) AS reviewedAmount,
          COALESCE(SUM(CASE WHEN cl.status='autorizado' THEN cl.paymentAmount ELSE 0 END), 0) AS authorizedAmount,
          COALESCE(SUM(CASE WHEN cl.status='aplicado' THEN cl.paymentAmount ELSE 0 END), 0) AS appliedAmount,
          COALESCE(SUM(CASE WHEN cl.status='rechazado' THEN cl.paymentAmount ELSE 0 END), 0) AS rejectedAmount
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id AND cl.paymentAmount IS NOT NULL ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on' ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name ORDER BY totalAmount DESC
      `),
      // Detalle de pagos recibidos pendientes de aplicar
      sequelize.query(`
        SELECT cl.createdAt, c.name AS clientName, c.loanNumber, u.name AS gestorName,
               cl.paymentAmount, cl.paymentType, cl.status
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        JOIN users u ON cl.userId = u.id
        WHERE cl.paymentAmount IS NOT NULL AND cl.status IN ('pendiente', 'revisado', 'autorizado') ${branchSql}
        ORDER BY cl.createdAt ASC
      `),
    ]);

    const fmt = (n) => n != null ? parseFloat(n).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const totalCartera = riskDist.reduce((s, r) => s + parseInt(r.total), 0);
    const totalBalance = riskDist.reduce((s, r) => s + parseFloat(r.totalBalance || 0), 0);

    const STATUS_LABEL = { pendiente: 'Pendiente', revisado: 'Revisado', autorizado: 'Autorizado', rechazado: 'Rechazado', aplicado: 'Aplicado' };
    const RISK_COLORS  = { A1: '#065f46', A2: '#166534', B: '#713f12', C: '#7c2d12', D: '#7f1d1d', E: '#831843' };
    const TYPE_LABEL = { efectivo: 'Efectivo', nota_abono: 'Nota de Abono', especie: 'Especie', cheque: 'Cheque', transferencia: 'Transferencia' };

    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1f2e; padding: 24px; background: #fff; }
  h1 { font-size: 18px; font-weight: 700; color: #1a2744; }
  h2 { font-size: 12px; font-weight: 700; color: #1a2744; margin-bottom: 8px; margin-top: 20px; padding-bottom: 4px; border-bottom: 2px solid #1a2744; page-break-after: avoid; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .header-right { text-align: right; font-size: 9px; color: #7a8099; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0ede8; }
  tr:nth-child(even) td { background: #f8f6f3; }
  .chip { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 8px; font-weight: 700; }
  .amber { color: #c97c1a; font-weight: 700; }
  .right { text-align: right; }
  .footer { margin-top: 24px; border-top: 1px solid #e0ddd8; padding-top: 8px; font-size: 8px; color: #b0b5c8; text-align: center; }
  .page-break { page-break-before: always; }
</style>
</head><body>
<div class="header">
  <div>
    <h1>SIGMA — Reporte de Cobranza Consolidado</h1>
    <div style="color:#7a8099;font-size:9px;margin-top:2px">Período: ${dateFrom} al ${dateTo}</div>
  </div>
  <div class="header-right">
    Generado: ${new Date().toLocaleString('es-SV')}<br>
    SIGMA v2 · El Salvador
  </div>
</div>

<h2>Distribución de Cartera — NCB-022</h2>
<table>
  <thead><tr><th>Categoría</th><th class="right">Clientes</th><th class="right">%</th><th class="right">Saldo Total</th></tr></thead>
  <tbody>
    ${riskDist.map(r => `<tr>
      <td><span class="chip" style="background:${RISK_COLORS[r.riskCategory]}22;color:${RISK_COLORS[r.riskCategory]}">${r.riskCategory}</span></td>
      <td class="right">${parseInt(r.total)}</td>
      <td class="right">${totalCartera > 0 ? Math.round((parseInt(r.total) / totalCartera) * 100) : 0}%</td>
      <td class="right">$ ${fmt(r.totalBalance)}</td>
    </tr>`).join('')}
    <tr style="font-weight:700;border-top:2px solid #1a2744">
      <td>Total</td><td class="right">${totalCartera}</td><td></td><td class="right">$ ${fmt(totalBalance)}</td>
    </tr>
  </tbody>
</table>

<h2>Estado de Pagos en el Período</h2>
<table>
  <thead><tr><th>Estado</th><th class="right">Cantidad</th><th class="right">Monto</th></tr></thead>
  <tbody>
    ${paymentStatus.map(p => `<tr>
      <td>${STATUS_LABEL[p.status] || p.status}</td>
      <td class="right">${p.total}</td>
      <td class="right amber">$ ${fmt(p.totalAmount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<h2>Desempeño General por Gestor</h2>
<table>
  <thead><tr><th>Gestor</th><th class="right">Gestiones</th><th class="right">Recuperado</th></tr></thead>
  <tbody>
    ${byGestor.map(g => `<tr>
      <td>${g.name}</td>
      <td class="right">${g.totalGestiones || 0}</td>
      <td class="right amber">$ ${fmt(g.recuperado)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="page-break"></div>

<h2>Reporte de Pagos Recibidos por Gestor (Desglose de Estados)</h2>
<table>
  <thead>
    <tr>
      <th>Gestor</th>
      <th class="right">Cant. Pagos</th>
      <th class="right">Monto Total</th>
      <th class="right">Pendiente</th>
      <th class="right">Revisado</th>
      <th class="right">Autorizado</th>
      <th class="right">Aplicado</th>
      <th class="right">Rechazado</th>
    </tr>
  </thead>
  <tbody>
    ${paymentsByGestor.map(g => `<tr>
      <td><strong>${g.name}</strong></td>
      <td class="right">${g.totalCount}</td>
      <td class="right" style="font-weight:600">$ ${fmt(g.totalAmount)}</td>
      <td class="right text-muted">$ ${fmt(g.pendingAmount)}</td>
      <td class="right text-muted">$ ${fmt(g.reviewedAmount)}</td>
      <td class="right text-muted">$ ${fmt(g.authorizedAmount)}</td>
      <td class="right text-muted" style="color:#065f46">$ ${fmt(g.appliedAmount)}</td>
      <td class="right text-muted" style="color:#7f1d1d">$ ${fmt(g.rejectedAmount)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<h2>Pagos Recibidos Pendientes de Aplicar (Filtro ERP)</h2>
<table>
  <thead>
    <tr>
      <th>Fecha</th>
      <th>Cliente</th>
      <th>Gestor</th>
      <th>Tipo Pago</th>
      <th>Estado</th>
      <th class="right">Monto</th>
    </tr>
  </thead>
  <tbody>
    ${paymentsPending.length === 0 ? '<tr><td colspan="6" style="text-align:center" class="text-muted">No hay pagos pendientes de aplicar</td></tr>' : 
      paymentsPending.map(p => `<tr>
        <td>${new Date(p.createdAt).toLocaleDateString('es-SV')}</td>
        <td>${p.clientName}<br><span style="font-size:8px;color:#7a8099">${p.loanNumber || ''}</span></td>
        <td>${p.gestorName}</td>
        <td>${TYPE_LABEL[p.paymentType] || p.paymentType}</td>
        <td><span class="chip" style="background:#fef9c3;color:#713f12">${STATUS_LABEL[p.status] || p.status}</span></td>
        <td class="right amber">$ ${fmt(p.paymentAmount)}</td>
      </tr>`).join('')
    }
  </tbody>
</table>

<h2>Top 10 Clientes con Mayor Deuda</h2>
<table>
  <thead><tr><th>Cliente</th><th>Cat.</th><th class="right">Días mora</th><th class="right">Deuda total</th></tr></thead>
  <tbody>
    ${topClients.map(c => `<tr>
      <td>${c.name}</td>
      <td><span class="chip" style="background:${RISK_COLORS[c.riskCategory]}22;color:${RISK_COLORS[c.riskCategory]}">${c.riskCategory}</span></td>
      <td class="right">${c.daysLate}</td>
      <td class="right amber">$ ${fmt(c.totalDeuda)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="footer">SIGMA Sistema de Gestión de Cobranza Móvil · Reporte Consolidado de Pagos </div>
</body></html>`;

    const filename = `reporte-sigma-pagos-${dateFrom}-${dateTo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    wkhtmltopdf(html, {
      pageSize:     'Letter',
      marginTop:    '8mm',
      marginBottom: '8mm',
      marginLeft:   '8mm',
      marginRight:  '8mm',
      encoding:     'utf-8',
    }).pipe(res);

  } catch (err) { next(err); }
};

module.exports = { reportPdf };
