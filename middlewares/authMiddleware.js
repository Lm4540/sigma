'use strict';

const jwt = require('jsonwebtoken');
const { RevokedToken, User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      // Para rutas de API retorna JSON; para vistas redirige al login
      if (req.path.startsWith('/api')) return res.status(401).json({ success: false, message: 'No autenticado' });
      return res.redirect('/login');
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      if (req.path.startsWith('/api')) return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
      return res.redirect('/login');
    }

    // Verificar revocación
    const revoked = await RevokedToken.findOne({ where: { jti: payload.jti } });
    if (revoked) {
      if (req.path.startsWith('/api')) return res.status(401).json({ success: false, message: 'Sesión revocada' });
      return res.redirect('/login');
    }

    req.user = payload; // { userId, roleId, branchId, jti }

    // Regenerar el token con cada petición (Rolling Session)
    const newToken = jwt.sign(
      { userId: payload.userId, roleId: payload.roleId, branchId: payload.branchId, jti: payload.jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Exponer webAuthnEnabled al frontend
    try {
      const u = await User.findByPk(payload.userId, { attributes: ['webAuthnEnabled'] });
      if (u) res.locals.webAuthnEnabled = !!u.webAuthnEnabled;
    } catch (_) {}

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
