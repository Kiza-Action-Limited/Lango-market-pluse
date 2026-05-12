const GroupBuy = require('../../models/GroupBuy.model');
const Product = require('../../models/Product.model');
const Order = require('../../models/Order.model');
const orderService = require('../order/order.service');
const { smsQueue } = require('../../config/redis');

class GroupBuyService {
  async createGroupBuy(data) {
    const { product, targetQuantity, unitPrice, deadline, initiator } = data;

    const productDoc = await Product.findById(product);
    if (!productDoc) throw new Error('Product not found');
    if (targetQuantity > productDoc.quantityAvailable) {
      throw new Error('Target quantity exceeds available stock');
    }

    const groupBuy = await GroupBuy.create({
      product,
      initiator,
      targetQuantity,
      unitPrice,
      deadline: new Date(deadline),
      participants: [{ user: initiator, quantity: 1, joinedAt: new Date() }],
      currentQuantity: 1,
    });

    return groupBuy;
  }

  async joinGroupBuy(groupBuyId, userId, quantity) {
    const groupBuy = await GroupBuy.findById(groupBuyId);
    if (!groupBuy) throw new Error('Group buy not found');
    if (groupBuy.status !== 'active') throw new Error('Group buy is no longer active');
    if (new Date() > groupBuy.deadline) throw new Error('Deadline passed');

    const existing = groupBuy.participants.find(p => p.user.toString() === userId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      groupBuy.participants.push({ user: userId, quantity, joinedAt: new Date() });
    }
    groupBuy.currentQuantity += quantity;

    if (groupBuy.currentQuantity >= groupBuy.targetQuantity) {
      await this.fulfillGroupBuy(groupBuyId);
    } else {
      await groupBuy.save();
    }

    return groupBuy;
  }

  async fulfillGroupBuy(groupBuyId) {
    const groupBuy = await GroupBuy.findById(groupBuyId).populate('participants.user product');
    if (!groupBuy) throw new Error('Group buy not found');
    if (groupBuy.status !== 'active') return;

    groupBuy.status = 'fulfilled';
    await groupBuy.save();

    // Create individual orders for each participant
    for (const participant of groupBuy.participants) {
      const order = await orderService.createOrder({
        buyer: participant.user._id,
        product: groupBuy.product._id,
        quantity: participant.quantity,
        unitPrice: groupBuy.unitPrice,
        deliveryAddress: null, // will be filled later
      });
      // Notify participant
      await smsQueue.add('send', {
        to: participant.user.phone,
        message: `Group buy fulfilled! Your order #${order._id} has been created. Complete payment to proceed.`,
      });
    }

    return { fulfilled: true, ordersCreated: groupBuy.participants.length };
  }

  async getGroupBuys({ page = 1, limit = 10, status = 'active' }) {
    const query = { status };
    const skip = (page - 1) * limit;
    const groupBuys = await GroupBuy.find(query)
      .populate('product', 'name images')
      .populate('initiator', 'fullName')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await GroupBuy.countDocuments(query);
    return { data: groupBuys, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getGroupBuyById(id) {
    const groupBuy = await GroupBuy.findById(id)
      .populate('product')
      .populate('participants.user', 'fullName phone');
    if (!groupBuy) throw new Error('Group buy not found');
    return groupBuy;
  }
}

module.exports = new GroupBuyService();