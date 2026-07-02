'use strict';

const { sequelize } = require('../models');

const index = async (req, res, next) => {
  try {
    const { userId, roleId, branchId } = req.user;

    // ── Gestor: datos propios ─────────────────────────────────────────────────
    if (roleId === 3) {
      const [todayStats, assignedClients, pendingTasks, recentGestiones] = await Promise.all([
        // Gestiones del día — propias
        sequelize.query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN paymentAmount IS NOT NULL THEN 1 ELSE 0 END) AS withPayment,
            COALESCE(SUM(CASE WHEN paymentAmount IS NOT NULL THEN paymentAmount ELSE 0 END), 0) AS totalAmount
          FROM collectionlogs
          WHERE userId = ${parseInt(userId)}
            AND DATE(CONVERT_TZ(createdAt, '+00:00', '-06:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-06:00'))
        `),

        // Clientes asignados activos
        sequelize.query(`
          SELECT COUNT(*) AS total,
            SUM(CASE WHEN c.daysLate > 90 THEN 1 ELSE 0 END)  AS critical,
            COALESCE(SUM(c.balance + c.insurance + c.otherFees), 0) AS totalDeuda
          FROM ClientAssignments ca
          JOIN Clients c ON c.id = ca.clientId
          WHERE ca.userId = ${parseInt(userId)} AND ca.isActive = 1
        `),

        // Tareas pendientes propias
        sequelize.query(`
          SELECT COUNT(*) AS total,
            SUM(CASE WHEN dueDate <= NOW() THEN 1 ELSE 0 END) AS vencidas
          FROM Tasks
          WHERE userId = ${parseInt(userId)} AND status = 'pendiente'
        `),

        // Últimas 10 gestiones propias
        sequelize.query(`
          SELECT cl.type, cl.status, cl.paymentAmount,
                 DATE_FORMAT(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00'), '%d/%m/%Y %H:%i') AS fecha,
                 c.name AS clientName, c.riskCategory, c.id AS clientId
          FROM CollectionLogs cl
          JOIN Clients c ON cl.clientId = c.id
          WHERE cl.userId = ${parseInt(userId)}
          ORDER BY cl.createdAt DESC
          LIMIT 10
        `),
      ]);

      return res.render('dashboard/gestor', {
        title: 'Dashboard',
        user: req.user,
        todayStats:      todayStats[0][0]      || {},
        assignedClients: assignedClients[0][0] || {},
        pendingTasks:    pendingTasks[0][0]    || {},
        recentGestiones: recentGestiones[0]   || [],
      });
    }

    // ── Admin / Supervisor ────────────────────────────────────────────────────
    const branchFilter = roleId === 1 ? '' : `AND c.branchId = ${parseInt(branchId)}`;
    const branchJoin   = roleId !== 1 ? `JOIN Clients c ON cl.clientId = c.id WHERE c.branchId = ${parseInt(branchId)} AND` : 'WHERE';

    const [riskDist, todayStats, pendingPayments, topDebt] = await Promise.all([
      // Distribución NCB-022
      sequelize.query(`
        SELECT riskCategory, COUNT(*) AS total
        FROM Clients c
        WHERE 1=1 ${branchFilter}
        GROUP BY riskCategory ORDER BY riskCategory
      `),

      // Gestiones del día
      sequelize.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN cl.paymentAmount IS NOT NULL THEN 1 ELSE 0 END) AS withPayment,
          COALESCE(SUM(CASE WHEN cl.paymentAmount IS NOT NULL THEN cl.paymentAmount ELSE 0 END), 0) AS totalAmount
        FROM CollectionLogs cl
        ${branchJoin}
        DATE(CONVERT_TZ(cl.createdAt, '+00:00', '-06:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-06:00'))
      `),

      // Pagos pendientes de autorización
      sequelize.query(`
        SELECT COUNT(*) AS total, COALESCE(SUM(cl.paymentAmount), 0) AS totalAmount
        FROM CollectionLogs cl
        ${branchJoin}
        cl.paymentAmount IS NOT NULL AND cl.status = 'pendiente'
      `),

      // Top 5 clientes con mayor saldo
      sequelize.query(`
        SELECT c.name, c.riskCategory, c.daysLate, c.id,
               ROUND(c.balance + c.insurance + c.otherFees, 2) AS totalDeuda
        FROM Clients c
        WHERE 1=1 ${branchFilter}
        ORDER BY totalDeuda DESC LIMIT 5
      `),
    ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      user: req.user,
      riskDist:        riskDist[0],
      todayStats:      todayStats[0][0]      || {},
      pendingPayments: pendingPayments[0][0] || {},
      topDebt:         topDebt[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { index };
