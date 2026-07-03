'use strict';

const auditService = require('../services/auditService');

// Mapa de permisos por roleId
const ROLE_PERMISSIONS = {
  1: ['view_dashboard','view_clients','create_collection','authorize_payment','import_data','manage_users','manage_branches','manage_assignments','view_audit_logs','view_reports','manage_tasks','export_reports','manage_legal'],
  2: ['view_dashboard','view_clients','create_collection','authorize_payment','manage_assignments','view_reports','manage_tasks','export_reports','manage_legal'],
  3: ['view_dashboard','view_clients','create_collection','manage_tasks'],
  4: ['view_authorized_payments','update_payment_status'],
};

// Determina si la respuesta debe ser JSON o HTML
const shouldReturnJson = (req) =>
  req.method !== 'GET' ||
  req.path.startsWith('/api') ||
  req.xhr ||
  (req.headers.accept && req.headers.accept.includes('application/json'));

// Acepta múltiples permisos (OR): el usuario necesita al menos uno
const checkAnyPermission = (...permissions) => (req, res, next) => {
  const { userId, roleId, specialPermissions } = req.user;
  const sp = specialPermissions || {};
  const rolePerms = ROLE_PERMISSIONS[roleId] || [];

  for (const permission of permissions) {
    if (Object.prototype.hasOwnProperty.call(sp, permission)) {
      if (sp[permission] === true) return next();
      continue; // override negativo — prueba el siguiente
    }
    if (rolePerms.includes(permission)) return next();
  }

  auditService.log({ userId, action: 'access.denied', entity: permissions.join('|'), ipAddress: req.ip, userAgent: req.get('user-agent') });
  return shouldReturnJson(req)
    ? res.status(403).json({ success: false, message: 'Acceso denegado' })
    : res.status(403).render('error', { title: 'Acceso denegado', message: 'No tienes permiso para ver esta página.', status: 403, stack: null, user: req.user });
};

const checkPermission = (permission) => (req, res, next) => {
  const { userId, roleId, specialPermissions } = req.user;
  const sp = specialPermissions || {};

  // Override explícito en specialPermissions
  if (Object.prototype.hasOwnProperty.call(sp, permission)) {
    if (sp[permission] === true) return next();
    auditService.log({ userId, action: 'access.denied', entity: permission, ipAddress: req.ip, userAgent: req.get('user-agent') });
    return shouldReturnJson(req)
      ? res.status(403).json({ success: false, message: 'Acceso denegado' })
      : res.status(403).render('error', { title: 'Acceso denegado', message: 'No tienes permiso para ver esta página.', status: 403, stack: null, user: req.user });
  }

  // Verificar permisos del rol
  const rolePerms = ROLE_PERMISSIONS[roleId] || [];
  if (rolePerms.includes(permission)) return next();

  auditService.log({ userId, action: 'access.denied', entity: permission, ipAddress: req.ip, userAgent: req.get('user-agent') });
  return shouldReturnJson(req)
    ? res.status(403).json({ success: false, message: 'Acceso denegado' })
    : res.status(403).render('error', { title: 'Acceso denegado', message: 'No tienes permiso para ver esta página.', status: 403, stack: null, user: req.user });
};

module.exports = checkPermission;
module.exports.checkAnyPermission = checkAnyPermission;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
