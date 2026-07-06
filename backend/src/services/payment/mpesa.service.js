const Payment = require('../../models/Payment.model');
const Wallet = require('../../models/Wallet.model');
const Order = require('../../models/Order.model');
const Logistics = require('../../models/Logistics.model');
const Transaction = require('../../models/Transaction.model');
const escrowService = require('../order/escrow.service');
const qrChainSvc = require('../order/qrChain.service');
const mongoose = require('mongoose');
const axios = require('axios');
const { PLANS, normalizePlanId } = require('../../config/subscriptionPlans');
const {
  PLATFORM_ACCOUNT,
  buildPlatformRevenueMetadata,
  getPlatformAccountPublicPayload,
} = require('../../config/platformAccount');

// --- ADDED: in-memory throttle map to prevent rapid repeated status queries ---
const statusQueryCache = new Map();
const STATUS_QUERY_COOLDOWN_MS = 5000; // 5 seconds between queries per checkoutRequestId
const accessTokenCache = {
  token: null,
  expiresAt: 0,
};

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

const isSubscriptionPayment = (payment) => getMetadataValue(payment?.metadata, 'purpose') === 'subscription';

const getOrderNumber = (order) => (
  order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`
);

const normalizeLogisticsAddress = (address, fallback = {}) => {
  const source = address || fallback || {};
  if (typeof source === 'string') {
    return {
      label: source,
      county: fallback.county || 'Unknown',
      town: fallback.town || source || 'Unknown',
      country: 'Kenya',
    };
  }

  return {
    label: source.label || source.street || source.address || fallback.label,
    county: source.county || fallback.county || 'Unknown',
    town: source.town || source.city || source.campus || fallback.town || source.label || 'Unknown',
    street: source.street || fallback.street,
    gpsLat: source.gpsLat || source.lat || fallback.gpsLat,
    gpsLng: source.gpsLng || source.lng || fallback.gpsLng,
    country: source.country || fallback.country || 'Kenya',
  };
};

const isIncapsulaBlock = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return text.includes('Incapsula') || text.includes('_Incapsula_Resource');
};

const createMpesaError = (message, code, statusCode = 503, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

class MpesaService {
  async ensureLogisticsRecordForPaidOrder(orderId, source = 'mpesa_payment') {
    const existing = await Logistics.findOne({ order: orderId });
    if (existing) return existing;

    const order = await Order.findById(orderId).populate('product');
    if (!order) return null;

    const orderNumber = getOrderNumber(order);
    if (!order.orderNumber) {
      order.orderNumber = orderNumber;
      await order.save();
    }

    const product = order.product || {};
    const pickupAddress = normalizeLogisticsAddress(product.pickupAddress, {
      label: product.locationHub || 'Seller pickup hub',
      town: product.locationHub || 'Seller hub',
      county: 'Unknown',
    });
    const shippingAddress = normalizeLogisticsAddress(order.deliveryAddress || order.deliveryAddressText, {
      label: order.deliveryAddressText || 'Delivery address',
      town: 'Delivery town pending',
      county: 'Unknown',
    });

    try {
      const logistics = await Logistics.create({
        order: order._id,
        orderNumber,
        seller: order.seller,
        buyer: order.buyer,
        carrier: 'solo_owner_operator',
        pickupAddress,
        shippingAddress,
        weight: Number(product.weightKg || order.quantity || 1),
        weightUnit: product.unit === 'g' ? 'g' : 'kg',
        cargoType: product.name || 'Order cargo',
        status: 'pending',
        shippingCost: Number(order.logisticsFee || 0),
        routeInfo: {
          totalDistanceKm: Number(order.logisticsDistanceKm || 0),
        },
        metadata: {
          autoCreated: true,
          source,
          paymentIncludedInEscrow: true,
          calculationSource: order.logisticsPricing?.calculationSource,
          autoCreatedAt: new Date(),
        },
      });

      await qrChainSvc.generateTripTokens(logistics);
      return logistics;
    } catch (error) {
      if (error.code === 11000) {
        return Logistics.findOne({ order: orderId });
      }
      console.warn('Automatic logistics creation failed:', error.message);
      return null;
    }
  }

  /**
   * Initiate M-Pesa STK Push
   */
  async initiatePayment(orderId, phoneNumber, userId) {
    let order = null;
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
        amount: order.totalAmount,
        breakdown: {
          productSubtotal: order.productSubtotal || (Number(order.quantity || 0) * Number(order.unitPrice || 0)),
          logisticsFee: order.logisticsFee || 0,
          logisticsDistanceKm: order.logisticsDistanceKm || 0,
        },
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      if (order) {
        let debugPhoneNumber = 'invalid-or-missing';
        try {
          debugPhoneNumber = this.formatPhoneNumber(phoneNumber);
        } catch (formatError) {
          debugPhoneNumber = formatError.code || 'invalid-or-missing';
        }

        console.error('Request payload:', {
          phoneNumber: debugPhoneNumber,
          timestamp: this.getTimestamp(),
          shortCode: process.env.MPESA_SHORT_CODE,
          amount: order.totalAmount,
        });
      }
      if (error.statusCode && error.statusCode < 500) {
        throw error;
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

    try {
      const token = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const timestamp = this.getTimestamp();
      const subscriptionShortCode = PLATFORM_ACCOUNT.mpesaShortCode || process.env.MPESA_SHORT_CODE;
      const password = this.generatePassword(timestamp, subscriptionShortCode);
      const accountReference = PLATFORM_ACCOUNT.subscriptionAccountReference;

      const payload = {
        BusinessShortCode: subscriptionShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formattedPhone,
        PartyB: subscriptionShortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: PLATFORM_ACCOUNT.subscriptionTransactionDesc,
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
        metadata: buildPlatformRevenueMetadata({
          purpose: 'subscription',
          planId: normalizedPlanId,
          planName: plan.displayName || plan.name,
          merchantRequestId: response.data.MerchantRequestID,
          payerUserId: userId,
          accountReference,
          mpesaShortCode: subscriptionShortCode,
        }),
      });

      return {
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        message: response.data.ResponseDescription,
        planId: normalizedPlanId,
        amount,
        payeeAccount: getPlatformAccountPublicPayload(),
      };
    } catch (error) {
      console.error('Subscription Payment Error:', error.response?.data || error.message);
      throw new Error(`Subscription payment initiation failed: ${error.response?.data?.errorMessage || error.message}`);
    }
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

    // --- ADDED: auto-cleanup cache entries after 1 minute ---
    setTimeout(() => {
      statusQueryCache.delete(checkoutRequestId);
    }, 60000);

    // --- ADDED: retry with exponential backoff on 429 ---
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 3000;

    let lastError = null;
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
          const wasCompleted = payment.status === 'completed';

          if (response.data.ResultCode === '0') {
            payment.status = 'completed';
            payment.paidAt = new Date();
          } else if (response.data.ResultCode === '1032') {
            payment.status = 'failed';
            payment.failureReason = response.data.ResultDesc;
          }
          await payment.save();

          if (response.data.ResultCode === '0' && !wasCompleted && !isSubscriptionPayment(payment)) {
            await this.handleSuccessCallback({
              checkoutRequestId,
              amount: payment.amount,
              transactionId: payment.mpesaReceiptNumber || payment.transactionId || checkoutRequestId,
              transactionDate: payment.paidAt,
            });
          }
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

        lastError = error;
        if (!isRateLimit || isLastAttempt) {
          console.error('M-Pesa Status Query Error:', {
            message: error.message,
            code: error.code,
            providerStatus: error.providerStatus || error.response?.status,
          });
          throw createMpesaError(
            error.message || 'Unable to confirm M-Pesa status right now.',
            error.code || 'MPESA_STATUS_QUERY_FAILED',
            error.statusCode || 503,
            { providerStatus: error.providerStatus || error.response?.status }
          );
        }
      }
    }

    // Should never reach here, but just in case
    throw new Error(`Status query failed after ${MAX_RETRIES} attempts`);
  }

  /**
   * Handle M-Pesa callback
   */
  async handleCallback(callbackData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = callbackData.Body.stkCallback;
      let paidOrderId = null;

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

          if (isSubscriptionPayment(payment)) {
            await session.commitTransaction();
            return { success: true, message: 'Subscription payment recorded', payment };
          }

          paidOrderId = payment.order;
          await session.commitTransaction();

          await this.handleSuccessCallback({
            checkoutRequestId,
            amount: payment.amount,
            transactionId: receiptNumber || payment.transactionId || checkoutRequestId,
            transactionDate: payment.paidAt,
          });

          if (paidOrderId) {
            await this.ensureLogisticsRecordForPaidOrder(paidOrderId, 'mpesa_callback');
          }
          return { success: true, message: 'Payment recorded' };
        } else {
          // Payment not found - might be subscription payment
          await session.commitTransaction();
          return { success: false, message: 'Payment not found' };
        }
      } else {
        // Payment failed
        const checkoutRequestId = result.CheckoutRequestID;
        const payment = await Payment.findOne({ checkoutRequestId }).session(session);
        if (payment) {
          payment.status = 'failed';
          payment.failureReason = result.ResultDesc;
          await payment.save({ session });
        }
        await session.commitTransaction();
        return { success: false, message: result.ResultDesc };
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

    if (isSubscriptionPayment(payment)) {
      return { payment, escrow: null };
    }

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

    if (payment.order) {
      await this.ensureLogisticsRecordForPaidOrder(payment.order, 'mpesa_status_confirmed');
    }

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
    if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
      return accessTokenCache.token;
    }

    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
      throw createMpesaError(
        'M-Pesa credentials are missing. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.',
        'MPESA_CREDENTIALS_MISSING',
        500
      );
    }

    try {
      const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
      ).toString('base64');

      const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
          timeout: 30000,
        }
      );

      const token = response.data.access_token;
      const expiresInSeconds = Number(response.data.expires_in || 3599);
      accessTokenCache.token = token;
      accessTokenCache.expiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;

      return token;
    } catch (error) {
      const responseStatus = error.response?.status;
      const responseData = error.response?.data;
      const blockedByWaf = responseStatus === 403 && isIncapsulaBlock(responseData);

      console.error('M-Pesa access token error:', {
        code: error.code,
        message: error.message,
        status: responseStatus,
        blockedByWaf,
      });

      if (blockedByWaf) {
        throw createMpesaError(
          'Safaricom blocked the M-Pesa token request. Wait for the M-Pesa callback or check Daraja network/IP access.',
          'MPESA_ACCESS_TOKEN_BLOCKED',
          503,
          { providerStatus: responseStatus }
        );
      }

      throw createMpesaError(
        `Failed to get M-Pesa access token: ${error.response?.data?.errorMessage || error.message}`,
        'MPESA_ACCESS_TOKEN_FAILED',
        503,
        { providerStatus: responseStatus }
      );
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
  generatePassword(timestamp, shortCode = process.env.MPESA_SHORT_CODE) {
    const input = shortCode + process.env.MPESA_PASSKEY + timestamp;
    return Buffer.from(input).toString('base64');
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phoneNumber) {
    if (phoneNumber === undefined || phoneNumber === null || String(phoneNumber).trim() === '') {
      throw createMpesaError(
        'Enter the buyer M-Pesa phone number before sending the payment request.',
        'MPESA_PHONE_REQUIRED',
        400
      );
    }

    let formatted = phoneNumber.toString().trim();
    // Remove any non-digit characters
    formatted = formatted.replace(/\D/g, '');

    if (!/^254[71][0-9]{8}$|^0[71][0-9]{8}$|^[71][0-9]{8}$/.test(formatted)) {
      throw createMpesaError(
        'Enter a valid Kenya M-Pesa number, for example 0712345678 or 254712345678.',
        'MPESA_PHONE_INVALID',
        400
      );
    }

    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.substring(1);
    } else if (formatted.startsWith('254')) {
      // Already in correct format
    } else if (formatted.startsWith('+254')) {
      formatted = formatted.substring(1);
    } else {
      formatted = '254' + formatted;
    }
    return formatted;
  }

  /**
   * Withdraw to M-Pesa
   */
  async withdrawToMpesa(userId, amount, phoneNumber) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payment = await Payment.create([{
        user: userId,
        amount,
        currency: 'KES',
        paymentMethod: 'mpesa',
        phoneNumber,
        status: 'pending',
        description: `Withdrawal to M-Pesa account ending in ${phoneNumber.slice(-4)}`,
      }], { session });

      await Transaction.create([{
        user: userId,
        type: 'withdrawal',
        amount,
        status: 'pending',
        reference: payment[0]._id.toString(),
        description: 'M-Pesa withdrawal',
      }], { session });

      const wallet = await Wallet.findOne({ user: userId }).session(session);
      if (wallet) {
        if (wallet.balance < amount) {
          throw new Error('Insufficient balance');
        }
        wallet.balance -= amount;
        await wallet.save({ session });
      } else {
        throw new Error('Wallet not found');
      }

      await session.commitTransaction();

      return {
        success: true,
        message: 'Withdrawal initiated',
        reference: payment[0]._id,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Withdrawal Error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async handleB2CResult(result) {
    const payload = result?.Result || result || {};
    const conversationId = payload.ConversationID || result?.ConversationID;
    const originatorConversationId = payload.OriginatorConversationID || result?.OriginatorConversationID;
    const resultCode = Number(payload.ResultCode ?? result?.ResultCode);
    const resultDesc = payload.ResultDesc || result?.ResultDesc || '';
    const receipt = payload.TransactionID || payload.TransactionReceipt || '';

    if (!conversationId && !originatorConversationId) return null;

    const transaction = await Transaction.findOne({
      type: 'withdrawal',
      status: 'pending',
      $or: [
        { 'metadata.mpesaConversationId': conversationId },
        { 'metadata.mpesaOriginatorConversationId': originatorConversationId },
        { 'metadata.originatorConversationId': originatorConversationId },
        { reference: originatorConversationId },
      ].filter((condition) => Object.values(condition)[0]),
    });

    if (!transaction) return null;

    transaction.metadata = transaction.metadata || new Map();
    transaction.metadata.set('payoutStatus', resultCode === 0 ? 'completed' : 'failed');
    transaction.metadata.set('mpesaResultCode', resultCode);
    transaction.metadata.set('mpesaResultDesc', resultDesc);
    if (receipt) transaction.metadata.set('mpesaReceiptNumber', receipt);
    transaction.status = resultCode === 0 ? 'completed' : 'failed';
    await transaction.save();

    if (resultCode !== 0) {
      const wallet = await Wallet.findOne({ user: transaction.user });
      if (wallet) {
        const balanceBefore = Number(wallet.balance || 0);
        wallet.balance = balanceBefore + Number(transaction.amount || 0);
        await wallet.save();

        await Transaction.create({
          user: transaction.user,
          type: 'refund',
          amount: transaction.amount,
          balanceBefore,
          balanceAfter: wallet.balance,
          reference: `MPESA_WITHDRAW_REFUND_${transaction.reference}`,
          relatedTransactionId: transaction._id,
          description: `Refund for failed M-Pesa withdrawal ${transaction.reference}`,
          status: 'completed',
          metadata: {
            source: 'mpesa_b2c_result',
            failedWithdrawalReference: transaction.reference,
            resultCode,
            resultDesc,
          },
        });
      }
    }

    return transaction;
  }

  async handleB2CTimeout(result) {
    const payload = result?.Result || result || {};
    const conversationId = payload.ConversationID || result?.ConversationID;
    const originatorConversationId = payload.OriginatorConversationID || result?.OriginatorConversationID;

    if (!conversationId && !originatorConversationId) return null;

    return Transaction.findOneAndUpdate(
      {
        type: 'withdrawal',
        status: 'pending',
        $or: [
          { 'metadata.mpesaConversationId': conversationId },
          { 'metadata.mpesaOriginatorConversationId': originatorConversationId },
          { 'metadata.originatorConversationId': originatorConversationId },
          { reference: originatorConversationId },
        ].filter((condition) => Object.values(condition)[0]),
      },
      {
        'metadata.payoutStatus': 'timeout',
        'metadata.mpesaTimeoutAt': new Date(),
      },
      { new: true }
    );
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
