'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index, assign } = require('../controllers/assignmentController');
const { assignmentRules } = require('../middlewares/validate');

router.get('/',  checkPermission('manage_assignments'), index);
router.post('/', checkPermission('manage_assignments'), assignmentRules, assign);

module.exports = router;
