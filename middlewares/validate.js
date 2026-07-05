'use strict';

const { body, validationResult } = require('express-validator');

/**
 * Ejecuta el resultado de validación y devuelve 422 si hay errores.
 * Siempre debe ser el ÚLTIMO elemento del array de validadores de una ruta.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(422).json({
      success: false,
      message: first.msg,
      errors: errors.array(),
    });
  }
  next();
};

/* ── Auth ───────────────────────────────────────────────── */
const loginRules = [
  body('email').isEmail().withMessage('Correo electrónico inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
  handleValidation,
];

/* ── Usuarios ───────────────────────────────────────────── */
const createUserRules = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('email').isEmail().withMessage('Correo electrónico inválido').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('roleId').isInt({ min: 1 }).withMessage('Rol inválido'),
  handleValidation,
];

const updateUserRules = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('email').isEmail().withMessage('Correo electrónico inválido').normalizeEmail(),
  body('roleId').isInt({ min: 1 }).withMessage('Rol inválido'),
  handleValidation,
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria'),
  body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  handleValidation,
];

/* ── Colecciones ────────────────────────────────────────── */
const createCollectionRules = [
  body('clientId').isInt({ min: 1 }).withMessage('Cliente inválido'),
  body('type').isIn(['Visita', 'Llamada', 'WhatsApp', 'Mensaje']).withMessage('Tipo de gestión inválido'),
  body('comment').trim().notEmpty().withMessage('El comentario es obligatorio'),
  body('paymentAmount').optional({ nullable: true, checkFalsy: true })
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Monto de pago inválido'),
  body('paymentType').optional({ nullable: true, checkFalsy: true })
    .isIn(['efectivo', 'nota_abono', 'especie', 'cheque', 'transferencia']).withMessage('Tipo de pago inválido'),
  handleValidation,
];

const paymentActionRules = [
  body('action').isIn(['autorizar', 'rechazar', 'solicitar_autorizacion']).withMessage('Acción inválida'),
  handleValidation,
];

/* ── Asignaciones ───────────────────────────────────────── */
const assignmentRules = [
  body('clientId').isInt({ min: 1 }).withMessage('Cliente inválido'),
  body('userId').isInt({ min: 1 }).withMessage('Gestor inválido'),
  handleValidation,
];

/* ── Tareas ─────────────────────────────────────────────── */
const createTaskRules = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio'),
  body('dueDate').isISO8601().withMessage('Fecha de vencimiento inválida'),
  body('priority').optional().isIn(['baja', 'media', 'alta']).withMessage('Prioridad inválida'),
  handleValidation,
];

/* ── Clientes ───────────────────────────────────────────── */
const createClientRules = [
  body('name').trim().notEmpty().withMessage('El nombre del cliente es obligatorio'),
  body('clientCode').optional({ checkFalsy: true }).trim(),
  body('loanNumber').optional({ checkFalsy: true }).trim(),
  body('daysLate').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Días mora inválido'),
  body('balance').optional({ checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).withMessage('Saldo inválido'),
  body('insurance').optional({ checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).withMessage('Seguro inválido'),
  body('otherFees').optional({ checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).withMessage('Otros cargos inválido'),
  body('nextPaymentDate').optional({ checkFalsy: true }).isDate().withMessage('Fecha de próximo pago inválida'),
  handleValidation,
];

/* ── Tareas: reasignación ───────────────────────────────── */
const reassignTaskRules = [
  body('userId').isInt({ min: 1 }).withMessage('Usuario inválido'),
  handleValidation,
];

/* ── Procesos legales ───────────────────────────────────────── */
const createLegalCaseRules = [
  body('clientId').isInt({ min: 1 }).withMessage('Cliente inválido'),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Las notas no pueden superar 2000 caracteres'),
  handleValidation,
];

const updateLegalCaseRules = [
  body('status').optional().isIn(['activo', 'resuelto', 'archivado']).withMessage('Estado inválido'),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Las notas no pueden superar 2000 caracteres'),
  handleValidation,
];

/* ── Contactos ──────────────────────────────────────────────── */
const createContactRules = [
  body('phone').trim().notEmpty().withMessage('El teléfono es obligatorio').isLength({ max: 20 }).withMessage('Teléfono demasiado largo'),
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('Nombre demasiado largo'),
  body('relationship').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Relación demasiado larga'),
  handleValidation,
];

/* ── Sucursales ─────────────────────────────────────────── */
const branchRules = [
  body('name').trim().notEmpty().withMessage('El nombre de la sucursal es obligatorio'),
  handleValidation,
];

module.exports = {
  loginRules,
  createUserRules,
  updateUserRules,
  changePasswordRules,
  createCollectionRules,
  paymentActionRules,
  assignmentRules,
  createTaskRules,
  reassignTaskRules,
  createClientRules,
  createLegalCaseRules,
  updateLegalCaseRules,
  createContactRules,
  branchRules,
};
