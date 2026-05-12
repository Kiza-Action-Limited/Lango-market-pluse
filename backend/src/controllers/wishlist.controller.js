const User = require('../models/User.model');
const Product = require('../models/Product.model');

const toWishlistItem = (entry) => {
  const product = entry.product;
  if (!product) return null;

  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  const image = typeof firstImage === 'string' ? firstImage : firstImage?.url || null;

  return {
    id: String(product._id),
    productId: String(product._id),
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice || null,
    image,
    addedAt: entry.addedAt,
  };
};

exports.getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist.product');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const items = (user.wishlist || []).map(toWishlistItem).filter(Boolean);
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

exports.checkWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('wishlist');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isWishlisted = (user.wishlist || []).some(
      (entry) => String(entry.product) === String(req.params.productId)
    );

    return res.status(200).json({ success: true, isWishlisted });
  } catch (error) {
    return next(error);
  }
};

exports.addToWishlist = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(req.user.id).select('wishlist');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const exists = (user.wishlist || []).some(
      (entry) => String(entry.product) === String(req.params.productId)
    );

    if (!exists) {
      user.wishlist.push({ product: product._id });
      await user.save();
    }

    return res.status(200).json({ success: true, message: 'Added to wishlist' });
  } catch (error) {
    return next(error);
  }
};

exports.removeFromWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('wishlist');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.wishlist = (user.wishlist || []).filter(
      (entry) => String(entry.product) !== String(req.params.productId)
    );
    await user.save();

    return res.status(200).json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    return next(error);
  }
};
