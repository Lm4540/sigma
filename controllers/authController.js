'use strict';

const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { User, RevokedToken } = require('../models');
const auditService = require('../services/auditService');

const MAX_ATTEMPTS = 5;

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.scope('withPassword').findOne({ where: { email } });

    if (!user || user.status === 'off') {
      return res.status(401).render('auth/login', { error: 'Credenciales inválidas', email });
    }

    // Verificar bloqueo
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      return res.status(403).render('auth/login', { error: 'Cuenta bloqueada. Contacte al administrador.', email });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const attempts = (user.loginAttempts || 0) + 1;
      const update = { loginAttempts: attempts };
      if (attempts >= MAX_ATTEMPTS) update.lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.update(update);

      auditService.log({
        userId: user.id,
        action: attempts >= MAX_ATTEMPTS ? 'user.locked' : 'user.login_failed',
        entity: 'Users',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const msg = attempts >= MAX_ATTEMPTS
        ? 'Cuenta bloqueada por múltiples intentos fallidos'
        : `Credenciales inválidas. Intento ${attempts}/${MAX_ATTEMPTS}`;
      return res.status(401).render('auth/login', { error: msg, email });
    }

    // Login exitoso — resetear intentos
    await user.update({ loginAttempts: 0, lockUntil: null });

    const jti = uuidv4();
    const token = jwt.sign(
      { userId: user.id, roleId: user.roleId, branchId: user.branchId, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 8 * 60 * 60 * 1000,
    });

    auditService.log({
      userId: user.id,
      action: 'user.login',
      entity: 'Users',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Redirigir a la página de inicio según rol
    const LANDING = {
      1: '/dashboard',        // Administrador
      2: '/dashboard',        // Supervisor
      3: '/dashboard',        // Gestor
      4: '/collections/pending', // Secretaria
    };
    res.redirect(LANDING[user.roleId] || '/dashboard');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        await RevokedToken.create({
          jti: payload.jti,
          userId: payload.userId,
          expiresAt: new Date(payload.exp * 1000),
        });
        auditService.log({
          userId: payload.userId,
          action: 'user.logout',
          entity: 'Users',
          entityId: payload.userId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch { /* token ya expirado — ignorar */ }
    }
    res.clearCookie('token');
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
};

const showLogin = async (req, res) => {
  if (!req.cookies?.token) return res.render('auth/login', { error: null, email: '' });
  // Si ya tiene sesión redirigir a su landing según rol
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const LANDING = { 1: '/dashboard', 2: '/dashboard', 3: '/dashboard', 4: '/collections/pending' };
    return res.redirect(LANDING[payload.roleId] || '/dashboard');
  } catch {
    res.clearCookie('token');
    res.render('auth/login', { error: null, email: '' });
  }
};

module.exports = { login, logout, showLogin };
