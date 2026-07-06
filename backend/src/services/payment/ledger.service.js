const Transaction = require('../../models/Transaction.model');
const Wallet = require('../../models/Wallet.model');

const makeReference = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

class LedgerService {
  async holdInEscrow(orderId, buyerId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    const value = Number(amount);
    const balanceBefore = Number(wallet?.balance || 0);
    const lockedBefore = Number(wallet?.lockedBalance || 0);
    if (!wallet || balanceBefore - lockedBefore < value) throw new Error('Insufficient funds');
    
    wallet.lockedBalance = lockedBefore + value;
    await wallet.save();

    await Transaction.create({
      user: buyerId,
      type: 'escrow_hold',
      amount: value,
      balanceBefore,
      balanceAfter: wallet.balance,
      reference: makeReference('ESCROW_HOLD'),
      status: 'completed',
      description: `Escrow hold for order ${orderId}`,
      orderId,
      metadata: { lockedBalance: wallet.lockedBalance },
    });
  }

  async transferEscrowToWallet(orderId, sellerId, amount) {
    const value = Number(amount);
    const wallet = await Wallet.findOne({ user: sellerId });
    let targetWallet = wallet;
    const balanceBefore = Number(wallet?.balance || 0);

    if (!wallet) {
      targetWallet = new Wallet({ user: sellerId, balance: value, lockedBalance: 0 });
      await targetWallet.save();
    } else {
      wallet.balance = balanceBefore + value;
      await wallet.save();
    }

    await Transaction.create({
      user: sellerId,
      type: 'escrow_release',
      amount: value,
      balanceBefore,
      balanceAfter: targetWallet.balance,
      reference: makeReference('ESCROW_RELEASE'),
      status: 'completed',
      description: `Escrow release for order ${orderId}`,
      orderId,
    });
  }

  async refundToBuyer(orderId, buyerId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    if (!wallet) throw new Error('Wallet not found');

    const value = Number(amount);
    const balanceBefore = Number(wallet.balance || 0);
    const lockedBefore = Number(wallet.lockedBalance || 0);
    
    wallet.lockedBalance = Math.max(0, lockedBefore - value);
    await wallet.save();

    await Transaction.create({
      user: buyerId,
      type: 'refund',
      amount: value,
      balanceBefore,
      balanceAfter: wallet.balance,
      reference: makeReference('ESCROW_REFUND'),
      status: 'completed',
      description: `Refund for cancelled order ${orderId}`,
      orderId,
      metadata: { lockedBalance: wallet.lockedBalance },
    });
  }

  async getTransactions(userId, { page = 1, limit = 20, type, status }) {
    const query = { user: userId };
    if (type) query.type = type;
    if (status) query.status = status;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (numericPage - 1) * numericLimit;
    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(numericLimit);
    const total = await Transaction.countDocuments(query);
    return {
      data: transactions,
      transactions,
      pagination: {
        page: numericPage,
        limit: numericLimit,
        total,
        pages: Math.ceil(total / numericLimit),
      },
    };
  }
}

module.exports = new LedgerService();
