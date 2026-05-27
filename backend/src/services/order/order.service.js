const Order = require('../../models/Order.model');
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const productService = require('../inventory/product.service');
const escrowService = require('./escrow.service');
const { smsQueue } = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

const normalizeDeliveryAddress = (deliveryAddress) => {
  if (!deliveryAddress) return undefined;

  if (typeof deliveryAddress === 'string') {
    return {
      label: deliveryAddress.trim(),
      country: 'Kenya',
    };
  }

  if (typeof deliveryAddress === 'object') {
    return {
      label: deliveryAddress.label || deliveryAddress.address || deliveryAddress.street,
      county: deliveryAddress.county,
      town: deliveryAddress.town,
      street: deliveryAddress.street,
      country: deliveryAddress.country || 'Kenya',
      gpsLat: deliveryAddress.gpsLat,
      gpsLng: deliveryAddress.gpsLng,
    };
  }

  return undefined;
};

const httpError = (message, statusCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

class OrderService {
  async createOrder(orderData) {
    const { buyer, product, quantity, deliveryAddress } = orderData;

    // Get product details
    const productDoc = await Product.findById(product);
    if (!productDoc) throw httpError('Product not found', 404);

    const seller = await User.findById(productDoc.seller).select('businessType phone');
    const sellerBusinessType = String(seller?.businessType || '').toLowerCase();
    const requiresBulkMinimum = sellerBusinessType === 'wholesaler' || sellerBusinessType === 'manufacturer';
    const orderQuantity = Number(quantity);

    if (requiresBulkMinimum && orderQuantity < 10) {
      throw httpError('Minimum order for wholesaler/manufacturer products is 10 pieces (MQQ1: 10-2,999, MQQ2: 3,000+)', 400);
    }

    // Check stock
    if (productDoc.quantityAvailable - productDoc.reservedQuantity < orderQuantity) {
      throw httpError('Insufficient stock', 409);
    }

    // Reserve stock
    await productService.reserveStock(product, orderQuantity);

    const normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);

    // Create order
    const order = await Order.create({
      buyer,
      seller: productDoc.seller,
      product,
      quantity: orderQuantity,
      unitPrice: productDoc.price,
      totalAmount: orderQuantity * productDoc.price,
      deliveryAddress: normalizedDeliveryAddress,
      deliveryAddressText: typeof deliveryAddress === 'string' ? deliveryAddress.trim() : normalizedDeliveryAddress?.label,
      qrChain: uuidv4(),
      status: 'pending_payment',
    });

    // Notify seller via SMS
    if (seller?.phone) {
      await smsQueue.add('send', {
        to: seller.phone,
        message: `New order #${order._id} for ${orderQuantity} ${productDoc.name}. Awaiting payment.`,
      });
    }

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
    if (!order) throw httpError('Order not found', 404);

    // Check authorization
    if (userRole !== 'admin' && order.buyer._id.toString() !== userId && order.seller._id.toString() !== userId) {
      throw httpError('Unauthorized', 403);
    }
    return order;
  }

  async cancelOrder(orderId, userId, userRole, reason) {
    const order = await this.getOrderById(orderId, userId, userRole);
    if (!['pending_payment', 'payment_escrowed'].includes(order.status)) {
      throw httpError('Order cannot be cancelled at this stage', 409, { currentStatus: order.status });
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
    if (!order) throw httpError('Order not found', 404);
    if (order.buyer.toString() !== buyerId) throw httpError('Unauthorized', 403);

    if (order.status === 'completed') {
      return order;
    }

    if (['cancelled', 'disputed'].includes(order.status)) {
      throw httpError(`Cannot confirm delivery for a ${order.status} order`, 409, {
        currentStatus: order.status,
        expectedStatus: 'delivered',
      });
    }

    if (order.status !== 'delivered') {
      throw httpError('Order must be marked delivered before buyer confirmation', 409, {
        currentStatus: order.status,
        expectedStatus: 'delivered',
      });
    }

    order.status = 'completed';
    // Escrow will be auto-released by job, but we set escrowReleaseDate
    order.escrowReleaseDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await order.save();

    return order;
  }

  async updateOrderStatus(orderId, userId, userRole, nextStatus) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);

    const isOwnerSeller = order.seller.toString() === userId;
    const isAdmin = userRole === 'admin';
    if (!isOwnerSeller && !isAdmin) {
      throw httpError('Unauthorized', 403);
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
      throw httpError(`Invalid status transition from ${currentStatus} to ${nextStatus}`, 409, {
        currentStatus,
        nextStatus,
        allowedNext,
      });
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
