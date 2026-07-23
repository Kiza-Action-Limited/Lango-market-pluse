const express = require('express');
const { body, param, query } = require('express-validator');
const sellerController = require('../../controllers/seller.controller');
const { protect } = require('../../middleware/auth');
const { uploadDocuments, handleUploadError } = require('../../middleware/upload');

const router = express.Router();

router.get(
  '/journal',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('productId').optional().isMongoId(),
    query('entryType').optional().isIn(['all', 'offline_sale', 'offline_purchase', 'expense', 'return', 'stock_adjustment']),
  ],
  sellerController.getJournalEntries
);

router.post(
  '/journal',
  protect,
  [
    body('productId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Choose a valid product'),
    body('entryType').optional().isIn(['offline_sale', 'offline_purchase', 'expense', 'return', 'stock_adjustment']),
    body('adjustmentMode').optional().isIn(['add', 'subtract', 'set', 'none']),
    body('inventoryAction').optional().isIn(['increase', 'decrease', 'set', 'none']),
    body('affectsMainAccount').optional().isBoolean().toBoolean(),
    body('returnSettlement').optional().isIn(['customer_refund', 'supplier_refund', 'no_cash']),
    body('quantity').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Quantity must be zero or more'),
    body('unitCost').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Unit cost must be zero or more'),
    body('unitPrice').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Unit price must be zero or more'),
    body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Amount must be zero or more'),
    body('discount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('tax').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('charges').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('paymentMethod').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('partyName').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body('partyPhone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('partyType').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
    body('category').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
    body('status').optional().isIn(['draft', 'completed', 'cancelled', 'refunded']),
    body('supplierName').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body('reference').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('purchasedAt').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  ],
  sellerController.createJournalEntry
);

router.get('/export/:type', protect, param('type').isIn([
  'products',
  'orders',
  'rfqs',
  'reviews',
  'logistics',
  'transactions',
  'payments',
  'subscriptions',
  'documents',
]), sellerController.exportRecordsCsv);

router.post(
  '/premium-verification',
  protect,
  uploadDocuments.single('licenseDocument'),
  handleUploadError,
  [
    body('storefrontName').trim().isLength({ min: 2, max: 120 }).withMessage('Storefront name is required'),
    body('governmentBusinessName').trim().isLength({ min: 2, max: 160 }).withMessage('Government business name is required'),
    body('businessEmail').isEmail().withMessage('Valid business email is required'),
    body('businessUrls').custom((value) => {
      if (!value) return false;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (error) {
        return String(value).trim().length > 0;
      }
    }).withMessage('At least one business URL is required'),
    body('planId').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  ],
  sellerController.submitPremiumVerification
);

module.exports = router;
