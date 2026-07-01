'use strict';

const { AuditLog, User, sequelize } = require('../models');
const { Op } = require('sequelize');

const index = async (req, res, next) => {
  try {
    const { userId, action, entity, from, to, page = 1 } = req.query;
    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;

    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to)   where.createdAt[Op.lte] = new Date(to + 'T23:59:59');
    }

    // Contar sin include para evitar conflictos con findAndCountAll
    const [total, logs] = await Promise.all([
      AuditLog.count({ where }),
      AuditLog.findAll({
        where,
        include: [{ model: User, as: 'User', attributes: ['id', 'name'], required: false }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      }),
    ]);

    const users = await User.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });

    res.render('audit/index', {
      title: 'Auditoría',
      user: req.user,
      logs,
      users,
      filters: { userId, action, entity, from, to },
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

module.exports = { index };
