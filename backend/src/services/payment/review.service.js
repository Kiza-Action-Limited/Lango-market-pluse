const Review = require('../../models/Review.model');
const Order = require('../../models/Order.model');
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');

class ReviewService {
  /**
   * Create review
   */
  async createReview(data, reviewerId) {
    const { productId, orderId, rating, title, comment, images = [] } = data;

    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    if (order.buyer.toString() !== reviewerId.toString()) {
      throw new Error('Only order buyer can leave review');
    }

    const existingReview = await Review.findOne({ order: orderId });
    if (existingReview) throw new Error('Review already exists for this order');

    const review = new Review({
      product: productId,
      seller: product.seller,
      reviewer: reviewerId,
      order: orderId,
      rating,
      title,
      comment,
      images,
      verified: true,
    });

    await review.save();

    // Update product rating
    await this.updateProductRating(productId);

    return review.populate('reviewer', 'fullName').populate('seller', 'fullName');
  }

  /**
   * Get product reviews
   */
  async getProductReviews(productId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', rating = null } = options;

    const query = { product: productId };
    if (rating) query.rating = rating;

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewer', 'fullName')
        .lean(),
      Review.countDocuments(query),
    ]);

    return {
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update product rating
   */
  async updateProductRating(productId) {
    const reviews = await Review.find({ product: productId });

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0,
      });
      return;
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalRating / reviews.length).toFixed(2);

    await Product.findByIdAndUpdate(productId, {
      rating: parseFloat(averageRating),
      reviewCount: reviews.length,
    });
  }

  /**
   * Mark review helpful
   */
  async markHelpful(reviewId) {
    return Review.findByIdAndUpdate(reviewId, { $inc: { helpful: 1 } }, { new: true });
  }

  /**
   * Mark review unhelpful
   */
  async markUnhelpful(reviewId) {
    return Review.findByIdAndUpdate(reviewId, { $inc: { unhelpful: 1 } }, { new: true });
  }

  /**
   * Seller response
   */
  async addSellerResponse(reviewId, sellerId, comment) {
    const review = await Review.findById(reviewId);
    if (!review) throw new Error('Review not found');

    if (review.seller.toString() !== sellerId.toString()) {
      throw new Error('Only seller can respond');
    }

    review.sellerResponse = {
      comment,
      respondedAt: new Date(),
    };

    await review.save();
    return review;
  }

  /**
   * Get seller reviews
   */
  async getSellerReviews(sellerId, options = {}) {
    const { page = 1, limit = 20 } = options;

    const skip = (page - 1) * limit;

    const [reviews, stats] = await Promise.all([
      Review.find({ seller: sellerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('product', 'name')
        .populate('reviewer', 'fullName'),
      Review.aggregate([
        { $match: { seller: new (require('mongoose')).Types.ObjectId(sellerId) } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      reviews,
      stats: stats.length > 0 ? stats[0] : { averageRating: 0, totalReviews: 0 },
      pagination: { page, limit },
    };
  }

  /**
   * Delete review
   */
  async deleteReview(reviewId, userId, isAdmin = false) {
    const review = await Review.findById(reviewId);
    if (!review) throw new Error('Review not found');

    if (!isAdmin && review.reviewer.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    await Review.findByIdAndDelete(reviewId);
    await this.updateProductRating(review.product);

    return { success: true };
  }
}

module.exports = new ReviewService();
