'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index, create, complete, reassign } = require('../controllers/taskController');
const { createTaskRules, reassignTaskRules } = require('../middlewares/validate');

router.get('/',                checkPermission('manage_tasks'), index);
router.post('/',               checkPermission('manage_tasks'), createTaskRules, create);
router.patch('/:id/complete',  checkPermission('manage_tasks'), complete);
router.patch('/:id/reassign',  checkPermission('manage_tasks'), reassignTaskRules, reassign);

module.exports = router;
