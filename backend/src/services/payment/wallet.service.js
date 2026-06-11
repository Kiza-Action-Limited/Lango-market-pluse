const Wallet = require('../../models/Wallet.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const mongoose = require('mongoose');

class WalletService {
  async getWallet(userId) {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        lockedBalance: 0,
      });
    }
    return wallet;
  }

  async getBalance(userId) {
    const wallet = await this.getWallet(userId);
    return {
      availableBalance: wallet.balance - wallet.lockedBalance,
      totalBalance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
      currency: wallet.currency,
    };
  }

  async creditWallet(userId, amount, reference, description) {
    const wallet = await this.getWallet(userId);
    wallet.balance += amount;
    await wallet.save();

    await Transaction.create({
      user: userId,
      type: 'deposit',
      amount,
      status: 'completed',
      description: description || `Wallet credit`,
    });

    return { balance: wallet.balance };
  }

  async debitWallet(userId, amount, reference, description) {
    const wallet = await this.getWallet(userId);
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    wallet.balance -= amount;
    await wallet.save();

    await Transaction.create({
      user: userId,
      type: 'withdrawal',
      amount,
      status: 'completed',
      description: description || `Wallet debit`,
    });

    return { balance: wallet.balance };
  }

  async transfer(fromUserId, toUserId, amount, description) {
    if (fromUserId === toUserId) throw new Error('Cannot transfer to self');
    await this.debitWallet(fromUserId, amount, `transfer_to_${toUserId}`, description);
    await this.creditWallet(toUserId, amount, `transfer_from_${fromUserId}`, description);
    return { success: true, amount };
  }

  async withdraw(userId, amount, phoneNumber) {
    // Initiate M-Pesa B2C (business to customer) withdrawal
    // This would call M-Pesa B2C API (not STK Push)
    await this.debitWallet(userId, amount, `withdraw_${Date.now()}`, 'Withdrawal to M-Pesa');
    // Queue actual withdrawal to M-Pesa
    // await mpesaService.b2cWithdraw(phoneNumber, amount);
    return { success: true, message: 'Withdrawal initiated' };
  }
}

module.exports = new WalletService();