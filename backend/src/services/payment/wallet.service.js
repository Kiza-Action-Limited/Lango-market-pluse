const mongoose = require('mongoose');
const Wallet = require('../../models/Wallet.model');
const Transaction = require('../../models/Transaction.model');
const { b2cPayment, normalizeMpesaPhone } = require('../../config/mpesa');

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  return Math.round(value * 100) / 100;
};

const makeReference = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const isMpesaB2CConfigured = () => Boolean(
  process.env.MPESA_CONSUMER_KEY &&
  process.env.MPESA_CONSUMER_SECRET &&
  process.env.MPESA_PASSKEY &&
  (process.env.MPESA_SHORTCODE || process.env.MPESA_SHORT_CODE) &&
  process.env.MPESA_INITIATOR_NAME &&
  process.env.MPESA_INITIATOR_CREDENTIAL &&
  process.env.MPESA_B2C_RESULT_URL &&
  process.env.MPESA_B2C_TIMEOUT_URL
);

class WalletService {
  async getWallet(userId, session = null) {
    let query = Wallet.findOne({ user: userId });
    if (session) query = query.session(session);
    let wallet = await query;

    if (!wallet) {
      const created = await Wallet.create([{
        user: userId,
        balance: 0,
        lockedBalance: 0,
        currency: 'KES',
      }], session ? { session } : {});
      wallet = created[0];
    }

    return wallet;
  }

  async getBalance(userId) {
    const wallet = await this.getWallet(userId);
    return {
      availableBalance: Math.max(0, Number(wallet.balance || 0) - Number(wallet.lockedBalance || 0)),
      totalBalance: Number(wallet.balance || 0),
      lockedBalance: Number(wallet.lockedBalance || 0),
      currency: wallet.currency || 'KES',
    };
  }

  async createTransaction({
    user,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reference,
    description,
    status = 'completed',
    orderId,
    relatedTransactionId,
    processedBy,
    metadata = {},
    session = null,
  }) {
    const docs = await Transaction.create([{
      user,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      currency: 'KES',
      reference,
      orderId,
      relatedTransactionId,
      processedBy,
      description,
      metadata,
      status,
    }], session ? { session } : {});

    return docs[0];
  }

  async creditWallet(userId, amount, reference, description, options = {}) {
    const value = normalizeAmount(amount);
    const session = options.session || null;
    const wallet = await this.getWallet(userId, session);
    const balanceBefore = Number(wallet.balance || 0);

    wallet.balance = balanceBefore + value;
    await wallet.save(session ? { session } : {});

    const transaction = await this.createTransaction({
      user: userId,
      type: options.type || 'deposit',
      amount: value,
      balanceBefore,
      balanceAfter: wallet.balance,
      reference: reference || makeReference('CREDIT'),
      description: description || 'Wallet credit',
      status: options.status || 'completed',
      orderId: options.orderId,
      processedBy: options.processedBy,
      metadata: options.metadata || {},
      session,
    });

    return { wallet, transaction, balance: wallet.balance };
  }

  async debitWallet(userId, amount, reference, description, options = {}) {
    const value = normalizeAmount(amount);
    const session = options.session || null;
    const wallet = await this.getWallet(userId, session);
    const balanceBefore = Number(wallet.balance || 0);
    const lockedBalance = Number(wallet.lockedBalance || 0);
    const availableBalance = balanceBefore - lockedBalance;

    if (availableBalance < value) {
      throw new Error('Insufficient available balance');
    }

    wallet.balance = balanceBefore - value;
    await wallet.save(session ? { session } : {});

    const transaction = await this.createTransaction({
      user: userId,
      type: options.type || 'withdrawal',
      amount: value,
      balanceBefore,
      balanceAfter: wallet.balance,
      reference: reference || makeReference('DEBIT'),
      description: description || 'Wallet debit',
      status: options.status || 'completed',
      orderId: options.orderId,
      processedBy: options.processedBy,
      metadata: options.metadata || {},
      session,
    });

    return { wallet, transaction, balance: wallet.balance };
  }

  async transfer(fromUserId, toUserId, amount, description) {
    if (String(fromUserId) === String(toUserId)) {
      throw new Error('Cannot transfer to self');
    }

    const value = normalizeAmount(amount);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reference = makeReference('TRANSFER');
      const debit = await this.debitWallet(
        fromUserId,
        value,
        `${reference}_OUT`,
        description || `Transfer to ${toUserId}`,
        { session, type: 'withdrawal', metadata: { toUserId } }
      );
      const credit = await this.creditWallet(
        toUserId,
        value,
        `${reference}_IN`,
        description || `Transfer from ${fromUserId}`,
        { session, type: 'deposit', metadata: { fromUserId } }
      );

      await session.commitTransaction();
      return {
        success: true,
        amount: value,
        reference,
        debit: debit.transaction,
        credit: credit.transaction,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async withdraw(userId, amount, phoneNumber) {
    const value = normalizeAmount(amount);
    const normalizedPhone = normalizeMpesaPhone(phoneNumber);
    const session = await mongoose.startSession();
    session.startTransaction();
    let result;
    let reference;

    try {
      reference = makeReference('MPESA_WITHDRAW');
      result = await this.debitWallet(
        userId,
        value,
        reference,
        `Withdrawal to M-Pesa ${normalizedPhone}`,
        {
          session,
          status: 'pending',
          type: 'withdrawal',
          metadata: {
            phoneNumber: normalizedPhone,
            payoutChannel: 'mpesa',
            payoutStatus: isMpesaB2CConfigured() ? 'submitting' : 'queued',
            payoutProvider: 'safaricom_b2c',
            originatorConversationId: reference,
          },
        }
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    let payoutStatus = isMpesaB2CConfigured() ? 'submitted' : 'queued';
    let payoutResponse = null;
    let providerMessage = isMpesaB2CConfigured()
      ? 'Withdrawal sent to M-Pesa B2C.'
      : 'Withdrawal queued. Configure M-Pesa B2C credentials to send automatically.';

    if (isMpesaB2CConfigured()) {
      try {
        payoutResponse = await b2cPayment({
          phoneNumber: normalizedPhone,
          amount: value,
          remarks: `Wallet withdrawal ${reference}`,
          occasion: 'Wallet withdrawal',
          originatorConversationId: reference,
        });
        await Transaction.findByIdAndUpdate(result.transaction._id, {
          status: 'pending',
          'metadata.payoutStatus': 'submitted',
          'metadata.mpesaConversationId': payoutResponse.ConversationID || '',
          'metadata.mpesaOriginatorConversationId': payoutResponse.OriginatorConversationID || reference,
          'metadata.mpesaResponseCode': payoutResponse.ResponseCode || '',
          'metadata.mpesaResponseDescription': payoutResponse.ResponseDescription || '',
        });
      } catch (error) {
        payoutStatus = 'queued';
        providerMessage = 'Withdrawal queued. M-Pesa B2C submission failed and can be retried by operations.';
        await Transaction.findByIdAndUpdate(result.transaction._id, {
          'metadata.payoutStatus': 'queued',
          'metadata.payoutError': error.message,
        });
      }
    }

    return {
      success: true,
      message: providerMessage,
      reference,
      payoutStatus,
      payoutResponse,
      transaction: await Transaction.findById(result.transaction._id).lean(),
      wallet: {
        balance: result.wallet.balance,
        lockedBalance: result.wallet.lockedBalance,
        availableBalance: Math.max(0, result.wallet.balance - result.wallet.lockedBalance),
        currency: result.wallet.currency,
      },
    };
  }

  async addFunds(userId, amount, paymentMethod, description) {
    const value = normalizeAmount(amount);
    return this.creditWallet(
      userId,
      value,
      makeReference(`TOPUP_${String(paymentMethod || 'WALLET').toUpperCase()}`),
      description || `Wallet top-up via ${paymentMethod || 'wallet'}`,
      {
        type: 'deposit',
        metadata: { paymentMethod: paymentMethod || 'manual' },
      }
    );
  }

  async lockFunds(userId, amount, orderId, reason) {
    const value = normalizeAmount(amount);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await this.getWallet(userId, session);
      const balanceBefore = Number(wallet.balance || 0);
      const availableBalance = balanceBefore - Number(wallet.lockedBalance || 0);
      if (availableBalance < value) {
        throw new Error('Insufficient available balance');
      }

      wallet.lockedBalance = Number(wallet.lockedBalance || 0) + value;
      await wallet.save({ session });

      const transaction = await this.createTransaction({
        user: userId,
        type: 'escrow_hold',
        amount: value,
        balanceBefore,
        balanceAfter: wallet.balance,
        reference: makeReference('ESCROW_HOLD'),
        orderId,
        description: reason || `Funds locked for order ${orderId}`,
        metadata: { lockedBalance: wallet.lockedBalance },
        session,
      });

      await session.commitTransaction();
      return { success: true, wallet, transaction };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async unlockFunds(userId, orderId, amount) {
    const value = normalizeAmount(amount);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await this.getWallet(userId, session);
      const balanceBefore = Number(wallet.balance || 0);
      wallet.lockedBalance = Math.max(0, Number(wallet.lockedBalance || 0) - value);
      await wallet.save({ session });

      const transaction = await this.createTransaction({
        user: userId,
        type: 'refund',
        amount: value,
        balanceBefore,
        balanceAfter: wallet.balance,
        reference: makeReference('ESCROW_UNLOCK'),
        orderId,
        description: `Funds unlocked for order ${orderId}`,
        metadata: { lockedBalance: wallet.lockedBalance },
        session,
      });

      await session.commitTransaction();
      return { success: true, wallet, transaction };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getStatement(userId, startDate, endDate) {
    const wallet = await this.getWallet(userId);
    const query = { user: userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const creditTypes = new Set(['deposit', 'refund', 'escrow_release', 'commission', 'group_buy_payout', 'payout']);
    const totals = transactions.reduce((acc, tx) => {
      if (creditTypes.has(tx.type)) acc.credit += Number(tx.amount || 0);
      else acc.debit += Number(tx.amount || 0);
      return acc;
    }, { credit: 0, debit: 0 });

    return {
      wallet,
      transactions,
      totals: {
        credit: Math.round(totals.credit * 100) / 100,
        debit: Math.round(totals.debit * 100) / 100,
        net: Math.round((totals.credit - totals.debit) * 100) / 100,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
  }
}

module.exports = new WalletService();
