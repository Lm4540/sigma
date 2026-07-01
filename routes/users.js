'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index, create, update, toggleStatus, unlock, changePassword } = require('../controllers/userController');
const { createUserRules, updateUserRules, changePasswordRules } = require('../middlewares/validate');

router.get('/',               checkPermission('manage_users'), index);
router.post('/',              checkPermission('manage_users'), createUserRules, create);
router.put('/:id',            checkPermission('manage_users'), updateUserRules, update);
router.patch('/:id/status',   checkPermission('manage_users'), toggleStatus);
router.patch('/:id/unlock',   checkPermission('manage_users'), unlock);
router.post('/change-password', changePasswordRules, changePassword);

module.exports = router;
