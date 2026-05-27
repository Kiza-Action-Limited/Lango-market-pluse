const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../../controllers/notification.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');
const { validate } = require('../../middleware/validation');

const router = express.Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Notifications API is available',
    endpoints: [
      '/sms',
      '/push',
      '/email',
      '/register-token',
      '/preferences'
    ]
  });
});

router.post(
  '/sms',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('message').notEmpty().withMessage('Message is required'),
  ],
  validate,
  subscriptionGate('smart', 'smsGateway'),
  subscriptionGate.checkCredits(1),
  notificationController.sendSMS
);

router.post(
  '/push',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
  ],
  notificationController.sendPush
);

router.post(
  '/email',
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('html').notEmpty().withMessage('Email HTML body is required'),
  ],
  notificationController.sendEmail
);

router.post(
  '/register-token',
  [
    body('token').notEmpty().withMessage('Push token is required'),
  ],
  notificationController.registerPushToken
);

router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

module.exports = router;
