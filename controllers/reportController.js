'use strict';

const XLSX = require('xlsx');
const { sequelize, SystemConfig } = require('../models');

// Valida que el string sea una fecha ISO YYYY-MM-DD válida
const isValidDate = (str) => typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());

// Carga configuración de metas desde la BD, con fallback a defaults
const loadMetas = async () => {
  try {
    const rows = await SystemConfig.findAll({
      where: { key: ['meta_gestiones_mensual', 'meta_recuperado_mensual'] },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      baseGestiones:  parseFloat(map['meta_gestiones_mensual']  || 80),
      baseRecuperado: parseFloat(map['meta_recuperado_mensual'] || 5000),
    };
  } catch {
    return { baseGestiones: 80, baseRecuperado: 5000 };
  }
};

// Calcula el factor de escala entre el rango de fechas y un mes completo
const calcScaleFactor = (dateFrom, dateTo) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((new Date(dateTo + 'T00:00:00') - new Date(dateFrom + 'T00:00:00')) / msPerDay) + 1;
  return Math.max(1, days) / 30.44;
};

const index = async (req, res, next) => {
  try {
    const { roleId, branchId, userId } = req.user;
    const { from, to, branch: branchFilter } = req.query;

    const branchSql = roleId === 1
      ? (branchFilter ? `AND c.branchId = ${parseInt(branchFilter)}` : '')
      : `AND c.branchId = ${parseInt(branchId)}`;

    // Solo gestores filtran por sí mismos
    const gestorSql = roleId === 3 ? `AND cl.userId = ${parseInt(userId)}` : '';

    const dateFrom = isValidDate(from) ? from : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dateTo   = isValidDate(to)   ? to   : new Date().toISOString().split('T')[0];
    const dateSql  = `AND DATE(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00')) BETWEEN '${dateFrom}' AND '${dateTo}'`;

    // Metas configurables desde BD, escaladas al rango de fechas seleccionado
    const { baseGestiones, baseRecuperado } = await loadMetas();
    const scaleFactor     = calcScaleFactor(dateFrom, dateTo);
    const META_GESTIONES  = Math.round(baseGestiones  * scaleFactor);
    const META_RECUPERADO = parseFloat((baseRecuperado * scaleFactor).toFixed(2));
    const META_GESTIONES_BASE  = baseGestiones;
    const META_RECUPERADO_BASE = baseRecuperado;

    const [
      byGestor,
      riskDist,
      paymentStatus,
      pendingAuth,
      pendingApply,
      appliedPayments,
      daily,
      byBranch,
      topClients,
      paymentsByGestor,
      paymentsPendingApplyDetail,
      pendingReview,
    ] = await Promise.all([

      // Desempeño por gestor con % de meta
      sequelize.query(`
        SELECT u.id, u.name,
          COUNT(cl.id)                                                         AS totalGestiones,
          SUM(CASE WHEN cl.paymentAmount IS NOT NULL THEN 1 ELSE 0 END)       AS withPayment,
          COALESCE(SUM(CASE WHEN cl.paymentAmount IS NOT NULL
                            THEN cl.paymentAmount ELSE 0 END), 0)             AS totalAmount,
          SUM(CASE WHEN cl.type='Visita'   THEN 1 ELSE 0 END)                AS visitas,
          SUM(CASE WHEN cl.type='Llamada'  THEN 1 ELSE 0 END)                AS llamadas,
          SUM(CASE WHEN cl.type='WhatsApp' THEN 1 ELSE 0 END)                AS whatsapp,
          SUM(CASE WHEN cl.type='Mensaje'  THEN 1 ELSE 0 END)                AS mensajes,
          SUM(CASE WHEN cl.status IN ('revisado', 'autorizado', 'aplicado')
                   THEN cl.paymentAmount ELSE 0 END)                          AS recuperado
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on'
          ${roleId === 3 ? `AND u.id = ${parseInt(userId)}` : ''}
          ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name
        ORDER BY totalGestiones DESC
      `),

      // Distribución NCB-022
      sequelize.query(`
        SELECT riskCategory, COUNT(*) AS total,
               SUM(balance + insurance + otherFees) AS totalBalance
        FROM clients c
        WHERE 1=1 ${branchSql}
        GROUP BY riskCategory ORDER BY riskCategory
      `),

      // Estado de pagos en el período
      sequelize.query(`
        SELECT cl.status, COUNT(*) AS total,
               COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL ${dateSql} ${branchSql} ${gestorSql}
        GROUP BY cl.status
      `),

      // Pagos pendientes de autorización (con detalle para link) - ESTADO: revisado
      sequelize.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL AND cl.status = 'revisado' ${branchSql}
      `),

      // Pagos autorizados pendientes de aplicar (secretaria) - ESTADO: autorizado
      sequelize.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL AND cl.status = 'autorizado' ${branchSql}
      `),

      // Pagos ya aplicados en el ERP en el período - ESTADO: aplicado
      sequelize.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL AND cl.status = 'aplicado' ${branchSql} ${dateSql}
      `),

      // Actividad diaria últimos 14 días
      sequelize.query(`
        SELECT DATE(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00')) AS fecha,
               COUNT(*) AS total
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.createdAt >= DATE_SUB(NOW(), INTERVAL 14 DAY) ${branchSql} ${gestorSql}
        GROUP BY fecha ORDER BY fecha ASC
      `),

      // Recuperación por sucursal (solo admin)
      roleId === 1 ? sequelize.query(`
        SELECT b.name AS branchName,
               COALESCE(SUM(CASE WHEN cl.status IN ('revisado','autorizado','aplicado')
                                THEN cl.paymentAmount ELSE 0 END), 0) AS recuperado,
               COUNT(DISTINCT cl.id) AS gestiones
        FROM branches b
        LEFT JOIN clients c   ON c.branchId = b.id
        LEFT JOIN collectionlogs cl ON cl.clientId = c.id ${dateSql}
        WHERE b.status = 'on'
        GROUP BY b.id, b.name
        ORDER BY recuperado DESC
      `) : Promise.resolve([[]]),

      // Top 5 clientes con mayor saldo pendiente
      sequelize.query(`
        SELECT c.id, c.name, c.loanNumber, c.riskCategory, c.daysLate,
               (c.balance + c.insurance + c.otherFees) AS totalDeuda
        FROM clients c
        WHERE 1=1 ${branchSql}
        ORDER BY totalDeuda DESC LIMIT 5
      `),

      // Reporte 1: Pagos recibidos por gestor
      sequelize.query(`
        SELECT u.id, u.name,
          COUNT(cl.id)                                                         AS totalCount,
          COALESCE(SUM(cl.paymentAmount), 0)                                   AS totalAmount,
          SUM(CASE WHEN cl.status='pendiente' THEN 1 ELSE 0 END)              AS pendingCount,
          COALESCE(SUM(CASE WHEN cl.status='pendiente' THEN cl.paymentAmount ELSE 0 END), 0) AS pendingAmount,
          SUM(CASE WHEN cl.status='revisado' THEN 1 ELSE 0 END)               AS reviewedCount,
          COALESCE(SUM(CASE WHEN cl.status='revisado' THEN cl.paymentAmount ELSE 0 END), 0) AS reviewedAmount,
          SUM(CASE WHEN cl.status='autorizado' THEN 1 ELSE 0 END)             AS authorizedCount,
          COALESCE(SUM(CASE WHEN cl.status='autorizado' THEN cl.paymentAmount ELSE 0 END), 0) AS authorizedAmount,
          SUM(CASE WHEN cl.status='aplicado' THEN 1 ELSE 0 END)               AS appliedCount,
          COALESCE(SUM(CASE WHEN cl.status='aplicado' THEN cl.paymentAmount ELSE 0 END), 0) AS appliedAmount,
          SUM(CASE WHEN cl.status='rechazado' THEN 1 ELSE 0 END)              AS rejectedCount,
          COALESCE(SUM(CASE WHEN cl.status='rechazado' THEN cl.paymentAmount ELSE 0 END), 0) AS rejectedAmount
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id AND cl.paymentAmount IS NOT NULL ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on'
          ${roleId === 3 ? `AND u.id = ${parseInt(userId)}` : ''}
          ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name
        ORDER BY totalAmount DESC
      `),

      // Reporte 2: Detalle de pagos recibidos pendientes de aplicar
      sequelize.query(`
        SELECT cl.id, cl.paymentAmount, cl.paymentType, cl.status, cl.createdAt,
               c.name AS clientName, c.loanNumber, u.name AS gestorName
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        JOIN users u ON cl.userId = u.id
        WHERE cl.paymentAmount IS NOT NULL
          AND cl.status IN ('pendiente', 'revisado', 'autorizado')
          ${branchSql}
          ${gestorSql}
        ORDER BY cl.createdAt ASC
      `),

      // Pagos pendientes de revisión (Jefe de Operaciones) - ESTADO: pendiente
      sequelize.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        WHERE cl.paymentAmount IS NOT NULL AND cl.status = 'pendiente' ${branchSql}
      `),
    ]);

    // Sucursales para filtro (solo admin)
    let branches = [];
    if (roleId === 1) {
      const [b] = await sequelize.query(`SELECT id, name FROM branches WHERE status='on' ORDER BY name`);
      branches = b;
    }

    res.render('reports/index', {
      title: 'Reportes',
      user: req.user,
      byGestor: byGestor[0],
      riskDist:  riskDist[0],
      paymentStatus: paymentStatus[0],
      pendingAuth:     pendingAuth[0][0]     || { total: 0, totalAmount: 0 },
      pendingApply:    pendingApply[0][0]    || { total: 0, totalAmount: 0 },
      appliedPayments: appliedPayments[0][0] || { total: 0, totalAmount: 0 },
      daily:       daily[0],
      byBranch:    byBranch[0],
      topClients:  topClients[0],
      paymentsByGestor: paymentsByGestor[0],
      paymentsPendingApplyDetail: paymentsPendingApplyDetail[0],
      pendingReview: pendingReview[0][0]     || { total: 0, totalAmount: 0 },
      branches,
      filters: { from: dateFrom, to: dateTo, branch: branchFilter || '' },
      META_GESTIONES,
      META_RECUPERADO,
      META_GESTIONES_BASE,
      META_RECUPERADO_BASE,
      scaleFactor: parseFloat(scaleFactor.toFixed(2)),
    });
  } catch (err) { next(err); }
};

// Exporta un Excel con 5 hojas: gestiones, pagos, cartera, pagos por gestor, pagos pendientes de aplicar
const exportExcel = async (req, res, next) => {
  try {
    const { roleId, branchId, userId } = req.user;
    const { from, to, branch: branchFilter } = req.query;

    const branchSql = roleId === 1
      ? (branchFilter ? `AND c.branchId = ${parseInt(branchFilter)}` : '')
      : `AND c.branchId = ${parseInt(branchId)}`;

    const gestorSql = roleId === 3 ? `AND cl.userId = ${parseInt(userId)}` : '';

    const dateFrom = isValidDate(from) ? from : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dateTo   = isValidDate(to)   ? to   : new Date().toISOString().split('T')[0];
    const dateSql  = `AND DATE(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00')) BETWEEN '${dateFrom}' AND '${dateTo}'`;

    const [[gestiones], [pagos], [cartera], [pagosPorGestor], [pagosPendientes]] = await Promise.all([
      // Hoja 1: gestiones por gestor
      sequelize.query(`
        SELECT
          u.name                                                             AS Gestor,
          COUNT(cl.id)                                                       AS \`Total Gestiones\`,
          SUM(CASE WHEN cl.type='Visita'   THEN 1 ELSE 0 END)              AS Visitas,
          SUM(CASE WHEN cl.type='Llamada'  THEN 1 ELSE 0 END)              AS Llamadas,
          SUM(CASE WHEN cl.type='WhatsApp' THEN 1 ELSE 0 END)              AS WhatsApp,
          SUM(CASE WHEN cl.type='Mensaje'  THEN 1 ELSE 0 END)              AS Mensajes,
          SUM(CASE WHEN cl.paymentAmount IS NOT NULL THEN 1 ELSE 0 END)    AS \`Pagos Reportados\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.paymentAmount IS NOT NULL THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Monto Reportado USD\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status IN ('revisado','autorizado','aplicado') THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Monto Recuperado USD\`
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on'
          ${roleId === 3 ? `AND u.id = ${parseInt(userId)}` : ''}
          ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name
        ORDER BY \`Monto Recuperado USD\` DESC
      `),

      // Hoja 2: detalle de pagos en el período
      sequelize.query(`
        SELECT
          DATE_FORMAT(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00'), '%d/%m/%Y') AS Fecha,
          c.name                         AS Cliente,
          c.clientCode                   AS \`Código Cliente\`,
          c.loanNumber                   AS \`Número Préstamo\`,
          c.riskCategory                 AS Categoría,
          u.name                         AS Gestor,
          cl.type                        AS Tipo,
          cl.status                      AS Estado,
          ROUND(cl.paymentAmount, 2)     AS \`Monto USD\`,
          cl.comment                     AS Comentario
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        JOIN users  u ON cl.userId    = u.id
        WHERE cl.paymentAmount IS NOT NULL ${dateSql} ${branchSql} ${gestorSql}
        ORDER BY cl.createdAt DESC
      `),

      // Hoja 3: cartera por categoría de riesgo
      sequelize.query(`
        SELECT
          c.riskCategory                                           AS Categoría,
          COUNT(*)                                                AS Clientes,
          ROUND(SUM(c.balance), 2)                               AS \`Saldo USD\`,
          ROUND(SUM(c.insurance), 2)                             AS \`Seguro USD\`,
          ROUND(SUM(c.otherFees), 2)                             AS \`Otros Cargos USD\`,
          ROUND(SUM(c.balance + c.insurance + c.otherFees), 2)  AS \`Total Deuda USD\`,
          ROUND(AVG(c.daysLate), 0)                              AS \`Días Mora Promedio\`
        FROM clients c
        WHERE 1=1 ${branchSql}
        GROUP BY c.riskCategory
        ORDER BY c.riskCategory
      `),

      // Hoja 4: pagos por gestor
      sequelize.query(`
        SELECT
          u.name                                                             AS Gestor,
          COUNT(cl.id)                                                       AS \`Total Pagos\`,
          ROUND(COALESCE(SUM(cl.paymentAmount), 0), 2)                       AS \`Monto Total USD\`,
          SUM(CASE WHEN cl.status='pendiente' THEN 1 ELSE 0 END)              AS \`Pendientes Cantidad\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status='pendiente' THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Pendientes Monto USD\`,
          SUM(CASE WHEN cl.status='revisado' THEN 1 ELSE 0 END)               AS \`Revisados Cantidad\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status='revisado' THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Revisados Monto USD\`,
          SUM(CASE WHEN cl.status='autorizado' THEN 1 ELSE 0 END)             AS \`Autorizados Cantidad\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status='autorizado' THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Autorizados Monto USD\`,
          SUM(CASE WHEN cl.status='aplicado' THEN 1 ELSE 0 END)               AS \`Aplicados Cantidad\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status='aplicado' THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Aplicados Monto USD\`,
          SUM(CASE WHEN cl.status='rechazado' THEN 1 ELSE 0 END)              AS \`Rechazados Cantidad\`,
          ROUND(COALESCE(SUM(CASE WHEN cl.status='rechazado' THEN cl.paymentAmount ELSE 0 END), 0), 2) AS \`Rechazados Monto USD\`
        FROM users u
        LEFT JOIN collectionlogs cl ON cl.userId = u.id AND cl.paymentAmount IS NOT NULL ${dateSql}
        LEFT JOIN clients c ON cl.clientId = c.id
        WHERE u.roleId = 3 AND u.status = 'on'
          ${roleId === 3 ? `AND u.id = ${parseInt(userId)}` : ''}
          ${branchSql.replace(/c\.branchId/g, 'u.branchId')}
        GROUP BY u.id, u.name
        ORDER BY \`Monto Total USD\` DESC
      `),

      // Hoja 5: pagos pendientes de aplicar
      sequelize.query(`
        SELECT
          DATE_FORMAT(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00'), '%d/%m/%Y %H:%i') AS \`Fecha Recibido\`,
          c.name                                                             AS Cliente,
          c.loanNumber                                                       AS Préstamo,
          u.name                                                             AS Gestor,
          ROUND(cl.paymentAmount, 2)                                         AS \`Monto USD\`,
          cl.paymentType                                                     AS \`Tipo Pago\`,
          cl.status                                                          AS Estado
        FROM collectionlogs cl
        JOIN clients c ON cl.clientId = c.id
        JOIN users u ON cl.userId = u.id
        WHERE cl.paymentAmount IS NOT NULL
          AND cl.status IN ('pendiente', 'revisado', 'autorizado')
          ${branchSql}
          ${gestorSql}
        ORDER BY cl.createdAt ASC
      `),
    ]);

    const wb = XLSX.utils.book_new();

    const wsGestiones = XLSX.utils.json_to_sheet(gestiones);
    XLSX.utils.book_append_sheet(wb, wsGestiones, 'Gestiones por Gestor');

    const wsPagos = XLSX.utils.json_to_sheet(pagos);
    XLSX.utils.book_append_sheet(wb, wsPagos, 'Detalle de Pagos');

    const wsCartera = XLSX.utils.json_to_sheet(cartera);
    XLSX.utils.book_append_sheet(wb, wsCartera, 'Cartera NCB-022');

    const wsPagosGestor = XLSX.utils.json_to_sheet(pagosPorGestor);
    XLSX.utils.book_append_sheet(wb, wsPagosGestor, 'Pagos por Gestor');

    const wsPagosPendientes = XLSX.utils.json_to_sheet(pagosPendientes);
    XLSX.utils.book_append_sheet(wb, wsPagosPendientes, 'Pagos Pendientes de Aplicar');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `reporte-sigma-${dateFrom}-${dateTo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    if (req.user.roleId !== 1) return res.status(403).json({ success: false, message: 'Solo administradores pueden cambiar la configuración' });

    const { meta_gestiones_mensual, meta_recuperado_mensual } = req.body;
    const userId = req.user.userId;

    if (meta_gestiones_mensual != null) {
      const val = parseFloat(meta_gestiones_mensual);
      if (isNaN(val) || val <= 0) return res.status(422).json({ success: false, message: 'Meta de gestiones inválida' });
      await SystemConfig.upsert({ key: 'meta_gestiones_mensual', value: String(Math.round(val)), updatedBy: userId });
    }
    if (meta_recuperado_mensual != null) {
      const val = parseFloat(meta_recuperado_mensual);
      if (isNaN(val) || val <= 0) return res.status(422).json({ success: false, message: 'Meta de recuperado inválida' });
      await SystemConfig.upsert({ key: 'meta_recuperado_mensual', value: val.toFixed(2), updatedBy: userId });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { index, exportExcel, updateSettings };
