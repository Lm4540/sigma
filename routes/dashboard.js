'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index } = require('../controllers/dashboardController');

router.get('/', checkPermission('view_dashboard'), index);

module.exports = router;
