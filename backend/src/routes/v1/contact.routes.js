const express = require('express');
const { body } = require('express-validator');
const supportController = require('../../controllers/support.controller');

const router = express.Router();

router.post(
  '/',
  [
    body('fullName').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Full name must be 2-120 characters'),
    body('name').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
    body('email').isEmail().withMessage('Valid email address is required'),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ min: 7, max: 32 }).withMessage('Phone number must be 7-32 characters'),
    body('inquiryType').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 40 }).withMessage('Inquiry type is invalid'),
    body('subject').trim().isLength({ min: 5, max: 160 }).withMessage('Subject must be 5-160 characters'),
    body('message').trim().isLength({ min: 10, max: 3000 }).withMessage('Message must be 10-3000 characters'),
    body('consent').optional().custom((value) => value === true || value === 'true').withMessage('Consent is required'),
    body('source').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
    body('submittedAt').optional({ checkFalsy: true }).isISO8601().withMessage('submittedAt must be a valid ISO date'),
  ],
  supportController.createPublicContactMessage
);

module.exports = router;
