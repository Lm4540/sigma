'use strict';

const router = require('express').Router();
const { login, logout, showLogin } = require('../controllers/authController');
const { sensitive } = require('../middlewares/rateLimiter');
const { loginRules } = require('../middlewares/validate');

router.get('/login',  showLogin);
router.post('/login', sensitive, loginRules, login);
router.get('/logout', logout);

// Raíz → redirige a dashboard o login
router.get('/', (req, res) => res.redirect(req.cookies?.token ? '/dashboard' : '/login'));

module.exports = router;
