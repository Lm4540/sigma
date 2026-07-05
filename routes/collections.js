'use strict';

const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const checkPermission = require('../middlewares/checkPermission');
const { create, authorizePayment, applyPayment, pendingPayments, listCollections } = require('../controllers/collectionController');
const { sensitive } = require('../middlewares/rateLimiter');
const { checkAnyPermission } = require('../middlewares/checkPermission');
const { createCollectionRules, paymentActionRules } = require('../middlewares/validate');

const ALLOWED_EVIDENCE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/evidence'),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EVIDENCE_EXTS.includes(ext)) return cb(null, true);
    cb(Object.assign(new Error('Tipo de archivo no permitido. Use: JPG, PNG, WebP, HEIC o PDF.'), { status: 422 }));
  },
});

router.post('/',             sensitive, checkPermission('create_collection'), upload.single('evidence'), createCollectionRules, create);
router.get('/list',          checkAnyPermission('view_clients', 'view_dashboard'), listCollections);
router.get('/pending',       checkAnyPermission('authorize_payment', 'view_authorized_payments', 'review_payment'), pendingPayments);
router.patch('/:id/payment', checkAnyPermission('authorize_payment', 'review_payment'), paymentActionRules, authorizePayment);
router.patch('/:id/apply',   checkPermission('update_payment_status'), applyPayment);

module.exports = router;
