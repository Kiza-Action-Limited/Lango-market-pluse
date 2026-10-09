const walletService = require('../services/payment/wallet.service');
const ledgerService = require('../services/payment/ledger.service');
const vertoPaymentService = require('../services/payment/vertoPayment.service');
const vertoWebhookService = require('../services/payment/vertoWebhook.service');
const billingService = require('../services/subscription/billing.service');
const { validationResult } = require('express-validator');
const smsService = require('../services/notification/sms.service');

const sendPaymentSms = async (user, message, context = 'payment SMS') => {
  const phone = user?.phone;
  if (!phone || !message) return null;

  try {
    return await smsService.sendToPhone(phone, message);
  } catch (error) {
    console.warn(`${context} failed:`, error.message);
    return null;
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
 * Record an SMS credit top-up after payment confirmation
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
    sendPaymentSms(
      req.user,
      `Lango Market Pulse: SMS credits topped up. Added ${result.creditsAdded || credits || amount} credits. Balance: ${result.newBalance ?? result.balance ?? 'updated'}.`,
      'SMS credit top-up SMS'
    );

    res.status(200).json({
      success: true,
      message: 'SMS credits topped up successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getVertoConfig = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: vertoPaymentService.getSafeConfig(),
    });
  } catch (error) {
    next(error);
  }
};

exports.createVertoPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const result = await vertoPaymentService.createPaymentRequest({
      orderId: req.body.orderId,
      userId: req.user.id,
      idempotencyKey: req.headers['idempotency-key'],
    });

    res.status(200).json({
      success: true,
      message: result.reused ? result.message : 'Verto payment request created.',
      data: {
        paymentId: result.payment?._id,
        providerReference: result.providerReference,
        status: result.status,
        amount: result.amount || result.payment?.amount,
        currency: result.currency || result.payment?.currency,
        checkoutUrl: result.checkoutUrl,
        escrowSupported: vertoPaymentService.getSafeConfig().capabilities.escrow,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.checkVertoPaymentStatus = async (req, res, next) => {
  try {
    const payment = await vertoPaymentService.refreshPaymentStatus(req.params.reference, {
      userId: req.user.id,
      role: req.user.role,
    });

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

exports.getVertoTransactions = async (req, res, next) => {
  try {
    const result = await vertoPaymentService.listTransactions(req.query);
    res.status(200).json({
      success: true,
      ...result,
      config: vertoPaymentService.getSafeConfig(),
    });
  } catch (error) {
    next(error);
  }
};

exports.getVertoPayouts = async (req, res, next) => {
  try {
    const result = await vertoPaymentService.listPayouts(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.createVertoPayout = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const result = await vertoPaymentService.initiatePayout({
      orderId: req.body.orderId,
      role: req.body.role || 'seller',
      actorId: req.user.id,
      reason: req.body.reason,
      idempotencyKey: req.headers['idempotency-key'],
    });

    res.status(200).json({
      success: true,
      message: 'Verto payout request submitted.',
      data: result.payout,
    });
  } catch (error) {
    next(error);
  }
};

exports.getVertoWallets = async (req, res, next) => {
  try {
    const wallets = await vertoPaymentService.getWallets();
    res.status(200).json({
      success: true,
      data: wallets,
    });
  } catch (error) {
    next(error);
  }
};

exports.handleVertoWebhook = async (req, res, next) => {
  try {
    const result = await vertoWebhookService.handle(req);
    res.status(200).json({
      success: true,
      duplicate: Boolean(result.duplicate),
      processingStatus: result.event?.processingStatus,
    });
  } catch (error) {
    next(error);
  }
};
