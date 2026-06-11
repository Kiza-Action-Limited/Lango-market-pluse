const Cart = require('../../models/Cart.model');
const Product = require('../../models/Product.model');
const logger = require('../../utils/logger');

class CartService {
  /**
   * Get or create cart
   */
  async getCart(userId) {
    let cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name price images stock seller');

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(userId, productId, quantity) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error('Insufficient stock');

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
      });
    }

    await cart.save();
    return cart.populate('items.product', 'name price images stock seller');
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId, productId) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new Error('Cart not found');

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();
    return cart.populate('items.product');
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(userId, productId, quantity) {
    if (quantity < 1) {
      return this.removeItem(userId, productId);
    }

    const product = await Product.findById(productId);
    if (product.stock < quantity) throw new Error('Insufficient stock');

    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new Error('Cart not found');

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) throw new Error('Item not in cart');

    item.quantity = quantity;
    await cart.save();
    return cart.populate('items.product');
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });
    return { success: true };
  }

  /**
   * Get cart total
   */
  async getCartTotal(userId) {
    const cart = await Cart.findOne({ user: userId }).populate(
      'items.product',
      'price'
    );

    if (!cart || cart.items.length === 0) {
      return { total: 0, itemCount: 0, items: [] };
    }

    let total = 0;
    cart.items.forEach((item) => {
      total += item.product.price * item.quantity;
    });

    return {
      total: parseFloat(total.toFixed(2)),
      itemCount: cart.items.length,
      items: cart.items,
    };
  }

  /**
   * Validate cart items
   */
  async validateCartItems(userId) {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) throw new Error('Cart not found');

    const validItems = [];
    const invalidItems = [];

    for (const item of cart.items) {
      if (!item.product || item.product.stock < item.quantity) {
        invalidItems.push(item.product?._id);
      } else {
        validItems.push(item);
      }
    }

    if (invalidItems.length > 0) {
      cart.items = validItems;
      await cart.save();
    }

    return { validItems, invalidItems };
  }
}

module.exports = new CartService();
