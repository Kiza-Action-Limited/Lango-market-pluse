const Order = require('../../models/Order.model');
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const productService = require('../inventory/product.service');
const escrowService = require('./escrow.service');
const { smsQueue } = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

class OrderService {
  async createOrder(orderData) {
    const { buyer, product, quantity, deliveryAddress } = orderData;

    // Get product details
    const productDoc = await Product.findById(product);
    if (!productDoc) throw new Error('Product not found');

    const seller = await User.findById(productDoc.seller).select('businessType');
    const sellerBusinessType = String(seller?.businessType || '').toLowerCase();
    const requiresBulkMinimum = sellerBusinessType === 'wholesaler' || sellerBusinessType === 'manufacturer';

    if (requiresBulkMinimum && Number(quantity) < 10) {
      throw new Error('Minimum order for wholesaler/manufacturer products is 10 pieces (MQQ1: 10-2,999, MQQ2: 3,000+)');
    }

    // Check stock
    if (productDoc.quantityAvailable - productDoc.reservedQuantity < quantity) {
      throw new Error('Insufficient stock');
    }

    // Reserve stock
    await productService.reserveStock(product, quantity);

    // Create order
    const order = await Order.create({
      buyer,
      seller: productDoc.seller,
      product,
      quantity,
      unitPrice: productDoc.price,
      deliveryAddress,
      qrChain: uuidv4(),
      status: 'pending_payment',
    });

    // Notify seller via SMS
    await smsQueue.add('send', {
      to: productDoc.seller.phone,
      message: `New order #${order._id} for ${quantity} ${productDoc.name}. Awaiting payment.`,
    });

    return order;
  }

  async getOrders(filters) {
    const { userId, userRole, page = 1, limit = 10, status, role } = filters;
    const query = {};

    if (role === 'buyer') query.buyer = userId;
    else if (role === 'seller') query.seller = userId;
    else {
      // For admin or if role not specified, show both
      query.$or = [{ buyer: userId }, { seller: userId }];
    }

    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const orders = await Order.find(query)
      .populate('buyer', 'fullName phone')
      .populate('seller', 'fullName phone')
      .populate('product', 'name images')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    return {
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(orderId, userId, userRole) {
    const order = await Order.findById(orderId)
      .populate('buyer', 'fullName phone')
      .populate('seller', 'fullName phone')
      .populate('product');
    if (!order) throw new Error('Order not found');

    // Check authorization
    if (userRole !== 'admin' && order.buyer._id.toString() !== userId && order.seller._id.toString() !== userId) {
      throw new Error('Unauthorized');
    }
    return order;
  }

  async cancelOrder(orderId, userId, userRole, reason) {
    const order = await this.getOrderById(orderId, userId, userRole);
    if (!['pending_payment', 'payment_escrowed'].includes(order.status)) {
      throw new Error('Order cannot be cancelled at this stage');
    }

    // Release reserved stock
    await productService.releaseReservedStock(order.product, order.quantity);

    // If payment was escrowed, refund
    if (order.status === 'payment_escrowed') {
      await escrowService.cancelEscrow(orderId, reason, userId);
    }

    order.status = 'cancelled';
    await order.save();

    // Notify both parties
    await smsQueue.add('send', {
      to: order.buyer.phone,
      message: `Order #${orderId} has been cancelled. Reason: ${reason}`,
    });

    return order;
  }

  async confirmDelivery(orderId, buyerId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.buyer.toString() !== buyerId) throw new Error('Unauthorized');
    if (order.status !== 'delivered') throw new Error('Order not yet delivered');

    order.status = 'completed';
    // Escrow will be auto-released by job, but we set escrowReleaseDate
    order.escrowReleaseDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await order.save();

    return order;
  }

  async updateOrderStatus(orderId, userId, userRole, nextStatus) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const isOwnerSeller = order.seller.toString() === userId;
    const isAdmin = userRole === 'admin';
    if (!isOwnerSeller && !isAdmin) {
      throw new Error('Unauthorized');
    }

    const allowedTransitions = {
      pending_payment: ['processing', 'cancelled'],
      payment_escrowed: ['processing', 'cancelled'],
      processing: ['dispatched', 'cancelled'],
      dispatched: ['delivered'],
      delivered: [],
      completed: [],
      cancelled: [],
      disputed: [],
    };

    const currentStatus = order.status;
    const allowedNext = allowedTransitions[currentStatus] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${nextStatus}`);
    }

    order.status = nextStatus;
    await order.save();

    return await Order.findById(orderId)
      .populate('buyer', 'fullName phone')
      .populate('seller', 'fullName phone')
      .populate('product', 'name images');
  }
}

module.exports = new OrderService();
