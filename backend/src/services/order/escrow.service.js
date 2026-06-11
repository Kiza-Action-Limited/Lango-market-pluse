const Order = require('../../models/Order.model');
const Escrow = require('../../models/Escrow.model');
const Dispute = require('../../models/Dispute.model');
const Logistics = require('../../models/Logistics.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const SinkingFund = require('../../models/SinkingFund.model');
const { escrowQueue } = require('../../config/redis');
const { b2cPayment, normalizeMpesaPhone } = require('../../config/mpesa');
const auditService = require('../audit.service');

const AUTO_RELEASE_MS = 72 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 0.075);
const SINKING_FUND_RATE = Number(process.env.SINKING_FUND_RATE || 0.10);

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isAdminRole = (role) => ['admin', 'ADMIN'].includes(role);

class EscrowService {
  async createPendingEscrow(order, { checkoutRequestId, merchantRequestId }) {
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
        },
        $set: {
          mpesaCheckoutId: checkoutRequestId,
          merchantRequestId,
        },
      },
      { new: true, upsert: true }
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

    const oldEscrowStatus = escrow.status;
    escrow.status = 'HELD';
    escrow.amount = Number(amount || escrow.amount);
    escrow.mpesaReceiptNumber = transactionId;
    escrow.paidAt = transactionDate ? new Date(String(transactionDate)) : new Date();
    escrow.heldAt = new Date();
    await escrow.save();

    const oldOrderStatus = order.status;
    order.status = 'FUNDS_HELD';
    order.paidAt = escrow.paidAt;
    order.paymentIntentId = checkoutRequestId;
    await order.save();

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
    const { releasedBy, forceRelease = false, releaseMethod = 'manual_confirm', refundAmount = 0 } = options;
    const escrow = await this.getEscrowByOrder(orderId);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (escrow.status === 'RELEASED') {
      return { released: true, alreadyReleased: true, escrow };
    }

    const openDispute = await Dispute.findOne({ order: orderId, status: { $in: ['open', 'under_review'] } });
    if (openDispute && !forceRelease) {
      await this.scheduleAutoRelease(orderId, new Date(Date.now() + 24 * 60 * 60 * 1000));
      return { released: false, blockedByDispute: true, dispute: openDispute._id };
    }

    if (!forceRelease && escrow.status !== 'DELIVERED') {
      throw new Error(`Escrow release requires DELIVERED status. Current status: ${escrow.status}`);
    }

    await this.cancelAutoRelease(orderId);

    const logistics = await Logistics.findOne({ order: orderId }).populate('driver fleetOwner');
    const seller = await User.findById(order.seller);
    const buyer = await User.findById(order.buyer);
    const driver = logistics?.driver?._id ? logistics.driver : null;
    const fleetOwner = logistics?.fleetOwner?._id ? logistics.fleetOwner : null;
    const payoutRouting = await this.getDriverPayoutRecipient(driver, fleetOwner);
    const split = this.calculateSplit(escrow.amount, refundAmount, payoutRouting.driverType);

    const payouts = [];

    if (split.refundAmount > 0 && buyer?.phone) {
      payouts.push(await this.sendPayout({
        escrow,
        recipient: buyer,
        role: 'buyer_refund',
        amount: split.refundAmount,
        remarks: `Refund for order ${orderId}`,
      }));
    }

    if (split.sellerPayout > 0 && seller?.phone) {
      payouts.push(await this.sendPayout({
        escrow,
        recipient: seller,
        role: 'seller',
        amount: split.sellerPayout,
        remarks: `Seller payout for order ${orderId}`,
      }));
    }

    if (split.driverB2cAmount > 0 && payoutRouting.recipient?.phone) {
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
        { upsert: true, new: true }
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

    await Transaction.insertMany([
      {
        user: order.seller,
        type: 'escrow_release',
        amount: split.sellerPayout,
        balanceAfter: 0,
        reference: orderId,
        orderId: order._id,
        description: `Seller escrow payout for order ${orderId}`,
        status: split.sellerPayout > 0 ? 'pending' : 'completed',
      },
      {
        user: order.seller,
        type: 'commission',
        amount: split.platformFee,
        balanceAfter: 0,
        reference: orderId,
        orderId: order._id,
        description: `Platform commission retained for order ${orderId}`,
      },
    ]);

    await auditService.record({
      entityType: 'Escrow',
      entityId: escrow._id,
      action: 'ESCROW_RELEASED',
      actor: releasedBy,
      newValue: { split, payoutRouting, releaseMethod, payouts },
    });

    return { released: true, escrow, split, payouts };
  }

  calculateSplit(totalAmount, refundAmount = 0, driverType = 'solo') {
    const total = money(totalAmount);
    const refund = money(Math.min(Number(refundAmount || 0), total));
    const releaseBase = money(total - refund);
    const platformFee = money(releaseBase * PLATFORM_FEE_RATE);
    const net = money(releaseBase - platformFee);
    const sellerPayout = money(net * 0.85);
    const driverShare = money(net * 0.15);
    const sinkingFundAmount = driverType === 'solo' ? money(driverShare * SINKING_FUND_RATE) : 0;
    const driverB2cAmount = money(driverShare - sinkingFundAmount);

    return {
      total,
      refundAmount: refund,
      releaseBase,
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
    const originatorConversationId = `LMP-${role}-${escrow.order}-${Date.now()}`;
    const payout = {
      recipient: recipient._id,
      role,
      amount: money(amount),
      status: 'queued',
      requestedAt: new Date(),
    };

    const response = await b2cPayment({
      phoneNumber: normalizeMpesaPhone(recipient.phone),
      amount,
      remarks,
      occasion: 'Escrow release',
      originatorConversationId,
    });

    payout.status = response.ResponseCode === '0' ? 'sent' : 'failed';
    payout.mpesaConversationId = response.ConversationID;
    payout.failureReason = response.ResponseDescription;

    escrow.payouts.push(payout);
    await escrow.save();

    return { ...payout, mpesaResponse: response };
  }

  async holdEscrow(orderId, reason, adminId) {
    const escrow = await this.getEscrowByOrder(orderId);
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
    return this.releasePayment(orderId, {
      releasedBy: adminId,
      forceRelease: true,
      releaseMethod: 'admin_refund',
      refundAmount: (await this.getEscrowByOrder(orderId)).amount,
      reason,
    });
  }

  async partialRelease(orderId, amount, userId, reason) {
    const escrow = await this.getEscrowByOrder(orderId);
    const refundAmount = Math.max(escrow.amount - Number(amount), 0);
    return this.releasePayment(orderId, {
      releasedBy: userId,
      forceRelease: true,
      releaseMethod: 'partial_refund',
      refundAmount,
      reason,
    });
  }

  async raiseDispute(orderId, raisedBy, { reason, description, evidenceUrls = [] }) {
    const escrow = await this.getEscrowByOrder(orderId);
    const order = await Order.findById(orderId);
    if (!['DELIVERED', 'HELD', 'FUNDS_HELD', 'payment_escrowed'].includes(escrow.status) && order?.status !== 'DELIVERED') {
      throw new Error('Disputes can only be raised while funds are held or within the delivery window');
    }

    if (escrow.deliveredAt && Date.now() - escrow.deliveredAt.getTime() > AUTO_RELEASE_MS) {
      throw new Error('The 72-hour dispute window has expired');
    }

    const dispute = await Dispute.findOneAndUpdate(
      { order: orderId },
      {
        $setOnInsert: { order: orderId, escrow: escrow._id, raisedBy },
        $set: { reason, description, evidenceUrls, evidence: evidenceUrls, status: 'open' },
      },
      { upsert: true, new: true }
    );

    await this.holdEscrow(orderId, reason, raisedBy);
    return dispute;
  }

  async resolveDispute(disputeId, adminId, { refundAmount = 0, resolution, faultParty }) {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) throw new Error('Dispute not found');

    dispute.status = refundAmount > 0 ? 'partial_refund' : 'resolved_seller';
    dispute.resolution = resolution || (refundAmount > 0 ? 'partial_refund' : 'release_to_seller');
    dispute.refundAmount = refundAmount;
    dispute.resolutionAmount = refundAmount;
    dispute.faultParty = faultParty;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    await dispute.save();

    if (faultParty) {
      const user = await User.findByIdAndUpdate(
        faultParty,
        { $inc: { trustScore: -0.5 } },
        { new: true }
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
      refundAmount,
    });

    await auditService.record({
      entityType: 'Dispute',
      entityId: dispute._id,
      action: 'DISPUTE_RESOLVED',
      actor: adminId,
      newValue: { refundAmount, resolution: dispute.resolution, faultParty },
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

  async getEscrowStatus(orderId, userId, userRole) {
    const order = await Order.findById(orderId).select('status escrowReleaseDate totalAmount buyer seller');
    if (!order) throw new Error('Order not found');
    if (!isAdminRole(userRole) && order.buyer.toString() !== userId && order.seller.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    const escrow = await Escrow.findOne({ order: orderId });
    return {
      orderId,
      escrowAmount: escrow?.amount || order.totalAmount,
      orderStatus: order.status,
      escrowStatus: escrow?.status || 'AWAITING_PAYMENT',
      expectedReleaseDate: escrow?.autoReleaseAt || order.escrowReleaseDate,
      payouts: escrow?.payouts || [],
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
    if (!escrow) throw new Error('Escrow not found for order');
    return escrow;
  }
}

module.exports = new EscrowService();
