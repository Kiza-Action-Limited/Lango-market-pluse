const Order = require('../../models/Order.model');
const Escrow = require('../../models/Escrow.model');
const Dispute = require('../../models/Dispute.model');
const Logistics = require('../../models/Logistics.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const SinkingFund = require('../../models/SinkingFund.model');
const walletService = require('../payment/wallet.service');
const productService = require('../inventory/product.service');
const { escrowQueue } = require('../../config/redis');
const auditService = require('../audit.service');
const trustPolicy = require('../trustPolicy.service');
const axios = require('axios');

const AUTO_RELEASE_MS = 72 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 0.075);
const SINKING_FUND_RATE = Number(process.env.SINKING_FUND_RATE || 0.10);
const ESCROW_API_TIMEOUT_MS = Number(process.env.ESCROW_API_TIMEOUT_MS || 15000);
const SUPPORTED_ESCROW_CURRENCIES = ['usd', 'aud', 'euro', 'gbp', 'cad'];

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isAdminRole = (role) => ['admin', 'ADMIN'].includes(role);
const httpError = (message, statusCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const inferEscrowStatusFromOrder = (status) => {
  if (['DELIVERED', 'delivered'].includes(status)) return 'DELIVERED';
  if (['IN_TRANSIT', 'dispatched'].includes(status)) return 'IN_TRANSIT';
  if (['FUNDS_HELD', 'payment_escrowed', 'processing'].includes(status)) return 'HELD';
  if (['AWAITING_PAYMENT'].includes(status)) return 'AWAITING_PAYMENT';
  return null;
};

const truncate = (value, maxLength) => String(value || '').trim().slice(0, maxLength);
const getId = (value) => value?._id?.toString?.() || value?.toString?.();

class EscrowService {
  async createPendingEscrow(order, { checkoutRequestId, merchantRequestId }) {
    const logistics = await Logistics.findOne({ order: order._id }).select('_id shippingCost routeInfo');
    const escrow = await Escrow.findOneAndUpdate(
      { order: order._id },
      {
        $setOnInsert: {
          order: order._id,
          buyer: order.buyer,
          seller: order.seller,
          amount: order.totalAmount,
          status: 'AWAITING_PAYMENT',
          platformFeeRate: PLATFORM_FEE_RATE,
          logistics: logistics?._id,
          metadata: {
            productSubtotal: Number(order.productSubtotal || (Number(order.quantity || 0) * Number(order.unitPrice || 0))),
            logisticsFee: Number(order.logisticsFee || logistics?.shippingCost || 0),
            logisticsDistanceKm: Number(order.logisticsDistanceKm || logistics?.routeInfo?.totalDistanceKm || 0),
            splitMode: 'product_plus_logistics',
          },
        },
        $set: {
          mpesaCheckoutId: checkoutRequestId,
          merchantRequestId,
          amount: order.totalAmount,
          ...(logistics?._id ? { logistics: logistics._id } : {}),
        },
      },
      { returnDocument: 'after', upsert: true }
    );

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'STK_PUSH_INITIATED',
      actor: order.buyer,
      newValue: { checkoutRequestId, merchantRequestId, amount: order.totalAmount },
    });

    return escrow;
  }

  async markPaymentHeld({ checkoutRequestId, amount, transactionId, transactionDate }) {
    const escrow = await Escrow.findOne({ mpesaCheckoutId: checkoutRequestId });
    if (!escrow) return null;

    const order = await Order.findById(escrow.order);
    if (!order) return null;

    const alreadyHeld = escrow.status === 'HELD' && order.paidAt;
    if (alreadyHeld && order.inventoryCommittedAt) {
      return escrow;
    }

    const oldEscrowStatus = escrow.status;
    const paidAt = transactionDate ? new Date(String(transactionDate)) : new Date();
    const logistics = await Logistics.findOne({ order: order._id }).select('_id shippingCost routeInfo');

    if (!order.inventoryCommittedAt) {
      await productService.commitReservedStock(order.product, order.quantity);
      order.inventoryCommittedAt = new Date();
    }

    if (!alreadyHeld) {
      escrow.status = 'HELD';
      escrow.amount = Number(amount || escrow.amount);
      escrow.mpesaReceiptNumber = transactionId;
      escrow.paidAt = paidAt;
      escrow.heldAt = new Date();
      if (logistics?._id) escrow.logistics = logistics._id;
      escrow.metadata.set('productSubtotal', Number(order.productSubtotal || (Number(order.quantity || 0) * Number(order.unitPrice || 0))));
      escrow.metadata.set('logisticsFee', Number(order.logisticsFee || logistics?.shippingCost || 0));
      escrow.metadata.set('logisticsDistanceKm', Number(order.logisticsDistanceKm || logistics?.routeInfo?.totalDistanceKm || 0));
      escrow.metadata.set('splitMode', 'product_plus_logistics');
      await escrow.save();
    }

    const oldOrderStatus = order.status;
    order.status = 'FUNDS_HELD';
    order.paidAt = escrow.paidAt || paidAt;
    order.paymentIntentId = checkoutRequestId;
    await order.save();

    if (!alreadyHeld) {
      await Transaction.create({
        user: order.buyer,
        type: 'escrow_hold',
        amount: escrow.amount,
        balanceAfter: 0,
        reference: transactionId || checkoutRequestId,
        orderId: order._id,
        description: `M-Pesa escrow hold for order ${order._id}`,
        metadata: { checkoutRequestId, transactionDate },
      });

      await auditService.record({
        entityType: 'Escrow',
        entityId: escrow._id,
        action: 'FUNDS_HELD',
        actor: order.buyer,
        oldValue: { escrowStatus: oldEscrowStatus, orderStatus: oldOrderStatus },
        newValue: { escrowStatus: escrow.status, orderStatus: order.status, amount: escrow.amount },
      });
    }

    return escrow;
  }

  async markPaymentFailed({ checkoutRequestId, errorMessage }) {
    const escrow = await Escrow.findOne({ mpesaCheckoutId: checkoutRequestId });
    if (!escrow) return null;

    const oldStatus = escrow.status;
    escrow.status = 'FAILED';
    escrow.metadata.set('failureReason', errorMessage);
    await escrow.save();

    await Order.findByIdAndUpdate(escrow.order, { status: 'EXPIRED' });

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'PAYMENT_FAILED',
      oldValue: { status: oldStatus },
      newValue: { status: 'FAILED', errorMessage },
    });

    return escrow;
  }

  async markInTransit(orderId, actor, gpsCoords) {
    const escrow = await this.getEscrowByOrder(orderId);
    if (escrow.status !== 'HELD') {
      throw new Error(`Escrow must be HELD before pickup scan. Current status: ${escrow.status}`);
    }

    const order = await Order.findById(orderId);
    const oldEscrowStatus = escrow.status;
    const oldOrderStatus = order.status;

    escrow.status = 'IN_TRANSIT';
    await escrow.save();

    order.status = 'IN_TRANSIT';
    await order.save();

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'PICKUP_QR_SCAN_ACCEPTED',
      actor,
      oldValue: { escrowStatus: oldEscrowStatus, orderStatus: oldOrderStatus },
      newValue: { escrowStatus: escrow.status, orderStatus: order.status, gpsCoords },
    });

    return escrow;
  }

  async markDelivered(orderId, actor, gpsCoords) {
    const escrow = await this.getEscrowByOrder(orderId);
    if (escrow.status !== 'IN_TRANSIT') {
      throw new Error(`Escrow must be IN_TRANSIT before delivery scan. Current status: ${escrow.status}`);
    }

    const order = await Order.findById(orderId);
    const logistics = await Logistics.findOne({ order: orderId });
    const autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_MS);

    const oldEscrowStatus = escrow.status;
    const oldOrderStatus = order.status;

    escrow.status = 'DELIVERED';
    escrow.deliveredAt = new Date();
    escrow.autoReleaseAt = autoReleaseAt;
    if (logistics) escrow.logistics = logistics._id;
    await escrow.save();

    order.status = 'DELIVERED';
    order.deliveredAt = escrow.deliveredAt;
    order.escrowReleaseDate = autoReleaseAt;
    await order.save();

    await this.scheduleAutoRelease(orderId, autoReleaseAt);

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'DELIVERY_QR_SCAN_ACCEPTED',
      actor,
      oldValue: { escrowStatus: oldEscrowStatus, orderStatus: oldOrderStatus },
      newValue: { escrowStatus: escrow.status, orderStatus: order.status, autoReleaseAt, gpsCoords },
    });

    return escrow;
  }

  async scheduleAutoRelease(orderId, releaseAt) {
    const delay = Math.max(new Date(releaseAt).getTime() - Date.now(), 0);
    return escrowQueue.add(
      'auto-release',
      { orderId },
      {
        delay,
        jobId: `autorelease-${orderId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: true,
      }
    );
  }

  async cancelAutoRelease(orderId) {
    const job = await escrowQueue.getJob(`autorelease-${orderId}`);
    if (job) await job.remove();
  }

  async releasePayment(orderId, options = {}) {
    const { releasedBy, forceRelease = false, releaseMethod = 'manual_confirm', refundAmount = 0, overrideReason = '' } = options;
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    const escrow = await this.getOrCreateDisputeEscrow(order);

    if (escrow.status === 'RELEASED') {
      return { released: true, alreadyReleased: true, escrow };
    }

    const openDispute = await Dispute.findOne({ order: orderId, status: { $in: ['open', 'under_review'] } });
    if (openDispute && !forceRelease) {
      await this.scheduleAutoRelease(orderId, new Date(Date.now() + 24 * 60 * 60 * 1000));
      return { released: false, blockedByDispute: true, dispute: openDispute._id };
    }

    if (!forceRelease && escrow.status !== 'DELIVERED') {
      throw httpError(`Escrow release requires DELIVERED status. Current status: ${escrow.status}`, 409, {
        currentStatus: escrow.status,
        expectedStatus: 'DELIVERED',
      });
    }

    const logistics = await Logistics.findOne({ order: orderId }).populate('driver fleetOwner');
    const trust = trustPolicy.assertTrustedRelease({ order, logistics, escrow, forceRelease });

    if (forceRelease) {
      await auditService.record({
        entityType: 'Escrow',
        entityId: escrow._id,
        action: 'TRUST_PROOF_OVERRIDE',
        actor: releasedBy,
        newValue: {
          releaseMethod,
          overrideReason,
          trust,
        },
      });
    }

    await this.cancelAutoRelease(orderId);

    const seller = await User.findById(order.seller);
    const buyer = await User.findById(order.buyer);
    const driver = logistics?.driver?._id ? logistics.driver : null;
    const fleetOwner = logistics?.fleetOwner?._id ? logistics.fleetOwner : null;
    const payoutRouting = await this.getDriverPayoutRecipient(driver, fleetOwner);
    const split = this.calculateSplit(escrow.amount, refundAmount, payoutRouting.driverType, { order, logistics });

    const payouts = [];

    if (split.refundAmount > 0 && buyer?._id) {
      payouts.push(await this.sendPayout({
        escrow,
        recipient: buyer,
        role: 'buyer_refund',
        amount: split.refundAmount,
        remarks: `Refund for order ${orderId}`,
      }));
    }

    if (split.sellerPayout > 0 && seller?._id) {
      payouts.push(await this.sendPayout({
        escrow,
        recipient: seller,
        role: 'seller',
        amount: split.sellerPayout,
        remarks: `Seller payout for order ${orderId}`,
      }));
    }

    if (split.driverB2cAmount > 0 && payoutRouting.recipient?._id) {
      payouts.push(await this.sendPayout({
        escrow,
        recipient: payoutRouting.recipient,
        role: payoutRouting.driverType === 'fleet' ? 'fleet_owner' : 'driver',
        amount: split.driverB2cAmount,
        remarks: `Driver payout for order ${orderId}`,
      }));
    }

    if (split.sinkingFundAmount > 0 && driver?._id && payoutRouting.driverType === 'solo') {
      await SinkingFund.findOneAndUpdate(
        { driver: driver._id },
        {
          $inc: { balance: split.sinkingFundAmount, totalContributed: split.sinkingFundAmount },
          $push: {
            contributions: {
              order: order._id,
              logistics: logistics?._id,
              amount: split.sinkingFundAmount,
              driverShare: split.driverShare,
            },
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      await User.findByIdAndUpdate(driver._id, { $inc: { sinkingFundBalance: split.sinkingFundAmount } });
      await Transaction.create({
        user: driver._id,
        type: 'sinking_fund',
        amount: split.sinkingFundAmount,
        balanceAfter: 0,
        reference: orderId,
        orderId: order._id,
        description: `10% maintenance sinking fund lock for order ${orderId}`,
      });
    }

    escrow.status = split.refundAmount > 0 ? (split.releaseBase > 0 ? 'PARTIAL_REFUND' : 'REFUNDED') : 'RELEASED';
    escrow.releasedAt = new Date();
    escrow.refundedAt = split.refundAmount > 0 ? new Date() : undefined;
    escrow.platformFee = split.platformFee;
    escrow.sellerPayout = split.sellerPayout;
    escrow.driverPayout = split.driverB2cAmount;
    escrow.sinkingFundAmount = split.sinkingFundAmount;
    escrow.refundAmount = split.refundAmount;
    escrow.payoutDestination = {
      driverType: payoutRouting.driverType,
      driverRecipient: payoutRouting.recipient?._id,
      recipientPhone: payoutRouting.recipient?.phone,
    };
    await escrow.save();

    order.status = escrow.status === 'RELEASED' ? 'RELEASED' : escrow.status;
    order.releasedAt = escrow.releasedAt;
    await order.save();

    if (logistics) {
      logistics.status = escrow.status === 'RELEASED' ? 'auto_released' : 'disputed';
      logistics.settlement = {
        totalEscrowed: escrow.amount,
        platformFee: split.platformFee,
        sinkingFund: split.sinkingFundAmount,
        sellerPayout: split.sellerPayout,
        driverPayout: payoutRouting.driverType === 'solo' ? split.driverB2cAmount : 0,
        fleetOwnerPayout: payoutRouting.driverType === 'fleet' ? split.driverB2cAmount : 0,
        releasedAt: escrow.releasedAt,
        releaseMethod,
      };
      await logistics.save();
    }

    await Transaction.create(
      {
        user: order.seller,
        type: 'commission',
        amount: split.platformFee,
        balanceAfter: 0,
        reference: orderId,
        orderId: order._id,
        description: `Platform commission retained for order ${orderId}`,
      },
    );

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'ESCROW_RELEASED',
      actor: releasedBy,
      newValue: { split, payoutRouting, releaseMethod, payouts, trust, overrideReason: forceRelease ? overrideReason : undefined },
    });

    return { released: true, escrow, split, payouts };
  }

  calculateSplit(totalAmount, refundAmount = 0, driverType = 'solo', context = {}) {
    const total = money(totalAmount);
    const refund = money(Math.min(Number(refundAmount || 0), total));
    const releaseBase = money(total - refund);
    const order = context.order || {};
    const logistics = context.logistics || {};
    const productSubtotal = money(order.productSubtotal || (Number(order.quantity || 0) * Number(order.unitPrice || 0)));
    const logisticsFee = money(order.logisticsFee || logistics.shippingCost || 0);
    const knownBreakdownTotal = money(productSubtotal + logisticsFee);
    const useExplicitBreakdown = knownBreakdownTotal > 0 && Math.abs(knownBreakdownTotal - total) <= Math.max(5, total * 0.03);
    const releaseRatio = total > 0 ? releaseBase / total : 0;

    let platformFee;
    let sellerPayout;
    let driverShare;

    if (useExplicitBreakdown) {
      const releasableProduct = money(productSubtotal * releaseRatio);
      const releasableLogistics = money(logisticsFee * releaseRatio);
      platformFee = money(releasableProduct * PLATFORM_FEE_RATE);
      sellerPayout = money(Math.max(releasableProduct - platformFee, 0));
      driverShare = releasableLogistics;
    } else {
      platformFee = money(releaseBase * PLATFORM_FEE_RATE);
      const net = money(releaseBase - platformFee);
      sellerPayout = money(net * 0.85);
      driverShare = money(net * 0.15);
    }

    const sinkingFundAmount = driverType === 'solo' ? money(driverShare * SINKING_FUND_RATE) : 0;
    const driverB2cAmount = money(driverShare - sinkingFundAmount);

    return {
      total,
      refundAmount: refund,
      releaseBase,
      productSubtotal: useExplicitBreakdown ? productSubtotal : null,
      logisticsFee: useExplicitBreakdown ? logisticsFee : null,
      splitMode: useExplicitBreakdown ? 'product_plus_logistics' : 'legacy_percentage',
      platformFee,
      sellerPayout,
      driverShare,
      sinkingFundAmount,
      driverB2cAmount,
    };
  }

  async getDriverPayoutRecipient(driver, fleetOwner) {
    if (!driver?._id && !fleetOwner?._id) {
      return { driverType: 'none', recipient: null };
    }

    if (fleetOwner?._id) {
      return { driverType: 'fleet', recipient: fleetOwner };
    }

    const driverDoc = driver?._id ? driver : await User.findById(driver);
    const employerId = driverDoc?.employer || driverDoc?.logisticsProfile?.fleetOwner || driverDoc?.ownerAccount;
    if (employerId) {
      const owner = await User.findById(employerId);
      if (owner) return { driverType: 'fleet', recipient: owner };
    }

    return { driverType: 'solo', recipient: driverDoc };
  }

  async sendPayout({ escrow, recipient, role, amount, remarks }) {
    if (!recipient?._id) {
      throw httpError(`Cannot release ${role} payout because recipient account is missing`, 409);
    }

    const value = money(amount);
    if (value <= 0) {
      return {
        recipient: recipient._id,
        role,
        amount: 0,
        status: 'completed',
        skipped: true,
      };
    }

    const reference = `ESCROW_${String(role).toUpperCase()}_${escrow.order}_${Date.now()}`;
    const walletCredit = await walletService.creditWallet(
      recipient._id,
      value,
      reference,
      remarks,
      {
        type: role === 'buyer_refund' ? 'refund' : 'escrow_release',
        orderId: escrow.order,
        metadata: {
          escrowId: escrow._id,
          payoutRole: role,
          payoutChannel: 'wallet',
        },
      }
    );

    const payout = {
      recipient: recipient._id,
      role,
      amount: value,
      status: 'completed',
      requestedAt: new Date(),
      completedAt: new Date(),
      mpesaTransactionId: walletCredit.transaction?._id?.toString(),
    };

    escrow.payouts.push(payout);
    await escrow.save();

    return {
      ...payout,
      wallet: {
        balance: walletCredit.wallet.balance,
        currency: walletCredit.wallet.currency,
      },
    };
  }

  async holdEscrow(orderId, reason, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    const escrow = await this.getOrCreateDisputeEscrow(order);
    const oldStatus = escrow.status;
    escrow.status = 'DISPUTED';
    escrow.metadata.set('holdReason', reason);
    await escrow.save();
    await Order.findByIdAndUpdate(orderId, { status: 'DISPUTED' });

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'ESCROW_HELD',
      actor: adminId,
      oldValue: { status: oldStatus },
      newValue: { status: escrow.status, reason },
    });

    return { held: true, reason, escrow };
  }

  async cancelEscrow(orderId, reason, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    const escrow = await this.getOrCreateDisputeEscrow(order);

    return this.releasePayment(orderId, {
      releasedBy: adminId,
      forceRelease: true,
      releaseMethod: 'admin_refund',
      refundAmount: escrow.amount,
      reason,
    });
  }

  async partialRelease(orderId, amount, userId, reason) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);
    const escrow = await this.getOrCreateDisputeEscrow(order);
    const refundAmount = Math.max(escrow.amount - Number(amount), 0);
    return this.releasePayment(orderId, {
      releasedBy: userId,
      forceRelease: true,
      releaseMethod: 'partial_refund',
      refundAmount,
      reason,
    });
  }

  async raiseDispute(orderId, raisedBy, { reason, description, evidenceUrls = [], evidence = [] }, raisedByRole) {
    const order = await Order.findById(orderId);
    if (!order) throw httpError('Order not found', 404);

    const openDispute = await Dispute.findOne({ order: orderId, status: { $ne: 'closed' } });
    if (openDispute) {
      throw httpError('A dispute already exists for this order', 400);
    }

    const escrow = await this.getOrCreateDisputeEscrow(order, { throwIfMissing: false });
    const allowedEscrowStatuses = ['HELD', 'IN_TRANSIT', 'DELIVERED'];
    const allowedOrderStatuses = ['FUNDS_HELD', 'IN_TRANSIT', 'DELIVERED', 'payment_escrowed', 'processing', 'dispatched', 'delivered'];
    if (escrow && !allowedEscrowStatuses.includes(escrow.status) && !allowedOrderStatuses.includes(order?.status)) {
      throw httpError('Disputes can only be raised while funds are held or within the delivery window', 409, {
        currentStatus: order?.status,
        escrowStatus: escrow.status,
      });
    }

    if (escrow?.deliveredAt && Date.now() - escrow.deliveredAt.getTime() > AUTO_RELEASE_MS) {
      throw httpError('The 72-hour dispute window has expired', 409);
    }

    const normalizedEvidenceUrls = Array.isArray(evidenceUrls) && evidenceUrls.length > 0
      ? evidenceUrls
      : (Array.isArray(evidence) ? evidence : []);

    const dispute = await Dispute.findOneAndUpdate(
      { order: orderId },
      {
        $setOnInsert: { order: orderId, ...(escrow?._id ? { escrow: escrow._id } : {}), raisedBy },
        $set: { reason, description, evidenceUrls: normalizedEvidenceUrls, evidence: normalizedEvidenceUrls, status: 'open' },
        $push: {
          messages: {
            sender: raisedBy,
            message: `Dispute created: ${reason}. ${description || 'No description provided.'}`,
            timestamp: new Date(),
            isAdmin: isAdminRole(raisedByRole),
          },
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (escrow) {
      await this.holdEscrow(orderId, reason, raisedBy);
    } else {
      order.status = 'disputed';
      await order.save();
    }

    return dispute;
  }

  async resolveDispute(disputeId, adminId, { refundAmount, resolution, faultParty, resolutionAmount }) {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) throw httpError('Dispute not found', 404);

    const order = await Order.findById(dispute.order);
    if (!order) throw httpError('Order linked to this dispute was not found', 404);

    const escrow = await this.getOrCreateDisputeEscrow(order);
    const requestedRefund = refundAmount ?? resolutionAmount;
    let finalRefundAmount = money(requestedRefund || 0);

    if (resolution === 'refund_buyer' || resolution === 'cancelled') {
      finalRefundAmount = money(escrow.amount);
    } else if (resolution === 'release_to_seller') {
      finalRefundAmount = 0;
    } else if (resolution === 'partial_refund' && requestedRefund == null) {
      finalRefundAmount = money(escrow.amount * 0.5);
    }

    if (finalRefundAmount > escrow.amount) {
      throw httpError('Refund amount cannot exceed escrow amount', 400, { escrowAmount: escrow.amount });
    }

    dispute.status = finalRefundAmount > 0
      ? (finalRefundAmount >= escrow.amount ? 'resolved_buyer' : 'partial_refund')
      : 'resolved_seller';
    dispute.resolution = resolution || (finalRefundAmount > 0 ? 'partial_refund' : 'release_to_seller');
    dispute.refundAmount = finalRefundAmount;
    dispute.resolutionAmount = finalRefundAmount;
    dispute.faultParty = faultParty;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    await dispute.save();

    if (faultParty) {
      const user = await User.findByIdAndUpdate(
        faultParty,
        { $inc: { trustScore: -0.5 } },
        { returnDocument: 'after' }
      );
      if (user?.trustScore <= 2.5) {
        user.verificationStatus = 'restricted';
        await user.save();
      }
    }

    const release = await this.releasePayment(dispute.order, {
      releasedBy: adminId,
      forceRelease: true,
      releaseMethod: 'dispute_resolution',
      refundAmount: finalRefundAmount,
    });

    await auditService.record({
      entityType: 'Dispute',
      entityId: dispute._id,
      action: 'DISPUTE_RESOLVED',
      actor: adminId,
      newValue: { refundAmount: finalRefundAmount, resolution: dispute.resolution, faultParty },
    });

    return { dispute, release };
  }

  async handleB2CResult(result) {
    const conversationId = result?.ConversationID || result?.Result?.ConversationID;
    const resultCode = result?.ResultCode ?? result?.Result?.ResultCode;
    const resultDesc = result?.ResultDesc || result?.Result?.ResultDesc;
    if (!conversationId) return null;

    const escrow = await Escrow.findOne({ 'payouts.mpesaConversationId': conversationId });
    if (!escrow) return null;

    const payout = escrow.payouts.find((item) => item.mpesaConversationId === conversationId);
    payout.status = Number(resultCode) === 0 ? 'completed' : 'failed';
    payout.failureReason = resultDesc;
    payout.completedAt = new Date();
    await escrow.save();

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'B2C_RESULT',
      newValue: { conversationId, resultCode, resultDesc, payoutStatus: payout.status },
    });

    return payout;
  }

  getEscrowApiConfig() {
    const email = process.env.ESCROW_API_EMAIL || process.env.ESCROW_EMAIL;
    const apiKey = process.env.ESCROW_API_KEY;
    const defaultBaseUrl = process.env.ESCROW_ENV === 'production'
      ? 'https://api.escrow.com/2017-09-01'
      : 'https://api.escrow-sandbox.com/2017-09-01';
    const baseUrl = (process.env.ESCROW_API_BASE_URL || defaultBaseUrl).replace(/\/+$/, '');

    if (!email) {
      throw httpError('ESCROW_API_EMAIL or ESCROW_EMAIL is required for Escrow.com API calls', 500);
    }
    if (!apiKey) {
      throw httpError('ESCROW_API_KEY is required for Escrow.com API calls', 500);
    }

    return { email, apiKey, baseUrl };
  }

  async escrowApiRequest(method, path, { data, params, asCustomer } = {}) {
    const { email, apiKey, baseUrl } = this.getEscrowApiConfig();
    const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

    try {
      const response = await axios({
        method,
        url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
        data,
        params,
        timeout: ESCROW_API_TIMEOUT_MS,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(asCustomer ? { 'As-Customer': asCustomer } : {}),
        },
      });

      return response.data;
    } catch (error) {
      const status = error.response?.status || 502;
      const externalMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.response?.data?.errors?.[0]?.message
        || error.message;
      throw httpError(`Escrow.com API request failed: ${externalMessage}`, status >= 500 ? 502 : status, {
        externalStatus: error.response?.status,
      });
    }
  }

  assertOrderEscrowAccess(order, userId, userRole) {
    if (isAdminRole(userRole)) return;

    const requesterId = userId?.toString();
    if ([getId(order.buyer), getId(order.seller)].includes(requesterId)) return;

    throw httpError('Unauthorized', 403);
  }

  async getOrderForExternalEscrow(orderId, userId, userRole) {
    const order = await Order.findById(orderId)
      .populate('buyer', 'email fullName phone')
      .populate('seller', 'email fullName businessName phone')
      .populate('product', 'name description images category');

    if (!order) throw httpError('Order not found', 404);
    this.assertOrderEscrowAccess(order, userId, userRole);
    return order;
  }

  buildEscrowComTransactionPayload(order, options = {}) {
    const configuredEmail = process.env.ESCROW_API_EMAIL || process.env.ESCROW_EMAIL;
    const buyerCustomer = options.buyerCustomer
      || (options.useConfiguredAccountAsBuyer ? 'me' : order.buyer?.email);
    const sellerCustomer = options.sellerCustomer || order.seller?.email;

    if (!buyerCustomer) {
      throw httpError('Buyer email is required to create an Escrow.com transaction', 422);
    }
    if (!sellerCustomer) {
      throw httpError('Seller email is required to create an Escrow.com transaction', 422);
    }

    const currency = String(options.currency || process.env.ESCROW_CURRENCY || 'usd').toLowerCase();
    if (!SUPPORTED_ESCROW_CURRENCIES.includes(currency)) {
      throw httpError(`Escrow.com currency must be one of: ${SUPPORTED_ESCROW_CURRENCIES.join(', ')}`, 422);
    }

    const reference = truncate(options.reference || order.orderNumber || order._id, 24);
    const title = truncate(options.title || order.product?.name || `Order ${order.orderNumber || order._id}`, 200);
    const description = truncate(
      options.description || order.product?.description || `Lango Market Pulse order ${order.orderNumber || order._id}`,
      500
    );
    const amount = money(options.amount || order.totalAmount);
    const inspectionPeriod = Number(options.inspectionPeriodSeconds || process.env.ESCROW_INSPECTION_PERIOD_SECONDS || AUTO_RELEASE_MS / 1000);
    const quantity = Math.max(1, Math.ceil(Number(options.quantity || order.quantity || 1)));

    return {
      parties: [
        { role: 'buyer', customer: buyerCustomer === configuredEmail ? 'me' : buyerCustomer },
        { role: 'seller', customer: sellerCustomer === configuredEmail ? 'me' : sellerCustomer },
      ],
      currency,
      description: truncate(options.transactionDescription || `Marketplace escrow for ${title}`, 256),
      reference,
      items: [
        {
          title,
          description,
          type: options.itemType || process.env.ESCROW_ITEM_TYPE || 'general_merchandise',
          category: options.category || process.env.ESCROW_ITEM_CATEGORY || 'other_merchandise',
          inspection_period: inspectionPeriod,
          quantity,
          schedule: [
            {
              amount,
              payer_customer: buyerCustomer,
              beneficiary_customer: sellerCustomer,
            },
          ],
          extra_attributes: {
            merchant_url: options.merchantUrl || process.env.APP_URL,
            image_url: options.imageUrl || order.product?.images?.[0]?.url,
          },
        },
      ],
    };
  }

  summarizeExternalTransaction(transaction) {
    const items = Array.isArray(transaction?.items) ? transaction.items : [];
    const schedules = items.flatMap((item) => Array.isArray(item.schedule) ? item.schedule : []);
    const itemStatuses = items.map((item) => item.status || {});
    const allSecured = schedules.length > 0 && schedules.every((schedule) => schedule.status?.secured === true);
    const allShipped = itemStatuses.length > 0 && itemStatuses.every((status) => status.shipped === true);
    const allReceived = itemStatuses.length > 0 && itemStatuses.every((status) => status.received === true);
    const allAccepted = itemStatuses.length > 0 && itemStatuses.every((status) => status.accepted === true);

    let status = 'created';
    if (transaction?.is_cancelled) status = 'cancelled';
    else if (allAccepted) status = 'accepted';
    else if (allReceived) status = 'received';
    else if (allShipped) status = 'shipped';
    else if (allSecured) status = 'secured';

    return {
      id: transaction?.id?.toString(),
      status,
      currency: transaction?.currency,
      description: transaction?.description,
      reference: transaction?.reference,
      isCancelled: Boolean(transaction?.is_cancelled),
      isDraft: Boolean(transaction?.is_draft),
      itemCount: items.length,
      parties: transaction?.parties,
    };
  }

  async createExternalTransaction(orderId, userId, userRole, options = {}) {
    const order = await this.getOrderForExternalEscrow(orderId, userId, userRole);
    const isAdmin = isAdminRole(userRole);
    const adminOnlyOverrides = ['payload', 'forceNew', 'amount', 'buyerCustomer', 'sellerCustomer', 'currency'];
    const usedAdminOnlyOverride = adminOnlyOverrides.some((field) => options[field] !== undefined);
    if (usedAdminOnlyOverride && !isAdmin) {
      throw httpError('Only admins can override Escrow.com transaction parties, amount, currency, or force a new transaction', 403);
    }

    let escrow = await Escrow.findOne({ order: order._id });

    if (escrow?.externalTransactionId && !options.forceNew) {
      return {
        created: false,
        escrow,
        transaction: escrow.metadata.get('escrowComTransaction'),
      };
    }

    const payload = options.payload || this.buildEscrowComTransactionPayload(order, options);
    const transaction = await this.escrowApiRequest('post', '/transaction', { data: payload });
    const summary = this.summarizeExternalTransaction(transaction);

    escrow = await Escrow.findOneAndUpdate(
      { order: order._id },
      {
        $setOnInsert: {
          order: order._id,
          buyer: getId(order.buyer),
          seller: getId(order.seller),
          amount: order.totalAmount,
          status: 'AWAITING_PAYMENT',
          platformFeeRate: PLATFORM_FEE_RATE,
        },
        $set: {
          externalProvider: 'escrow_com',
          externalTransactionId: summary.id,
          externalReference: summary.reference,
          externalStatus: summary.status,
          externalSyncedAt: new Date(),
          currency: String(summary.currency || payload.currency || 'USD').toUpperCase(),
        },
      },
      { returnDocument: 'after', upsert: true }
    );

    escrow.metadata.set('escrowComPayload', payload);
    escrow.metadata.set('escrowComTransaction', transaction);
    await escrow.save();

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'ESCROW_COM_TRANSACTION_CREATED',
      actor: userId,
      newValue: { orderId: order._id, externalTransactionId: summary.id, externalStatus: summary.status },
    });

    return { created: true, escrow, transaction, summary };
  }

  async getExternalTransaction(orderId, userId, userRole) {
    const order = await this.getOrderForExternalEscrow(orderId, userId, userRole);
    const escrow = await Escrow.findOne({ order: order._id });
    if (!escrow?.externalTransactionId) {
      throw httpError('No Escrow.com transaction is linked to this order', 404);
    }

    const transaction = await this.escrowApiRequest('get', `/transaction/${escrow.externalTransactionId}`);
    return { escrow, transaction, summary: this.summarizeExternalTransaction(transaction) };
  }

  async syncExternalTransaction(orderId, userId, userRole) {
    const { escrow, transaction, summary } = await this.getExternalTransaction(orderId, userId, userRole);

    escrow.externalStatus = summary.status;
    escrow.externalReference = summary.reference || escrow.externalReference;
    escrow.externalSyncedAt = new Date();
    escrow.metadata.set('escrowComTransaction', transaction);
    await escrow.save();

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'ESCROW_COM_TRANSACTION_SYNCED',
      actor: userId,
      newValue: { externalTransactionId: summary.id, externalStatus: summary.status },
    });

    return { escrow, transaction, summary };
  }

  async getEscrowStatus(orderId, userId, userRole) {
    const order = await Order.findById(orderId).select('status escrowReleaseDate totalAmount productSubtotal logisticsFee logisticsDistanceKm quantity unitPrice buyer seller paidAt deliveredAt releasedAt paymentIntentId');
    if (!order) throw new Error('Order not found');
    if (!isAdminRole(userRole) && order.buyer.toString() !== userId && order.seller.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    const escrow = await Escrow.findOne({ order: orderId });
    const logistics = await Logistics.findOne({ order: orderId }).select('status shippingCost settlement escrowReleaseDue driver fleetOwner');
    const payoutRouting = logistics
      ? await this.getDriverPayoutRecipient(logistics.driver, logistics.fleetOwner)
      : { driverType: 'none', recipient: null };
    const split = this.calculateSplit(escrow?.amount || order.totalAmount, escrow?.refundAmount || 0, payoutRouting.driverType, { order, logistics });

    return {
      orderId,
      escrowAmount: escrow?.amount || order.totalAmount,
      productSubtotal: order.productSubtotal,
      logisticsFee: order.logisticsFee || logistics?.shippingCost || 0,
      logisticsDistanceKm: order.logisticsDistanceKm,
      orderStatus: order.status,
      escrowStatus: escrow?.status || 'AWAITING_PAYMENT',
      expectedReleaseDate: escrow?.autoReleaseAt || order.escrowReleaseDate,
      paidAt: escrow?.paidAt || order.paidAt,
      heldAt: escrow?.heldAt,
      deliveredAt: escrow?.deliveredAt || order.deliveredAt,
      releasedAt: escrow?.releasedAt || order.releasedAt,
      paymentIntentId: order.paymentIntentId,
      sellerPayout: escrow?.sellerPayout || split.sellerPayout,
      driverPayout: escrow?.driverPayout || split.driverB2cAmount,
      platformFee: escrow?.platformFee || split.platformFee,
      sinkingFundAmount: escrow?.sinkingFundAmount || split.sinkingFundAmount,
      refundAmount: escrow?.refundAmount || split.refundAmount,
      split,
      logistics: logistics ? {
        id: logistics._id,
        status: logistics.status,
        shippingCost: logistics.shippingCost,
        escrowReleaseDue: logistics.escrowReleaseDue,
        settlement: logistics.settlement,
      } : null,
      payouts: escrow?.payouts || [],
      externalProvider: escrow?.externalProvider,
      externalStatus: escrow?.externalStatus,
      externalTransactionId: escrow?.externalTransactionId,
    };
  }

  async getUserEscrowTransactions(userId, { page = 1, limit = 20 }) {
    const query = { $or: [{ buyer: userId }, { seller: userId }] };
    const skip = (page - 1) * limit;
    const [escrows, total] = await Promise.all([
      Escrow.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Escrow.countDocuments(query),
    ]);
    return { data: escrows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getEscrowSummary(userId) {
    const [held, released] = await Promise.all([
      Escrow.aggregate([
        { $match: { $or: [{ buyer: userId }, { seller: userId }], status: { $in: ['HELD', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Escrow.aggregate([
        { $match: { $or: [{ buyer: userId }, { seller: userId }], status: { $in: ['RELEASED', 'PARTIAL_REFUND'] } } },
        { $group: { _id: null, total: { $sum: '$sellerPayout' } } },
      ]),
    ]);

    return {
      totalInEscrow: held[0]?.total || 0,
      totalReleased: released[0]?.total || 0,
    };
  }

  async getEscrowByOrder(orderId) {
    const escrow = await Escrow.findOne({ order: orderId });
    if (!escrow) throw httpError('Escrow not found for order', 404);
    return escrow;
  }

  async getOrCreateDisputeEscrow(order, { throwIfMissing = true } = {}) {
    const existingEscrow = await Escrow.findOne({ order: order._id });
    if (existingEscrow) return existingEscrow;

    const status = inferEscrowStatusFromOrder(order.status);
    if (!status || status === 'AWAITING_PAYMENT') {
      if (!throwIfMissing) return null;
      throw httpError('Order is not ready for escrow release because payment has not been held yet', 409, {
        currentStatus: order.status,
        expectedStatus: 'FUNDS_HELD, IN_TRANSIT, or DELIVERED',
      });
    }

    return Escrow.findOneAndUpdate(
      { order: order._id },
      {
        $setOnInsert: {
          order: order._id,
          buyer: order.buyer,
          seller: order.seller,
          amount: order.totalAmount,
          currency: 'KES',
          status,
          paidAt: order.paidAt,
          heldAt: ['HELD', 'IN_TRANSIT', 'DELIVERED'].includes(status) ? (order.paidAt || new Date()) : undefined,
          deliveredAt: status === 'DELIVERED' ? (order.deliveredAt || new Date()) : undefined,
          autoReleaseAt: status === 'DELIVERED' ? (order.escrowReleaseDate || new Date(Date.now() + AUTO_RELEASE_MS)) : undefined,
        },
      },
      { returnDocument: 'after', upsert: true }
    );
  }
}

module.exports = new EscrowService();

