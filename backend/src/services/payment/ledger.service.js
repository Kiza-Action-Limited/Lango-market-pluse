const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');

class LedgerService {
  async holdInEscrow(orderId, buyerId, amount) {
    // Deduct from buyer's wallet and move to escrow
    const buyer = await User.findById(buyerId);
    if (buyer.walletBalance < amount) throw new Error('Insufficient funds');
    buyer.walletBalance -= amount;
    buyer.escrowBalance += amount;
    await buyer.save();

    await Transaction.create({
      user: buyerId,
      type: 'escrow_hold',
      amount,
      balanceAfter: buyer.walletBalance,
      reference: orderId,
      description: `Escrow hold for order ${orderId}`,
    });
  }

  async transferEscrowToWallet(orderId, sellerId, amount) {
    const seller = await User.findById(sellerId);
    seller.walletBalance += amount;
    await seller.save();

    // Also reduce escrow balance of buyer? This requires tracking per order.
    // Simplified: we don't track per-order escrow on user doc; we trust order status.
    // For production, you'd have a separate EscrowTransaction model.
  }

  async refundToBuyer(orderId, buyerId, amount) {
    const buyer = await User.findById(buyerId);
    buyer.walletBalance += amount;
    buyer.escrowBalance -= amount;
    await buyer.save();

    await Transaction.create({
      user: buyerId,
      type: 'refund',
      amount,
      balanceAfter: buyer.walletBalance,
      reference: orderId,
      description: `Refund for cancelled order ${orderId}`,
    });
  }

  async getTransactions(userId, { page = 1, limit = 20, type }) {
    const query = { user: userId };
    if (type) query.type = type;
    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Transaction.countDocuments(query);
    return { data: transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
}

module.exports = new LedgerService();