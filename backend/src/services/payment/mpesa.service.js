const Payment = require('../../models/Payment.model');
const Wallet = require('../../models/Wallet.model');
const Order = require('../../models/Order.model');
const Transaction = require('../../models/Transaction.model');
const escrowService = require('../order/escrow.service');
const mongoose = require('mongoose');
const axios = require('axios');
const { PLANS, normalizePlanId } = require('../../config/subscriptionPlans');

// --- ADDED: in-memory throttle map to prevent rapid repeated status queries ---
const statusQueryCache = new Map();
const STATUS_QUERY_COOLDOWN_MS = 5000; // 5 seconds between queries per checkoutRequestId

const PLAN_PRICES = {
  solo: 500,
  smart: 2500,
  growth: 6500,
};

const getMetadataValue = (metadata, key) => {
  if (!metadata) return undefined;
  if (typeof metadata.get === 'function') return metadata.get(key);
  return metadata[key];
};

class MpesaService {
  /**
   * Initiate M-Pesa STK Push
   */
  async initiatePayment(orderId, phoneNumber, userId) {
    let order = null; // FIXED: declared outside try so catch block can safely reference it
    try {
      // Try to find order by MongoDB _id first, then by orderNumber
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId);
      }

      // If not found by ID, try by orderNumber
      if (!order) {
        order = await Order.findOne({ orderNumber: orderId });
      }

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.buyer.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      if (!['pending_payment', 'AWAITING_PAYMENT'].includes(order.status)) {
        throw new Error('Order not ready for payment');
      }

      // Get access token
      const token = await this.getAccessToken();

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Generate timestamp
      const timestamp = this.getTimestamp();

      // Generate password
      const password = this.generatePassword(timestamp);

      const payload = {
        BusinessShortCode: process.env.MPESA_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(order.totalAmount), // Ensure integer
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORT_CODE,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: (order.orderNumber || order._id.toString()).substring(0, 12), // Max 12 chars
        TransactionDesc: `Order ${order.orderNumber || order._id.toString().substring(0, 8)}`, // Max 13 chars
      };

      const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payment = new Payment({
        user: userId,
        order: order._id,
        amount: order.totalAmount,
        currency: 'KES',
        paymentMethod: 'mpesa',
        status: 'processing',
        phoneNumber,
        checkoutRequestId: response.data.CheckoutRequestID,
        transactionId: response.data.CheckoutRequestID,
      });

      await payment.save();

      order.paymentIntentId = response.data.CheckoutRequestID;
      order.status = 'AWAITING_PAYMENT';
      await order.save();

      await escrowService.createPendingEscrow(order, {
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
      });

      return {
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        message: response.data.ResponseDescription,
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      // FIXED: guard against order being null when logging
      if (order) {
        console.error('Request payload:', {
          phoneNumber: this.formatPhoneNumber(phoneNumber),
          timestamp: this.getTimestamp(),
          shortCode: process.env.MPESA_SHORT_CODE,
          amount: order.totalAmount,
        });
      }
      throw new Error(`M-Pesa payment initiation failed: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  async initiateSubscriptionPayment(planId, phoneNumber, userId) {
    const normalizedPlanId = normalizePlanId(planId);
    const plan = PLANS[normalizedPlanId];
    const amount = PLAN_PRICES[normalizedPlanId];

    if (!plan || !amount) {
      const error = new Error('Invalid paid subscription plan');
      error.statusCode = 400;
      throw error;
    }

    const token = await this.getAccessToken();
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);
    const accountReference = `SUB${normalizedPlanId}${String(userId).slice(-4)}`.substring(0, 12);

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: process.env.MPESA_SHORT_CODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: `Sub ${plan.displayName || plan.name}`.substring(0, 13),
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    await Payment.create({
      user: userId,
      amount,
      currency: 'KES',
      paymentMethod: 'mpesa',
      status: 'processing',
      phoneNumber,
      checkoutRequestId: response.data.CheckoutRequestID,
      transactionId: response.data.CheckoutRequestID,
      description: `Subscription payment for ${plan.displayName || plan.name}`,
      metadata: {
        purpose: 'subscription',
        planId: normalizedPlanId,
        merchantRequestId: response.data.MerchantRequestID,
      },
    });

    return {
      success: true,
      checkoutRequestId: response.data.CheckoutRequestID,
      message: response.data.ResponseDescription,
      planId: normalizedPlanId,
      amount,
    };
  }

  /**
   * Query payment status
   * ADDED: throttle guard + exponential backoff retry on 429
   */
  async queryPaymentStatus(checkoutRequestId) {
    // --- ADDED: throttle repeated calls for the same checkoutRequestId ---
    const lastQueried = statusQueryCache.get(checkoutRequestId);
    if (lastQueried && Date.now() - lastQueried < STATUS_QUERY_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((STATUS_QUERY_COOLDOWN_MS - (Date.now() - lastQueried)) / 1000);
      throw new Error(`Too many status check requests. Please wait ${waitSeconds} second(s) and try again.`);
    }
    statusQueryCache.set(checkoutRequestId, Date.now());

    // --- ADDED: retry with exponential backoff on 429 ---
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const token = await this.getAccessToken();
        const timestamp = this.getTimestamp();
        const password = this.generatePassword(timestamp);

        const payload = {
          BusinessShortCode: process.env.MPESA_SHORT_CODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        };

        const response = await axios.post(
          'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const payment = await Payment.findOne({ checkoutRequestId });
        if (payment) {
          if (response.data.ResultCode === '0') {
            payment.status = 'completed';
            payment.paidAt = new Date();
          } else if (response.data.ResultCode === '1032') {
            payment.status = 'failed';
            payment.failureReason = response.data.ResultDesc;
          }
          await payment.save();
        }

        return {
          status: response.data.ResultCode === '0' ? 'completed' : 'failed',
          message: response.data.ResultDesc,
        };
      } catch (error) {
        const isRateLimit = error.response?.status === 429;
        const isLastAttempt = attempt === MAX_RETRIES;

        if (isRateLimit && !isLastAttempt) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 3s, 6s, 12s
          console.warn(`M-Pesa rate limit hit (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);
          await this._sleep(delay);
          continue;
        }

        console.error('M-Pesa Status Query Error:', error.response?.data || error.message);
        throw new Error(`Status query failed: ${error.response?.data?.errorMessage || error.message}`);
      }
    }
  }

  /**
   * Handle M-Pesa callback
   */
  async handleCallback(callbackData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = callbackData.Body.stkCallback;

      if (result.ResultCode === 0) {
        const checkoutRequestId = result.CheckoutRequestID;
        const payment = await Payment.findOne({ checkoutRequestId }).session(session);

        if (payment) {
          payment.status = 'completed';
          payment.paidAt = new Date();

          const metadata = result.CallbackMetadata.Item;
          const receiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;

          if (receiptNumber) {
            payment.mpesaReceiptNumber = receiptNumber;
          }

          await payment.save({ session });

          // Update order
          const order = await Order.findByIdAndUpdate(
            payment.order,
            { status: 'FUNDS_HELD', paidAt: new Date() },
            { session }
          );

          // Credit wallet
          const wallet = await Wallet.findOne({ user: payment.user }).session(session);
          if (wallet) {
            wallet.balance += payment.amount;
            await wallet.save({ session });
          }

          // Create transaction
          await Transaction.create(
            [
              {
                user: payment.user,
                type: 'payment',
                amount: payment.amount,
                status: 'completed',
                reference: payment.transactionId,
                orderId: payment.order,
                description: `M-Pesa payment for order ${payment.order}`,
              },
            ],
            { session }
          );

          await session.commitTransaction();
          return { success: true, message: 'Payment recorded' };
        }
      } else {
        const payment = await Payment.findOne({ checkoutRequestId: result.CheckoutRequestID }).session(session);
        if (payment) {
          payment.status = 'failed';
          payment.failureReason = result.ResultDesc;
          await payment.save({ session });
        }
        await session.commitTransaction();
      }
    } catch (error) {
      await session.abortTransaction();
      console.error('M-Pesa Callback Error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async handleSuccessCallback({ checkoutRequestId, amount, transactionId, transactionDate }) {
    const payment = await Payment.findOne({ checkoutRequestId });
    if (!payment) return null;

    payment.status = 'completed';
    payment.paidAt = new Date();
    if (transactionId) {
      payment.mpesaReceiptNumber = transactionId;
    }
    if (amount != null) {
      payment.amount = Number(amount);
    }
    await payment.save();

    const order = await Order.findById(payment.order);
    if (order) {
      await escrowService.createPendingEscrow(order, {
        checkoutRequestId,
        merchantRequestId: payment.metadata?.get?.('merchantRequestId') || payment.metadata?.merchantRequestId,
      });
    }

    const escrow = await escrowService.markPaymentHeld({
      checkoutRequestId,
      amount: amount || payment.amount,
      transactionId,
      transactionDate,
    });

    return { payment, escrow };
  }

  async handleFailureCallback({ checkoutRequestId, errorMessage }) {
    const payment = await Payment.findOne({ checkoutRequestId });
    if (payment) {
      payment.status = 'failed';
      payment.failureReason = errorMessage;
      await payment.save();
    }

    const escrow = await escrowService.markPaymentFailed({ checkoutRequestId, errorMessage });
    return { payment, escrow };
  }

  /**
   * Get access token from Safaricom
   */
  async getAccessToken() {
    try {
      const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
      ).toString('base64');

      const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Access Token Error:', error);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  /**
   * Generate timestamp (YYYYMMDDHHMMSS)
   */
  getTimestamp() {
    const now = new Date();
    return (
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')
    );
  }

  /**
   * Generate password for M-Pesa
   */
  generatePassword(timestamp) {
    const input = process.env.MPESA_SHORT_CODE + process.env.MPESA_PASSKEY + timestamp;
    return Buffer.from(input).toString('base64');
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phoneNumber) {
    let formatted = phoneNumber.toString().trim();
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.substring(1);
    } else if (!formatted.startsWith('254')) {
      formatted = '254' + formatted;
    }
    return formatted;
  }

  /**
   * Withdraw to M-Pesa
   */
  async withdrawToMpesa(userId, amount, phoneNumber) {
    try {
      const payment = await Payment.create({
        user: userId,
        amount,
        currency: 'KES',
        paymentMethod: 'mpesa',
        phoneNumber,
        status: 'pending',
        description: `Withdrawal to M-Pesa account ending in ${phoneNumber.slice(-4)}`,
      });

      await Transaction.create({
        user: userId,
        type: 'withdrawal',
        amount,
        status: 'pending',
        reference: payment._id.toString(),
        description: 'M-Pesa withdrawal',
      });

      const wallet = await Wallet.findOne({ user: userId });
      if (wallet) {
        wallet.lockedBalance += amount;
        await wallet.save();
      }

      return {
        success: true,
        message: 'Withdrawal initiated',
        reference: payment._id,
      };
    } catch (error) {
      console.error('Withdrawal Error:', error);
      throw error;
    }
  }

  /**
   * Credit wallet
   */
  async creditWallet(userId, amount) {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: amount });
    } else {
      wallet.balance += amount;
    }
    await wallet.save();
    return wallet;
  }

  // --- ADDED: sleep helper for retry backoff ---
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MpesaService();
