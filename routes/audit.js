'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index } = require('../controllers/auditController');

router.get('/', checkPermission('view_audit_logs'), index);

module.exports = router;
