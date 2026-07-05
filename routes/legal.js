'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const os      = require('os');
const checkPermission = require('../middlewares/checkPermission');
const { index, show, create, update, uploadDocument, deleteDocument, exportReportPdf } = require('../controllers/legalController');
const { createLegalCaseRules, updateLegalCaseRules } = require('../middlewares/validate');

// Archivos temporales; el controller los mueve al destino final
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/',                        checkPermission('manage_legal'), index);
router.post('/',                       checkPermission('manage_legal'), createLegalCaseRules, create);
router.get('/:id',                     checkPermission('manage_legal'), show);
router.get('/:id/report',              checkPermission('manage_legal'), exportReportPdf);
router.patch('/:id',                   checkPermission('manage_legal'), updateLegalCaseRules, update);
router.post('/:id/documents',          checkPermission('manage_legal'), upload.single('file'), uploadDocument);
router.delete('/:id/documents/:docId', checkPermission('manage_legal'), deleteDocument);

module.exports = router;
