'use strict';

const path   = require('path');
const router = require('express').Router();
const multer = require('multer');
const checkPermission = require('../middlewares/checkPermission');
const { index, show, importData, create, createContact, deleteContact, showMap } = require('../controllers/clientController');
const { createClientRules, createContactRules } = require('../middlewares/validate');
const { sensitive } = require('../middlewares/rateLimiter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
    cb(Object.assign(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), { status: 422 }));
  },
});

router.get('/',                         checkPermission('view_clients'), index);
router.post('/',                        checkPermission('import_data'), createClientRules, create);
router.get('/:id',                      checkPermission('view_clients'), show);
router.get('/:id/map',                  checkPermission('view_clients'), showMap);
router.post('/import',                  sensitive, checkPermission('import_data'), upload.single('file'), importData);
router.post('/:id/contacts',            checkPermission('view_clients'), createContactRules, createContact);
router.delete('/:id/contacts/:cid',     checkPermission('view_clients'), deleteContact);

module.exports = router;
