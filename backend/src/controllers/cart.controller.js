const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

const normalizeCartResponse = (cart) => ({
  items: (cart?.items || []).map((item) => ({
    _id: item._id,
    productId: item.product,
    name: item.name,
    price: item.price,
    image: item.image,
    quantity: item.quantity,
    variant: item.variant,
    stock: item.stock,
    seller: item.seller,
    minOrderQuantity: item.minOrderQuantity || 1,
  })),
  coupon: cart?.coupon?.code ? cart.coupon : null,
});

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

exports.getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    return res.status(200).json({
      success: true,
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, variant = null } = req.body;
    const parsedQuantity = Math.max(1, Number(quantity) || 1);

    const product = await Product.findById(productId).populate('seller', 'fullName businessName');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.isPublished === false) {
      return res.status(400).json({ success: false, message: 'Product is not available' });
    }

    const stock = Number(product.quantityAvailable ?? product.stock ?? 0);
    const minOrderQuantity = 1;
    const safeQuantity = Math.max(minOrderQuantity, parsedQuantity);

    const cart = await getOrCreateCart(req.user.id);

    const existingIndex = cart.items.findIndex(
      (item) =>
        String(item.product) === String(product._id) &&
        JSON.stringify(item.variant || null) === JSON.stringify(variant || null)
    );

    if (existingIndex !== -1) {
      cart.items[existingIndex].quantity += safeQuantity;
      cart.items[existingIndex].price = Number(product.price || 0);
      cart.items[existingIndex].stock = stock;
      cart.items[existingIndex].name = product.name;
      cart.items[existingIndex].image = product.images?.[0] || null;
    } else {
      cart.items.push({
        product: product._id,
        name: product.name,
        price: Number(product.price || 0),
        image: product.images?.[0] || null,
        quantity: safeQuantity,
        variant,
        stock,
        seller: product.seller?._id || product.seller,
        minOrderQuantity,
      });
    }

    await cart.save();
    return res.status(200).json({
      success: true,
      message: 'Added to cart',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateQuantity = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;
    const parsedQuantity = Math.max(1, Number(quantity) || 1);
    const cart = await getOrCreateCart(req.user.id);

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    item.quantity = parsedQuantity;
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const cart = await getOrCreateCart(req.user.id);
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    item.deleteOne();
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item removed',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    cart.coupon = { code: null, type: null, value: null };
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.mergeCart = async (req, res, next) => {
  try {
    const incomingItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const cart = await getOrCreateCart(req.user.id);

    for (const incoming of incomingItems) {
      const productId = incoming.productId || incoming.product;
      const quantity = Math.max(1, Number(incoming.quantity) || 1);
      if (!productId) continue;

      const product = await Product.findById(productId).select('name price images quantityAvailable seller isPublished');
      if (!product || product.isPublished === false) continue;

      const existingIndex = cart.items.findIndex(
        (item) => String(item.product) === String(product._id)
      );

      if (existingIndex !== -1) {
        cart.items[existingIndex].quantity += quantity;
      } else {
        cart.items.push({
          product: product._id,
          name: product.name,
          price: Number(product.price || 0),
          image: product.images?.[0] || null,
          quantity,
          variant: incoming.variant || null,
          stock: Number(product.quantityAvailable ?? 0),
          seller: product.seller,
          minOrderQuantity: 1,
        });
      }
    }

    await cart.save();
    return res.status(200).json({
      success: true,
      message: 'Cart merged',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

exports.applyCoupon = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Coupon service is not configured yet.',
  });
};

exports.removeCoupon = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.coupon = { code: null, type: null, value: null };
    await cart.save();
    return res.status(200).json({
      success: true,
      message: 'Coupon removed',
      ...normalizeCartResponse(cart),
    });
  } catch (error) {
    return next(error);
  }
};

