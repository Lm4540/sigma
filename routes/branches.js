'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index, create, update, toggleStatus } = require('../controllers/branchController');
const { branchRules } = require('../middlewares/validate');

router.get('/',             checkPermission('manage_branches'), index);
router.post('/',            checkPermission('manage_branches'), branchRules, create);
router.put('/:id',          checkPermission('manage_branches'), branchRules, update);
router.patch('/:id/status', checkPermission('manage_branches'), toggleStatus);

module.exports = router;
