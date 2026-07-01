'use strict';

const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { index, exportExcel, updateSettings } = require('../controllers/reportController');
const { reportPdf } = require('../controllers/pdfController');

router.get('/',          checkPermission('view_reports'),   index);
router.get('/pdf',       checkPermission('view_reports'),   reportPdf);
router.get('/export',    checkPermission('export_reports'), exportExcel);
router.put('/settings',  checkPermission('view_reports'),   updateSettings);

module.exports = router;
