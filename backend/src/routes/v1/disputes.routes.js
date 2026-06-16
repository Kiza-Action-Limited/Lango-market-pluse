const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const disputeController = require('../../controllers/dispute.controller');
const { protect } = require('../../middleware/auth');

// All dispute routes require authentication
router.use(protect);

// GET /api/v1/disputes/my-disputes - Get logged-in user's disputes
router.get('/my-disputes', disputeController.getMyDisputes);

// GET /api/v1/disputes/stats - Get dispute statistics
router.get('/stats', disputeController.getDisputeStats);

// GET /api/v1/disputes - Get all disputes
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'partial_refund', 'closed']),
    query('reason').optional().isIn(['product_not_received', 'quality_issue', 'quantity_mismatch', 'damaged_goods', 'late_delivery', 'other']),
    query('orderId').optional().isMongoId(),
    query('raisedBy').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  disputeController.getDisputes
);

// POST /api/v1/disputes - Create new dispute
router.post(
  '/',
  [
    body('orderId').isMongoId().withMessage('Valid order ID is required'),
    body('reason').isIn(['product_not_received', 'quality_issue', 'quantity_mismatch', 'damaged_goods', 'late_delivery', 'other'])
      .withMessage('Valid reason is required'),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('evidence').optional().isArray(),
    body('evidenceUrls').optional().isArray(),
  ],
  disputeController.createDispute
);

// GET /api/v1/disputes/:id - Get dispute by ID
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid dispute ID')],
  disputeController.getDisputeById
);

// POST /api/v1/disputes/:id/messages - Add message
router.post(
  '/:id/messages',
  [
    param('id').isMongoId(),
    body('message').notEmpty().isString().isLength({ min: 1, max: 1000 }),
  ],
  disputeController.addMessage
);

// POST /api/v1/disputes/:id/evidence - Add evidence
router.post(
  '/:id/evidence',
  [
    param('id').isMongoId(),
    body('evidence').optional().isString(),
    body('evidenceUrl').optional().isURL(),
  ],
  disputeController.addEvidence
);

// PUT /api/v1/disputes/:id/resolve - Resolve dispute (admin only)
router.put(
  '/:id/resolve',
  [
    param('id').isMongoId(),
    body('resolution').isIn(['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled']),
    body('resolutionAmount').optional().isFloat({ min: 0 }),
    body('faultParty').optional().isMongoId(),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  disputeController.resolveDispute
);

// PUT /api/v1/disputes/:id/status - Update dispute status (admin only)
router.put(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn(['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'partial_refund', 'closed']),
  ],
  disputeController.updateStatus
);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn(['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'partial_refund', 'closed']),
  ],
  disputeController.updateStatus
);

// DELETE /api/v1/disputes/:id - Close dispute (admin only)
router.delete(
  '/:id',
  [param('id').isMongoId()],
  disputeController.closeDispute
);

module.exports = router;
