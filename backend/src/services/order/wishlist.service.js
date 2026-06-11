const Wishlist = require('../../models/Product.model'); // Assuming wishlist stored as part of user or separate
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class WishlistService {
  /**
   * Add to wishlist
   */
  async addToWishlist(userId, productId) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { wishlist: productId } },
      { new: true }
    ).populate('wishlist', 'name price images seller');

    return user.wishlist;
  }

  /**
   * Remove from wishlist
   */
  async removeFromWishlist(userId, productId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: productId } },
      { new: true }
    ).populate('wishlist', 'name price images seller');

    return user.wishlist;
  }

  /**
   * Get wishlist
   */
  async getWishlist(userId, options = {}) {
    const { page = 1, limit = 20 } = options;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const skip = (page - 1) * limit;

    const wishlist = await User.aggregate([
      { $match: { _id: user._id } },
      {
        $lookup: {
          from: 'products',
          localField: 'wishlist',
          foreignField: '_id',
          as: 'wishlistItems',
        },
      },
      { $unwind: '$wishlistItems' },
      { $sort: { 'wishlistItems.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = user.wishlist.length;

    return {
      items: wishlist.map((w) => w.wishlistItems),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Check if product in wishlist
   */
  async isInWishlist(userId, productId) {
    const user = await User.findById(userId);
    return user.wishlist.includes(productId);
  }

  /**
   * Get wishlist count
   */
  async getWishlistCount(userId) {
    const user = await User.findById(userId);
    return user.wishlist.length;
  }

  /**
   * Clear wishlist
   */
  async clearWishlist(userId) {
    await User.findByIdAndUpdate(userId, { wishlist: [] });
    return { success: true };
  }

  /**
   * Compare products from wishlist
   */
  async compareProducts(userId, productIds) {
    const products = await Product.find({ _id: { $in: productIds } });
    return products;
  }
}

module.exports = new WishlistService();
