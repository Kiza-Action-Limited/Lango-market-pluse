const axios = require('axios');
const { stkPush, queryStatus } = require('../../config/mpesa');
const Order = require('../../models/Order.model');
const Transaction = require('../../models/Transaction.model');
const walletService = require('./wallet.service');
const ledgerService = require('./ledger.service');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class MpesaService {
  async initiatePayment(orderId, phoneNumber, userId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.buyer.toString() !== userId) throw new Error('Unauthorized');
    if (order.status !== 'pending_payment') throw new Error('Order not ready for payment');

    const amount = order.totalAmount;
    const accountReference = `ORDER${orderId}`;
    const transactionDesc = `Payment for order ${orderId}`;

    const response = await stkPush(phoneNumber, amount, accountReference, transactionDesc);
    // Store checkoutRequestId in order
    order.paymentIntentId = response.CheckoutRequestID;
    await order.save();

    return {
      checkoutRequestId: response.CheckoutRequestID,
      merchantRequestId: response.MerchantRequestID,
      responseCode: response.ResponseCode,
      responseDesc: response.ResponseDescription,
    };
  }

  async handleSuccessCallback({ checkoutRequestId, amount, transactionId, transactionDate }) {
    const order = await Order.findOne({ paymentIntentId: checkoutRequestId });
    if (!order) {
      logger.error(`Order not found for checkout ${checkoutRequestId}`);
      return;
    }

    // Move funds to escrow
    const buyer = order.buyer;
    await ledgerService.holdInEscrow(order._id, buyer, amount);

    order.status = 'payment_escrowed';
    await order.save();

    // Create transaction record
    await Transaction.create({
      user: buyer,
      type: 'payment',
      amount,
      balanceAfter: await walletService.getBalance(buyer),
      reference: transactionId,
      description: `Payment for order ${order._id}`,
      metadata: { checkoutRequestId, transactionDate },
    });

    // Notify seller
    await smsQueue.add('send', {
      to: order.seller.phone,
      message: `Payment received for order ${order._id}. Amount: KES ${amount}. Prepare for dispatch.`,
    });
  }

  async handleFailureCallback({ checkoutRequestId, errorMessage }) {
    const order = await Order.findOne({ paymentIntentId: checkoutRequestId });
    if (order) {
      order.status = 'cancelled';
      await order.save();
    }
    logger.error(`M-Pesa payment failed: ${errorMessage}`);
  }

  async queryPaymentStatus(checkoutRequestId) {
    const result = await queryStatus(checkoutRequestId);
    return result;
  }
}

module.exports = new MpesaService();