const Order = require('../../models/Order.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const ledgerService = require('../payment/ledger.service');
const { escrowQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class EscrowService {
  /**
   * Release payment to seller (called after delivery confirmation or 72h auto)
   */
  async releasePayment(orderId, options = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'completed' && !options.forceRelease) {
      throw new Error('Order not completed; cannot release escrow');
    }

    const amount = order.totalAmount;
    const sellerId = order.seller;

    // Transfer from buyer's escrow balance to seller's wallet
    await ledgerService.transferEscrowToWallet(orderId, sellerId, amount);

    // Update order status if not already
    if (order.status !== 'completed') order.status = 'completed';
    order.escrowReleaseDate = new Date();
    await order.save();

    // Record transaction
    await Transaction.create({
      user: sellerId,
      type: 'escrow_release',
      amount,
      balanceAfter: await this.getWalletBalance(sellerId),
      reference: orderId,
      description: `Escrow release for order ${orderId}`,
    });

    return { released: true, amount, seller: sellerId };
  }

  async holdEscrow(orderId, reason, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    order.status = 'disputed';
    await order.save();

    // Log hold in dispute (assumes Dispute model)
    return { held: true, reason };
  }

  async getEscrowStatus(orderId, userId, userRole) {
    const order = await Order.findById(orderId).select('status escrowReleaseDate totalAmount buyer seller');
    if (!order) throw new Error('Order not found');
    if (userRole !== 'admin' && order.buyer.toString() !== userId && order.seller.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    const status = {
      orderId,
      escrowAmount: order.totalAmount,
      status: order.status,
      expectedReleaseDate: order.escrowReleaseDate,
    };
    return status;
  }

  async partialRelease(orderId, amount, userId, reason) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (amount > order.totalAmount) throw new Error('Amount exceeds total');

    // Partial transfer logic
    await ledgerService.transferEscrowToWallet(orderId, order.seller, amount);

    // Reduce order's escrow amount (you may need to track released amount)
    // For simplicity, we assume order.totalAmount remains and you track partial releases separately

    await Transaction.create({
      user: order.seller,
      type: 'escrow_release',
      amount,
      balanceAfter: await this.getWalletBalance(order.seller),
      reference: orderId,
      description: `Partial escrow release: ${reason || 'partial delivery'}`,
    });

    return { released: amount, remaining: order.totalAmount - amount };
  }

  async cancelEscrow(orderId, reason, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    // Refund buyer from escrow
    const buyerId = order.buyer;
    await ledgerService.refundToBuyer(orderId, buyerId, order.totalAmount);

    order.status = 'cancelled';
    await order.save();

    return { cancelled: true, refunded: order.totalAmount };
  }

  async getUserEscrowTransactions(userId, { page = 1, limit = 20 }) {
    const query = { user: userId, type: { $in: ['escrow_hold', 'escrow_release'] } };
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Transaction.countDocuments(query);
    return { data: transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getEscrowSummary(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    return {
      totalInEscrow: user.escrowBalance,
      totalReleased: await Transaction.aggregate([
        { $match: { user: userId, type: 'escrow_release' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).then(res => res[0]?.total || 0),
    };
  }

  async getWalletBalance(userId) {
    const user = await User.findById(userId);
    return user.walletBalance;
  }
}

module.exports = new EscrowService();   