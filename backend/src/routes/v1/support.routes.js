const express = require('express');
const { body, param } = require('express-validator');
const supportController = require('../../controllers/support.controller');
const { protect, admin } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/messages', supportController.getMySupportMessages);
router.post(
  '/messages',
  [
    body('subject').trim().isLength({ min: 2, max: 160 }).withMessage('Subject is required'),
    body('message').trim().isLength({ min: 2, max: 3000 }).withMessage('Message is required'),
    body('category').optional().isIn(['general', 'account', 'orders', 'payments', 'products', 'logistics', 'technical']),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  ],
  supportController.createSupportMessage
);
router.post(
  '/messages/:messageId/replies',
  [
    param('messageId').isMongoId(),
    body('message').trim().isLength({ min: 2, max: 3000 }).withMessage('Message is required'),
  ],
  supportController.addUserReply
);

router.get('/admin/messages', admin, supportController.getAdminSupportMessages);
router.post(
  '/admin/messages/:messageId/replies',
  admin,
  [
    param('messageId').isMongoId(),
    body('message').trim().isLength({ min: 2, max: 3000 }).withMessage('Message is required'),
    body('channel').optional().isIn(['in_app', 'email', 'sms', 'all']),
    body('status').optional().isIn(['open', 'pending_admin', 'pending_user', 'resolved', 'closed']),
  ],
  supportController.adminReplyToSupportMessage
);
router.put(
  '/admin/messages/:messageId/status',
  admin,
  [
    param('messageId').isMongoId(),
    body('status').isIn(['open', 'pending_admin', 'pending_user', 'resolved', 'closed']),
  ],
  supportController.updateSupportMessageStatus
);

module.exports = router;
