const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const reviewController = require('../../controllers/review.controller');
const { protect } = require('../../middleware/auth');

router.use(protect);

/**
 * Create review
 */
router.post(
  '/',
  [
    body('productId').isMongoId(),
    body('orderId').isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('title').isString().trim().isLength({ min: 5, max: 100 }),
    body('comment').isString().trim().isLength({ min: 10, max: 1000 }),
  ],
  reviewController.createReview
);

/**
 * Get product reviews
 */
router.get(
  '/product/:productId',
  [
    param('productId').isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('rating').optional().isInt({ min: 1, max: 5 }),
  ],
  reviewController.getProductReviews
);

/**
 * Get seller reviews
 */
router.get(
  '/seller/:sellerId',
  [
    param('sellerId').isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  reviewController.getSellerReviews
);

/**
 * Mark helpful
 */
router.post(
  '/:id/helpful',
  [param('id').isMongoId()],
  reviewController.markHelpful
);

/**
 * Mark unhelpful
 */
router.post(
  '/:id/unhelpful',
  [param('id').isMongoId()],
  reviewController.markUnhelpful
);

/**
 * Add seller response
 */
router.post(
  '/:id/response',
  [
    param('id').isMongoId(),
    body('comment').isString().trim().isLength({ min: 10 }),
  ],
  reviewController.addSellerResponse
);

/**
 * Delete review
 */
router.delete(
  '/:id',
  [param('id').isMongoId()],
  reviewController.deleteReview
);

module.exports = router;
