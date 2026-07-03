'use strict';

const bcrypt = require('bcryptjs');
const { User, Role, Branch, RevokedToken, UserCredential } = require('../models');
const auditService = require('../services/auditService');

const index = async (req, res, next) => {
  try {
    const users = await User.findAll({
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Branch, as: 'branch', attributes: ['id', 'name'] },
      ],
      order: [['name', 'ASC']],
    });
    const [roles, branches] = await Promise.all([
      Role.findAll({ where: { status: 'on' } }),
      Branch.findAll({ where: { status: 'on' } }),
    ]);
    res.render('users/index', { title: 'Usuarios', user: req.user, users, roles, branches });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, email, password, roleId, branchId } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hash, roleId, branchId: branchId || null, createdBy: req.user.userId });
    res.status(201).json({ success: true, data: { id: newUser.id } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const target = await User.scope('withPassword').findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const { name, email, roleId, branchId, specialPermissions } = req.body;
    const previousValue = { name: target.name, email: target.email, roleId: target.roleId };

    await target.update({ name, email, roleId, branchId: branchId || null, specialPermissions: specialPermissions || null });

    auditService.log({ userId: req.user.userId, action: 'user.updated', entity: 'Users', entityId: target.id, previousValue, newValue: { name, email, roleId }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const toggleStatus = async (req, res, next) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const newStatus = target.status === 'on' ? 'off' : 'on';
    await target.update({ status: newStatus });
    res.json({ success: true, status: newStatus });
  } catch (err) { next(err); }
};

const unlock = async (req, res, next) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await target.update({ loginAttempts: 0, lockUntil: null });
    auditService.log({ userId: req.user.userId, action: 'user.unlocked', entity: 'Users', entityId: target.id, ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const target = await User.scope('withPassword').findByPk(req.user.userId);

    const valid = await bcrypt.compare(currentPassword, target.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(newPassword, 10);
    await target.update({ password: hash });

    // Revocar sesión actual
    const jwt = require('jsonwebtoken');
    const token = req.cookies?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        await RevokedToken.create({ jti: payload.jti, userId: payload.userId, expiresAt: new Date(payload.exp * 1000) });
      } catch { /* ignorar */ }
    }

    auditService.log({ userId: req.user.userId, action: 'user.password_changed', entity: 'Users', entityId: req.user.userId, ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.clearCookie('token');
    res.json({ success: true, redirect: '/login' });
  } catch (err) { next(err); }
};

const showProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Branch, as: 'branch', attributes: ['id', 'name'] },
      ]
    });
    if (!user) return res.redirect('/login');

    const credentials = await UserCredential.findAll({
      where: { userId: user.id }
    });

    res.render('users/profile', {
      title: 'Mi Perfil',
      user: req.user,
      profileUser: user,
      credentials
    });
  } catch (err) { next(err); }
};

module.exports = { index, create, update, toggleStatus, unlock, changePassword, showProfile };
