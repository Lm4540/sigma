'use strict';

const { ClientAssignment, Client, User, sequelize } = require('../models');
const assignmentService = require('../services/assignmentService');

const index = async (req, res, next) => {
  try {
    const { roleId, branchId } = req.user;
    const branchFilter = roleId !== 1 ? 'AND c.branchId = :branchId' : '';

    const [clients] = await sequelize.query(`
      SELECT c.id, c.name, c.clientCode, c.loanNumber, c.riskCategory, c.daysLate, c.address,
             u.name as gestorName, ca.assignedAt
      FROM Clients c
      LEFT JOIN ClientAssignments ca ON ca.clientId = c.id AND ca.isActive = 1
      LEFT JOIN Users u ON ca.userId = u.id
      WHERE 1=1 ${branchFilter}
      ORDER BY c.daysLate DESC
    `, { replacements: { branchId } });

    const gestoresWhere = { roleId: 3, status: 'on' };
    if (roleId !== 1) {
      gestoresWhere.branchId = branchId;
    }

    const gestores = await User.findAll({
      where: gestoresWhere,
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    res.render('assignments/index', { title: 'Asignación de Cartera', user: req.user, clients, gestores });
  } catch (err) { next(err); }
};

const assign = async (req, res, next) => {
  try {
    const { clientId, userId } = req.body;
    await assignmentService.assign({
      clientId: parseInt(clientId),
      userId: parseInt(userId),
      assignedBy: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { index, assign };
