const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const userController = require('../../controllers/user.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');

// Protected routes
router.use(authMiddleware);

router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);
router.delete('/me', userController.deactivateAccount);

// Admin only
router.get('/', rbacMiddleware(['admin']), userController.getAllUsers);
router.get('/:id', rbacMiddleware(['admin']), param('id').isMongoId(), userController.getUserById);
router.put('/:id/wallet', rbacMiddleware(['admin']), [
  param('id').isMongoId(),
  body('amount').isNumeric(),
  body('operation').isIn(['credit', 'debit']),
], userController.updateWallet);

module.exports = router;