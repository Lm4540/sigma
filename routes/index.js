'use strict';

const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');

router.use('/',           require('./auth'));
router.use('/auth/webauthn', require('./webauthn'));
router.use('/dashboard',  authMiddleware, require('./dashboard'));
router.use('/clients',    authMiddleware, require('./clients'));
router.use('/collections',authMiddleware, require('./collections'));
router.use('/assignments',authMiddleware, require('./assignments'));
router.use('/users',      authMiddleware, require('./users'));
router.use('/branches',   authMiddleware, require('./branches'));
router.use('/tasks',      authMiddleware, require('./tasks'));
router.use('/audit',      authMiddleware, require('./audit'));
router.use('/reports',    authMiddleware, require('./reports'));
router.use('/legal',      authMiddleware, require('./legal'));
router.get('/profile',    authMiddleware, require('../controllers/userController').showProfile);
router.use('/api',        authMiddleware, require('./api'));

module.exports = router;
