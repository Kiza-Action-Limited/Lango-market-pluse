const { Queue, Worker } = require('bull');
const { redisClient } = require('../config/redis');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const logger = require('../utils/logger');

const velocityQueue = new Queue('velocity', { connection: redisClient });

// Run daily at midnight
velocityQueue.add('calculate-velocity', {}, {
  repeat: { cron: '0 0 * * *' },
  removeOnComplete: true,
});

const worker = new Worker('velocity', async (job) => {
  logger.info('Calculating sales velocity for all products');
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const orders = await Order.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: last7Days } } },
    { $group: { _id: '$product', totalQuantity: { $sum: '$quantity' } } },
  ]);

  for (const item of orders) {
    const velocity = item.totalQuantity / 7; // per day
    await Product.findByIdAndUpdate(item._id, { salesVelocity: velocity });
  }
  logger.info('Sales velocity calculation complete');
}, { connection: redisClient });

module.exports = { velocityQueue, worker };