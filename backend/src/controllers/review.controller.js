const reviewService = require('../services/payment/review.service');
const { validationResult } = require('express-validator');

/**
 * Create review
 * POST /api/v1/reviews
 */
exports.createReview = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const review = await reviewService.createReview(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product reviews
 * GET /api/v1/reviews/product/:productId
 */
exports.getProductReviews = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { page = 1, limit = 20, rating } = req.query;

    const result = await reviewService.getProductReviews(productId, {
      page: parseInt(page),
      limit: parseInt(limit),
      rating: rating ? parseInt(rating) : null,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seller reviews
 * GET /api/v1/reviews/seller/:sellerId
 */
exports.getSellerReviews = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sellerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await reviewService.getSellerReviews(sellerId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark helpful
 * POST /api/v1/reviews/:id/helpful
 */
exports.markHelpful = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const review = await reviewService.markHelpful(req.params.id);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark unhelpful
 * POST /api/v1/reviews/:id/unhelpful
 */
exports.markUnhelpful = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const review = await reviewService.markUnhelpful(req.params.id);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add seller response
 * POST /api/v1/reviews/:id/response
 */
exports.addSellerResponse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { comment } = req.body;

    const review = await reviewService.addSellerResponse(id, req.user.id, comment);
    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete review
 * DELETE /api/v1/reviews/:id
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await reviewService.deleteReview(
      req.params.id,
      req.user.id,
      req.user.role === 'admin'
    );

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
