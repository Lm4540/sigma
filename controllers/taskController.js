'use strict';

const { Task, User, Client } = require('../models');
const { Op } = require('sequelize');

const index = async (req, res, next) => {
  try {
    const { userId, roleId } = req.user;
    const filterUserId = req.query.userId ? parseInt(req.query.userId) : null;

    let where = {};
    if (roleId === 3) {
      where.userId = userId;
    } else if (filterUserId) {
      where.userId = filterUserId;
    }

    const tasks = await Task.findAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name'] },
        { model: Client, attributes: ['id', 'name', 'loanNumber'] },
      ],
      order: [['dueDate', 'ASC']],
    });

    const users = roleId !== 3
      ? await User.findAll({ where: { status: 'on' }, attributes: ['id', 'name'], order: [['name', 'ASC']] })
      : [];

    res.render('tasks/index', { title: 'Tareas', user: req.user, tasks, users, filterUserId: filterUserId || '' });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { userId: authUserId, roleId } = req.user;
    const { title, description, dueDate, priority, clientId, userId } = req.body;

    // Gestores solo pueden crear sus propias tareas
    const targetUserId = roleId === 3 ? authUserId : (parseInt(userId) || authUserId);

    const task = await Task.create({
      userId: targetUserId,
      clientId: clientId || null,
      title,
      description: description || null,
      dueDate,
      priority: priority || 'media',
      createdBy: authUserId,
    });

    res.status(201).json({ success: true, data: { id: task.id } });
  } catch (err) { next(err); }
};

const complete = async (req, res, next) => {
  try {
    const { userId, roleId } = req.user;
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

    // Solo el usuario asignado o el administrador pueden completar
    if (roleId !== 1 && task.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Solo el responsable puede completar esta tarea' });
    }

    await task.update({ status: 'completada' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const reassign = async (req, res, next) => {
  try {
    const { roleId } = req.user;
    // Solo administradores y supervisores pueden reasignar
    if (roleId !== 1 && roleId !== 2) {
      return res.status(403).json({ success: false, message: 'Sin permiso para reasignar tareas' });
    }

    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

    const newUserId = parseInt(req.body.userId);
    const targetUser = await User.findByPk(newUserId, { attributes: ['id'] });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    await task.update({ userId: newUserId });
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { index, create, complete, reassign };
