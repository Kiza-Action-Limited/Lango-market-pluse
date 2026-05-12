const User = require('../../models/User.model');
const Transaction = require('../../models/Transaction.model');
const ledgerService = require('./ledger.service');
const mpesaService = require('./mpesa.service');

class WalletService {
  async getBalance(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    return user.walletBalance;
  }

  async creditWallet(userId, amount, reference, description) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    user.walletBalance += amount;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'deposit',
      amount,
      balanceAfter: user.walletBalance,
      reference,
      description,
    });

    return { balance: user.walletBalance };
  }

  async debitWallet(userId, amount, reference, description) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.walletBalance < amount) throw new Error('Insufficient balance');
    user.walletBalance -= amount;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'withdrawal',
      amount,
      balanceAfter: user.walletBalance,
      reference,
      description,
    });

    return { balance: user.walletBalance };
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