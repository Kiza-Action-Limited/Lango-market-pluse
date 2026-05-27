const { Queue, Worker } = require('bull');
const { redisClient } = require('../config/redis');
const Order = require('../models/Order.model');
const Logistics = require('../models/Logistics.model');
const escrowService = require('../services/order/escrow.service');
const logger = require('../utils/logger');

const escrowQueue = new Queue('escrow', { connection: redisClient });

// Schedule auto-release for orders that have escrowReleaseDate set
const scheduleAutoRelease = async (orderId, releaseDate) => {
  const delay = releaseDate.getTime() - Date.now();
  if (delay > 0) {
    await escrowQueue.add('release', { orderId }, { delay });
    logger.info(`Scheduled escrow release for order ${orderId} in ${delay}ms`);
  }
};

// Worker to process releases
const worker = new Worker('escrow', async (job) => {
  const { orderId } = job.data;
  logger.info(`Auto-releasing escrow for order ${orderId}`);
  await escrowService.releasePayment(orderId, { forceRelease: false });
}, { connection: redisClient });

// Also add a recurring job to catch any missed releases (runs every 15 min)
escrowQueue.add('catchup', {}, {
  repeat: { cron: '*/15 * * * *' },
  removeOnComplete: true,
});

const catchupWorker = new Worker('escrow', async (job) => {
  if (job.name === 'catchup') {
    const now = new Date();
    const orders = await Order.find({
      status: 'completed',
      escrowReleaseDate: { $lte: now },
      $or: [{ 'timeline.status': { $ne: 'escrow_released' } }],
    });
    for (const order of orders) {
      logger.info(`Catchup releasing escrow for order ${order._id}`);
      await escrowService.releasePayment(order._id, { forceRelease: false });
    }

    const pendingLogistics = await Logistics.findPendingAutoReleases();
    for (const shipment of pendingLogistics) {
      logger.info(`Catchup releasing logistics escrow for shipment ${shipment._id}`);
      await shipment.releaseEscrow('auto');
    }
  }
}, { connection: redisClient });

module.exports = { escrowQueue, scheduleAutoRelease, worker, catchupWorker };
