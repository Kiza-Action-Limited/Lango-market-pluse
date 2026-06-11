const Dispute = require('../../models/Dispute.model');
const Order = require('../../models/Order.model');
const Escrow = require('../../models/Escrow.model');
const Transaction = require('../../models/Transaction.model');

class DisputeService {
  async createDispute(orderId, raisedBy, reason, description, evidenceUrls = []) {
    // Check if dispute already exists
    const existingDispute = await Dispute.findOne({
      order: orderId,
      status: { $ne: 'closed' },
    });

    if (existingDispute) {
      throw new Error('Active dispute already exists for this order');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const escrow = await Escrow.findOne({ order: orderId });

    const dispute = await Dispute.create({
      order: orderId,
      escrow: escrow?._id,
      raisedBy,
      reason,
      description,
      evidenceUrls,
    });

    // Update order status
    order.status = 'disputed';
    await order.save();

    // Put escrow on hold
    if (escrow) {
      escrow.status = 'on_hold';
      await escrow.save();
    }

    return dispute;
  }

  async resolveDispute(disputeId, resolution, refundAmount, faultParty, resolvedBy) {
    const dispute = await Dispute.findById(disputeId)
      .populate('order')
      .populate('escrow');

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Update dispute
    dispute.status = 'resolved_' + (faultParty === dispute.order.buyer ? 'seller' : 'buyer');
    dispute.resolution = resolution;
    dispute.refundAmount = refundAmount || 0;
    dispute.faultParty = faultParty;
    dispute.resolvedBy = resolvedBy;
    dispute.resolvedAt = new Date();

    // Process refund
    if (resolution === 'refund_buyer') {
      const Wallet = require('../../models/Wallet.model');
      const buyerWallet = await Wallet.findOne({ user: dispute.order.buyer });
      if (buyerWallet) {
        buyerWallet.balance += dispute.order.total;
        await buyerWallet.save();
      }

      await Transaction.create({
        user: dispute.order.buyer,
        type: 'refund',
        amount: dispute.order.total,
        description: `Refund for disputed order ${dispute.order._id}`,
        status: 'completed',
        reference: `DISPUTE_${dispute._id}`,
      });
    } else if (resolution === 'partial_refund') {
      const Wallet = require('../../models/Wallet.model');
      const buyerWallet = await Wallet.findOne({ user: dispute.order.buyer });
      if (buyerWallet) {
        buyerWallet.balance += refundAmount;
        await buyerWallet.save();
      }

      await Transaction.create({
        user: dispute.order.buyer,
        type: 'refund',
        amount: refundAmount,
        description: `Partial refund for disputed order ${dispute.order._id}`,
        status: 'completed',
        reference: `DISPUTE_PARTIAL_${dispute._id}`,
      });
    }

    // Release escrow
    if (dispute.escrow) {
      dispute.escrow.status = 'released';
      await dispute.escrow.save();
    }

    // Update order
    dispute.order.status = 'dispute_resolved';
    await dispute.order.save();

    await dispute.save();
    return dispute;
  }

  async getDisputeStats() {
    return Dispute.aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          byReason: [
            { $group: { _id: '$reason', count: { $sum: 1 } } },
          ],
          total: [{ $count: 'count' }],
          avgRefund: [
            { $group: { _id: null, avg: { $avg: '$refundAmount' }, max: { $max: '$refundAmount' } } },
          ],
        },
      },
    ]);
  }

  async listDisputes(filters = {}, page = 1, limit = 20) {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.reason) query.reason = filters.reason;
    if (filters.raisedBy) query.raisedBy = filters.raisedBy;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('order', 'orderNumber buyer seller total')
        .populate('raisedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Dispute.countDocuments(query),
    ]);

    return { disputes, total };
  }

  async addMessage(disputeId, message, senderId, isAdmin = false) {
    const dispute = await Dispute.findById(disputeId);

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    dispute.messages.push({
      sender: senderId,
      message,
      timestamp: new Date(),
      isAdmin,
    });

    await dispute.save();
    return dispute;
  }

  async reopenDispute(disputeId, reason, reopenedBy) {
    const dispute = await Dispute.findById(disputeId);

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    dispute.status = 'under_review';
    dispute.messages.push({
      sender: reopenedBy,
      message: `Dispute reopened. Reason: ${reason}`,
      timestamp: new Date(),
      isAdmin: true,
    });

    await dispute.save();
    return dispute;
  }
}

module.exports = new DisputeService();
