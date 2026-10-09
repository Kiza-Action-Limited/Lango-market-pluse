const mongoose = require('mongoose');
const Payment = require('../../models/Payment.model');
const Order = require('../../models/Order.model');
const Payout = require('../../models/Payout.model');
const Transaction = require('../../models/Transaction.model');
const AuditLog = require('../../models/AuditLog.model');
const Logistics = require('../../models/Logistics.model');
const notificationService = require('../notification/notification.service');
const escrowService = require('../order/escrow.service');
const vertoClient = require('./vertoClient.service');
const { getSafeVertoConfig, getVertoConfig } = require('../../config/verto');
const { createVertoError } = require('./vertoAuth.service');
const { toMinorUnits, normalizeMoney } = require('../../utils/money');

const asObject = (value) => {
  if (!value) return {};
  if (typeof value.get === 'function') return Object.fromEntries(value);
  return value;
};

const getReference = (payload = {}) => (
  payload.id ||
  payload.paymentId ||
  payload.paymentReference ||
  payload.reference ||
  payload.transactionId ||
  payload.data?.id ||
  payload.data?.paymentId ||
  payload.data?.paymentReference ||
  payload.data?.reference ||
  payload.data?.transactionId
);

const getStatus = (payload = {}) => String(
  payload.status ||
  payload.paymentStatus ||
  payload.state ||
  payload.data?.status ||
  payload.data?.paymentStatus ||
  payload.data?.state ||
  'processing'
).toLowerCase();

const mapPaymentStatus = (providerStatus) => {
  const normalized = String(providerStatus || '').toLowerCase();
  if (['completed', 'complete', 'paid', 'success', 'successful', 'settled', 'processed'].includes(normalized)) return 'completed';
  if (['failed', 'rejected', 'declined', 'errored'].includes(normalized)) return 'failed';
  if (['cancelled', 'canceled', 'expired'].includes(normalized)) return 'cancelled';
  if (['refunded', 'refund'].includes(normalized)) return 'refunded';
  return 'processing';
};

const buildCommissionBreakdown = (order) => {
  const gross = normalizeMoney(order.totalAmount);
  const logistics = normalizeMoney(order.logisticsFee || 0);
  const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || process.env.VERTO_PLATFORM_COMMISSION_RATE || 0.05);
  const productSubtotal = normalizeMoney(order.productSubtotal || (Number(order.quantity || 0) * Number(order.unitPrice || 0)));
  const commission = normalizeMoney(Math.min(productSubtotal, gross) * Math.max(0, commissionRate));
  const sellerAllocation = normalizeMoney(Math.max(0, gross - logistics - commission));

  return {
    gross,
    platformCommission: commission,
    sellerAllocation,
    logisticsAllocation: logistics,
  };
};

const assertOrderPayable = async (orderId, userId) => {
  let order = null;
  if (mongoose.Types.ObjectId.isValid(orderId)) {
    order = await Order.findById(orderId);
  }
  if (!order) {
    order = await Order.findOne({ orderNumber: orderId });
  }
  if (!order) throw createVertoError('Order not found.', 'ORDER_NOT_FOUND', 404);
  if (String(order.buyer) !== String(userId)) throw createVertoError('You cannot pay for this order.', 'VERTO_ORDER_FORBIDDEN', 403);
  if (!['pending_payment', 'AWAITING_PAYMENT'].includes(order.status)) {
    throw createVertoError('Order is not ready for payment.', 'VERTO_ORDER_NOT_PAYABLE', 409);
  }
  return order;
};

class VertoPaymentService {
  getSafeConfig() {
    return getSafeVertoConfig();
  }

  async syncEscrowForPayment(payment, providerReference, providerResponse = {}) {
    const config = getVertoConfig();
    if (!config.escrowEnabled || !payment.order || !providerReference) return null;

    const order = await Order.findById(payment.order);
    if (!order) return null;

    const metadata = asObject(payment.metadata);
    await escrowService.createPendingEscrow(order, {
      checkoutRequestId: providerReference,
      merchantRequestId: metadata.externalReference || providerReference,
    });

    if (payment.status !== 'completed') return null;

    const escrow = await escrowService.markPaymentHeld({
      checkoutRequestId: providerReference,
      amount: payment.amount,
      transactionId: providerReference,
      transactionDate: payment.paidAt || new Date(),
    });

    if (escrow) {
      payment.holdStatus = 'held';
      payment.releaseStatus = 'not_requested';
      payment.metadata = {
        ...metadata,
        escrowId: escrow._id.toString(),
        escrowStatus: escrow.status,
        lastEscrowSyncProviderResponse: providerResponse,
      };
    }

    return escrow;
  }

  async createPaymentRequest({ orderId, userId, idempotencyKey }) {
    const config = getVertoConfig();
    if (!this.getSafeConfig().capabilities.payments) {
      throw createVertoError('Verto payments are not enabled or fully configured.', 'VERTO_PAYMENTS_UNAVAILABLE', 503);
    }

    const order = await assertOrderPayable(orderId, userId);
    const existing = await Payment.findOne({
      order: order._id,
      user: userId,
      paymentMethod: 'verto',
      status: { $in: ['pending', 'processing', 'completed'] },
    }).sort({ createdAt: -1 });

    if (existing) {
      const existingReference = existing.providerPaymentReference || existing.transactionId;
      await this.syncEscrowForPayment(existing, existingReference, asObject(existing.metadata).lastProviderResponse);
      if (existing.isModified()) await existing.save();
      return {
        reused: true,
        payment: existing,
        providerReference: existingReference,
        status: existing.status,
        message: existing.status === 'completed'
          ? 'Order already has a confirmed Verto payment.'
          : 'Existing Verto payment request is still active.',
      };
    }

    const breakdown = buildCommissionBreakdown(order);
    const externalReference = `${order.orderNumber || order._id.toString()}-${Date.now()}`;
    const payload = {
      type: config.paymentType,
      amount: breakdown.gross,
      currency: order.currency || 'KES',
      reference: externalReference,
      paymentReference: externalReference,
      customPaymentReference: externalReference,
      description: `Lango Market Plus order ${order.orderNumber || order._id}`,
      metadata: {
        langoOrderId: order._id.toString(),
        langoOrderNumber: order.orderNumber,
        buyerId: String(order.buyer),
        sellerId: String(order.seller),
      },
      ...(config.sourceWalletId ? { sourceWalletId: config.sourceWalletId } : {}),
      ...(config.targetWalletId ? { targetWalletId: config.targetWalletId } : {}),
      ...(config.targetCompanyId ? { targetCompanyId: config.targetCompanyId } : {}),
    };

    const providerResponse = await vertoClient.request({
      baseUrl: config.paymentBaseUrl,
      method: 'POST',
      path: config.paymentCreatePath,
      data: payload,
      idempotencyKey,
    });

    const providerReference = getReference(providerResponse) || externalReference;
    const providerStatus = getStatus(providerResponse);
    const status = mapPaymentStatus(providerStatus);

    const payment = await Payment.create({
      user: userId,
      order: order._id,
      amount: breakdown.gross,
      amountMinor: toMinorUnits(breakdown.gross),
      currency: order.currency || 'KES',
      paymentMethod: 'verto',
      provider: 'verto',
      providerPaymentReference: providerReference,
      providerStatus,
      transactionId: providerReference,
      status,
      paidAt: status === 'completed' ? new Date() : undefined,
      platformCommission: breakdown.platformCommission,
      sellerAllocation: breakdown.sellerAllocation,
      logisticsAllocation: breakdown.logisticsAllocation,
      holdStatus: config.escrowEnabled ? 'pending' : 'not_supported',
      releaseStatus: config.escrowEnabled ? 'not_requested' : 'not_supported',
      payoutStatus: config.payoutsEnabled ? 'not_requested' : 'not_supported',
      metadata: {
        externalReference,
        providerResponse,
        providerPayload: payload,
        capabilityNote: config.escrowEnabled
          ? 'Verto escrow/hold marked pending until provider confirms a supported hold state.'
          : 'Verto escrow/conditional release is disabled; wallet funds must not be represented as escrow.',
      },
    });

    order.paymentIntentId = providerReference;
    order.status = status === 'completed' && config.escrowEnabled ? 'FUNDS_HELD' : 'AWAITING_PAYMENT';
    order.paidAt = status === 'completed' ? new Date() : order.paidAt;
    await order.save();

    await this.syncEscrowForPayment(payment, providerReference, providerResponse);
    if (payment.isModified()) await payment.save();

    await AuditLog.create({
      entityType: 'Payment',
      entityId: payment._id,
      action: 'verto.payment.created',
      actor: userId,
      newValue: {
        providerReference,
        status,
        amount: breakdown.gross,
        currency: order.currency || 'KES',
      },
      metadata: {
        orderId: order._id.toString(),
        provider: 'verto',
      },
    });

    return {
      payment,
      providerReference,
      status,
      amount: breakdown.gross,
      currency: order.currency || 'KES',
      checkoutUrl: providerResponse.checkoutUrl || providerResponse.paymentUrl || providerResponse.data?.checkoutUrl || providerResponse.data?.paymentUrl,
      providerResponse,
    };
  }

  async refreshPaymentStatus(providerReference, requester = {}) {
    const config = getVertoConfig();
    const safe = this.getSafeConfig();
    const payment = await Payment.findOne({
      paymentMethod: 'verto',
      $or: [
        { providerPaymentReference: providerReference },
        { transactionId: providerReference },
      ],
    });

    if (!payment) throw createVertoError('Verto payment not found.', 'VERTO_PAYMENT_NOT_FOUND', 404);
    if (String(payment.user) !== String(requester.userId) && requester.role !== 'admin') {
      throw createVertoError('You cannot view this payment.', 'VERTO_PAYMENT_FORBIDDEN', 403);
    }
    if (!safe.capabilities.payments) {
      return payment;
    }

    const statusPath = config.paymentStatusPath.replace(':reference', encodeURIComponent(providerReference));
    const providerResponse = await vertoClient.request({
      baseUrl: config.paymentBaseUrl,
      method: 'GET',
      path: statusPath,
    });

    await this.applyProviderStatus({ payment, providerResponse, source: 'status_query' });
    return Payment.findById(payment._id);
  }

  async applyProviderStatus({ payment, providerResponse, source = 'provider' }) {
    const config = getVertoConfig();
    const providerStatus = getStatus(providerResponse);
    const nextStatus = mapPaymentStatus(providerStatus);
    const oldStatus = payment.status;
    const providerReference = getReference(providerResponse) || payment.providerPaymentReference || payment.transactionId;

    payment.providerStatus = providerStatus;
    payment.providerPaymentReference = providerReference;
    payment.transactionId = payment.transactionId || providerReference;
    payment.status = nextStatus;
    payment.reconciliationStatus = 'matched';

    const metadata = asObject(payment.metadata);
    payment.metadata = {
      ...metadata,
      lastProviderStatusSource: source,
      lastProviderResponse: providerResponse,
      lastProviderStatusAt: new Date().toISOString(),
    };

    if (nextStatus === 'completed' && oldStatus !== 'completed') {
      payment.paidAt = new Date();
      if (config.escrowEnabled) {
        payment.holdStatus = 'pending';
      } else {
        payment.holdStatus = 'not_supported';
        payment.releaseStatus = 'not_supported';
      }

      if (payment.order) {
        const order = await Order.findById(payment.order);
        if (order) {
          order.status = config.escrowEnabled ? 'FUNDS_HELD' : 'processing';
          order.paidAt = payment.paidAt;
          order.paymentIntentId = providerReference;
          await order.save();
        }
      }

      await this.syncEscrowForPayment(payment, providerReference, providerResponse);

      await Transaction.findOneAndUpdate(
        { reference: providerReference, type: 'payment' },
        {
          $setOnInsert: {
            user: payment.user,
            type: 'payment',
            amount: payment.amount,
            balanceBefore: 0,
            balanceAfter: 0,
            currency: payment.currency,
            reference: providerReference,
            orderId: payment.order,
            description: 'Verto payment confirmed for Lango order',
            status: 'completed',
            metadata: {
              provider: 'verto',
              paymentId: payment._id.toString(),
              holdStatus: payment.holdStatus,
            },
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    if (nextStatus === 'failed' || nextStatus === 'cancelled') {
      payment.failureReason = providerResponse.message || providerResponse.reason || providerStatus;
      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, { status: 'AWAITING_PAYMENT' });
      }
      if (config.escrowEnabled) {
        await escrowService.markPaymentFailed({
          checkoutRequestId: providerReference,
          errorMessage: payment.failureReason,
        });
        payment.holdStatus = 'failed';
      }
    }

    await payment.save();

    await AuditLog.create({
      entityType: 'Payment',
      entityId: payment._id,
      action: 'verto.payment.status_changed',
      oldValue: { status: oldStatus },
      newValue: { status: payment.status, providerStatus },
      metadata: {
        provider: 'verto',
        source,
        providerReference,
      },
    });

    return payment;
  }

  async listTransactions(filters = {}) {
    const query = { paymentMethod: 'verto' };
    if (filters.status && filters.status !== 'all') query.status = filters.status;
    if (filters.orderId && mongoose.Types.ObjectId.isValid(filters.orderId)) query.order = filters.orderId;
    if (filters.sellerId && mongoose.Types.ObjectId.isValid(filters.sellerId)) {
      const orders = await Order.find({ seller: filters.sellerId }).select('_id').lean();
      query.order = { $in: orders.map((order) => order._id) };
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('user', 'fullName name email phone')
        .populate('order', 'orderNumber totalAmount status buyer seller logisticsFee deliveredAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return {
      transactions: payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getWallets() {
    const config = getVertoConfig();
    if (!this.getSafeConfig().capabilities.wallets) {
      throw createVertoError('Verto wallet access is not enabled or fully configured.', 'VERTO_WALLETS_UNAVAILABLE', 503);
    }
    return vertoClient.request({
      baseUrl: config.walletBaseUrl,
      method: 'GET',
      path: config.walletsPath,
    });
  }

  async initiatePayout({ orderId, role = 'seller', recipientId, amountOverride, actorId, reason, idempotencyKey }) {
    const config = getVertoConfig();
    const safe = this.getSafeConfig();
    if (!safe.capabilities.payouts) {
      throw createVertoError('Verto payouts are disabled until provider payout capability is approved and configured.', 'VERTO_PAYOUTS_UNAVAILABLE', 409);
    }

    const order = await Order.findById(orderId);
    if (!order) throw createVertoError('Order not found.', 'ORDER_NOT_FOUND', 404);
    if (!['DELIVERED', 'delivered', 'completed', 'RELEASED'].includes(order.status)) {
      throw createVertoError('Order is not delivery-verified for payout.', 'VERTO_RELEASE_NOT_ELIGIBLE', 409);
    }
    if (order.dispute || ['DISPUTED', 'disputed'].includes(order.status)) {
      throw createVertoError('Open dispute blocks payout release.', 'VERTO_PAYOUT_BLOCKED_BY_DISPUTE', 409);
    }

    const logistics = await Logistics.findOne({ order: order._id }).select('status driver fleetOwner');
    if (logistics && !['delivered', 'auto_released'].includes(String(logistics.status || '').toLowerCase())) {
      throw createVertoError('Logistics delivery is not verified for payout.', 'VERTO_DELIVERY_NOT_VERIFIED', 409);
    }

    const recipient = recipientId || (role === 'driver'
      ? (logistics?.driver || logistics?.fleetOwner)
      : role === 'fleet_owner'
        ? logistics?.fleetOwner
        : order.seller);
    if (!recipient) throw createVertoError('Payout recipient not found.', 'VERTO_PAYOUT_RECIPIENT_MISSING', 409);

    const existing = await Payout.findOne({
      order: order._id,
      role,
      channel: 'verto',
      status: { $in: ['pending', 'queued', 'submitted', 'completed'] },
    });
    if (existing) {
      throw createVertoError('A Verto payout already exists for this order and role.', 'VERTO_DUPLICATE_PAYOUT', 409);
    }

    const breakdown = buildCommissionBreakdown(order);
    const amount = amountOverride !== undefined && amountOverride !== null
      ? normalizeMoney(amountOverride)
      : role === 'driver' || role === 'fleet_owner'
        ? breakdown.logisticsAllocation
        : breakdown.sellerAllocation;
    if (amount <= 0) throw createVertoError('Payout amount must be greater than zero.', 'VERTO_PAYOUT_AMOUNT_INVALID', 400);

    const externalReference = `PAYOUT-${order.orderNumber || order._id}-${role}-${Date.now()}`;
    const payload = {
      type: config.payoutPaymentType,
      amount,
      currency: order.currency || 'KES',
      reference: externalReference,
      paymentReference: externalReference,
      customPaymentReference: externalReference,
      description: `Lango ${role} payout for ${order.orderNumber || order._id}`,
      metadata: {
        langoOrderId: order._id.toString(),
        role,
        recipientId: String(recipient),
        reason,
      },
      ...(config.sourceWalletId ? { sourceWalletId: config.sourceWalletId } : {}),
      ...(config.targetWalletId ? { targetWalletId: config.targetWalletId } : {}),
    };

    const providerResponse = await vertoClient.request({
      baseUrl: config.paymentBaseUrl,
      method: 'POST',
      path: config.paymentCreatePath,
      data: payload,
      idempotencyKey,
    });

    const providerReference = getReference(providerResponse) || externalReference;
    const providerStatus = getStatus(providerResponse);
    const status = ['completed', 'success', 'successful', 'paid'].includes(providerStatus) ? 'completed' : 'submitted';

    const payout = await Payout.create({
      order: order._id,
      recipient,
      role,
      channel: 'verto',
      amount,
      amountMinor: toMinorUnits(amount),
      currency: order.currency || 'KES',
      status,
      provider: 'verto',
      providerPayoutReference: providerReference,
      providerStatus,
      platformCommission: role === 'seller' ? breakdown.platformCommission : 0,
      submittedAt: new Date(),
      completedAt: status === 'completed' ? new Date() : undefined,
      metadata: {
        reason,
        requestedBy: actorId,
        providerResponse,
      },
    });

    await Payment.updateMany(
      { order: order._id, paymentMethod: 'verto' },
      { payoutStatus: status === 'completed' ? 'completed' : 'processing' }
    );

    await AuditLog.create({
      entityType: 'Payout',
      entityId: payout._id,
      action: 'verto.payout.created',
      actor: actorId,
      newValue: { status, amount, providerReference },
      metadata: { orderId: order._id.toString(), role, provider: 'verto', reason },
    });

    if (status === 'completed') {
      await notificationService.create(recipient, {
        type: 'in_app',
        channel: 'payment',
        title: 'Payout completed',
        body: `Your ${role} payout for ${order.orderNumber || order._id} has been confirmed.`,
        data: { orderId: order._id, payoutId: payout._id, provider: 'verto' },
      }).catch(() => null);
    }

    return { payout, providerResponse };
  }

  async listPayouts(filters = {}) {
    const query = { channel: 'verto' };
    if (filters.status && filters.status !== 'all') query.status = filters.status;
    if (filters.orderId && mongoose.Types.ObjectId.isValid(filters.orderId)) query.order = filters.orderId;

    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const [payouts, total] = await Promise.all([
      Payout.find(query)
        .populate('recipient', 'fullName name email phone')
        .populate('order', 'orderNumber status totalAmount')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(query),
    ]);

    return {
      payouts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}

module.exports = new VertoPaymentService();
