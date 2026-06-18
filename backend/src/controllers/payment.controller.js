const mpesaService = require('../services/payment/mpesa.service');
const walletService = require('../services/payment/wallet.service');
const ledgerService = require('../services/payment/ledger.service');
const billingService = require('../services/subscription/billing.service');
const Payment = require('../models/Payment.model');
const { validationResult } = require('express-validator');

const getMetadataValue = (metadata, key) => {
  if (!metadata) return undefined;
  if (typeof metadata.get === 'function') return metadata.get(key);
  return metadata[key];
};

/**
 * Initiate M-Pesa STK Push for order payment
 * POST /api/v1/payments/mpesa/stkpush
 */
exports.initiateMpesaPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderId = req.body.orderId || req.params.id;
    const phoneNumber = req.body.phoneNumber || req.user.phone;
    const result = await mpesaService.initiatePayment(orderId, phoneNumber, req.user.id);
    res.status(200).json({
      success: true,
      message: 'STK Push sent to your phone',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check M-Pesa transaction status
 * GET /api/v1/payments/mpesa/status/:checkoutRequestId
 */
exports.checkMpesaStatus = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.params;
    const status = await mpesaService.queryPaymentStatus(checkoutRequestId);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate M-Pesa STK Push for subscription payment
 * POST /api/v1/payments/mpesa/subscription/stkpush
 */
exports.initiateSubscriptionMpesaPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const phoneNumber = req.body.phoneNumber || req.user.phone;
    await billingService.assertUserCanUseSubscriptionPlan(req.user.id, req.body.planId);
    const result = await mpesaService.initiateSubscriptionPayment(req.body.planId, phoneNumber, req.user.id);

    res.status(200).json({
      success: true,
      message: 'M-Pesa prompt sent to your phone. Enter your PIN to complete payment.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check subscription M-Pesa payment and activate plan after success
 * GET /api/v1/payments/mpesa/subscription/status/:checkoutRequestId
 */
exports.checkSubscriptionMpesaStatus = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.params;
    let payment = await Payment.findOne({ checkoutRequestId, user: req.user.id });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Subscription payment not found',
      });
    }

    const purpose = getMetadataValue(payment.metadata, 'purpose');
    const planId = getMetadataValue(payment.metadata, 'planId');
    if (purpose !== 'subscription' || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Payment is not a subscription payment',
      });
    }

    if (payment.status === 'processing' || payment.status === 'pending') {
      try {
        await mpesaService.queryPaymentStatus(checkoutRequestId);
        payment = await Payment.findOne({ checkoutRequestId, user: req.user.id });
      } catch (error) {
        return res.status(200).json({
          success: true,
          data: {
            status: payment.status,
            checkoutRequestId,
            planId,
            message: error.message || 'Waiting for M-Pesa confirmation',
          },
        });
      }
    }

    if (payment.status === 'completed') {
      const paymentReference = payment.mpesaReceiptNumber || payment.transactionId || checkoutRequestId;
      const subscription = await billingService.activatePaidSubscription(req.user.id, planId, {
        paymentReference,
        payment,
      });

      return res.status(200).json({
        success: true,
        message: 'Payment confirmed. Subscription activated.',
        data: {
          status: 'completed',
          activated: true,
          checkoutRequestId,
          planId,
          subscription,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        activated: false,
        checkoutRequestId,
        planId,
        message: payment.failureReason || 'Waiting for M-Pesa confirmation',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get wallet balance for authenticated user
 * GET /api/v1/payments/wallet/balance
 */
exports.getWalletBalance = async (req, res, next) => {
  try {
    const balance = await walletService.getBalance(req.user.id);
    res.status(200).json({
      success: true,
      data: { balance },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer from wallet to another user
 * POST /api/v1/payments/wallet/transfer
 */
exports.walletTransfer = async (req, res, next) => {
  try {
    const { toUserId, amount, description } = req.body;
    const transaction = await walletService.transfer(req.user.id, toUserId, amount, description);
    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction history (ledger)
 * GET /api/v1/payments/transactions
 */
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const result = await ledgerService.getTransactions(req.user.id, { page, limit, type });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw from wallet to M-Pesa
 * POST /api/v1/payments/wallet/withdraw
 */
exports.withdrawToMpesa = async (req, res, next) => {
  try {
    const { amount, phoneNumber } = req.body;
    const result = await walletService.withdraw(req.user.id, amount, phoneNumber);
    res.status(200).json({
      success: true,
      message: 'Withdrawal initiated',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record an M-Pesa SMS credit top-up after payment confirmation
 * POST /api/v1/payments/sms-credits/topup
 */
exports.topUpSmsCredits = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { credits, amount, paymentReference, paymentCompleted } = req.body;
    const result = await billingService.topUpSmsCredits(req.user.id, {
      credits,
      amount,
      paymentReference,
      paymentCompleted,
    });

    res.status(200).json({
      success: true,
      message: 'SMS credits topped up successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
