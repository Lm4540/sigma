'use strict';

const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { registrationOptions, registrationVerify, authOptions, authVerify, deleteCredentials } = require('../controllers/webauthnController');

// Registro (requiere sesión activa — post primer login con password)
router.post('/register-options', authMiddleware, registrationOptions);
router.post('/register',         authMiddleware, registrationVerify);

// Eliminar credenciales biométricas (requiere sesión)
router.delete('/credentials',    authMiddleware, deleteCredentials);

// Autenticación biométrica (pública — antes del login)
router.post('/auth-options',  authOptions);
router.post('/authenticate',  authVerify);

module.exports = router;
