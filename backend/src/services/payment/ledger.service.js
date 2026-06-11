const Transaction = require('../../models/Transaction.model');
const Wallet = require('../../models/Wallet.model');

class LedgerService {
  async holdInEscrow(orderId, buyerId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    if (!wallet || wallet.balance < amount) throw new Error('Insufficient funds');
    
    wallet.lockedBalance += amount;
    await wallet.save();

    await Transaction.create({
      user: buyerId,
      type: 'escrow_hold',
      amount,
      status: 'completed',
      description: `Escrow hold for order ${orderId}`,
      orderId,
    });
  }

  async transferEscrowToWallet(orderId, sellerId, amount) {
    const wallet = await Wallet.findOne({ user: sellerId });
    if (!wallet) {
      const newWallet = new Wallet({ user: sellerId, balance: amount });
      await newWallet.save();
    } else {
      wallet.balance += amount;
      await wallet.save();
    }

    await Transaction.create({
      user: sellerId,
      type: 'escrow_release',
      amount,
      status: 'completed',
      description: `Escrow release for order ${orderId}`,
      orderId,
    });
  }

  async refundToBuyer(orderId, buyerId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    if (!wallet) throw new Error('Wallet not found');
    
    wallet.lockedBalance -= amount;
    wallet.balance += amount;
    await wallet.save();

    await Transaction.create({
      user: buyerId,
      type: 'refund',
      amount,
      status: 'completed',
      description: `Refund for cancelled order ${orderId}`,
      orderId,
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