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

    const [[riskDist], [paymentStatus], [byGestor], [topClients]] = await Promise.all([
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
          SUM(CASE WHEN cl.status IN ('autorizado','aplicado') THEN cl.paymentAmount ELSE 0 END) AS recuperado
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
    ]);

    const fmt = (n) => n != null ? parseFloat(n).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const totalCartera = riskDist.reduce((s, r) => s + parseInt(r.total), 0);
    const totalBalance = riskDist.reduce((s, r) => s + parseFloat(r.totalBalance || 0), 0);

    const STATUS_LABEL = { pendiente: 'Pendiente', autorizado: 'Autorizado', rechazado: 'Rechazado', aplicado: 'Aplicado' };
    const RISK_COLORS  = { A1: '#065f46', A2: '#166534', B: '#713f12', C: '#7c2d12', D: '#7f1d1d', E: '#831843' };

    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1f2e; padding: 32px; background: #fff; }
  h1 { font-size: 20px; font-weight: 700; color: #1a2744; }
  h2 { font-size: 13px; font-weight: 700; color: #1a2744; margin-bottom: 10px; margin-top: 24px; padding-bottom: 6px; border-bottom: 2px solid #1a2744; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header-right { text-align: right; font-size: 10px; color: #7a8099; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a2744; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #f0ede8; }
  tr:nth-child(even) td { background: #f8f6f3; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; }
  .amber { color: #c97c1a; font-weight: 700; }
  .right { text-align: right; }
  .footer { margin-top: 32px; border-top: 1px solid #e0ddd8; padding-top: 12px; font-size: 9px; color: #b0b5c8; text-align: center; }
</style>
</head><body>
<div class="header">
  <div>
    <h1>SIGMA — Reporte de Cobranza</h1>
    <div style="color:#7a8099;font-size:10px;margin-top:4px">Período: ${dateFrom} al ${dateTo}</div>
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

<h2>Desempeño por Gestor</h2>
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

<div class="footer">SIGMA Sistema de Gestión de Cobranza Móvil · Reporte Generado automáticamente </div>
</body></html>`;

    const filename = `reporte-sigma-${dateFrom}-${dateTo}.pdf`;
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

  } catch (err) { next(err); }
};

module.exports = { reportPdf };
