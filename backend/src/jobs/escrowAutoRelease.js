const { Worker } = require('bullmq');
const { redisClient, escrowQueue } = require('../config/redis');
const Escrow = require('../models/Escrow.model');
const escrowService = require('../services/order/escrow.service');
const logger = require('../utils/logger');

const scheduleAutoRelease = async (orderId, releaseDate) => escrowService.scheduleAutoRelease(orderId, releaseDate);
const cancelAutoRelease = async (orderId) => escrowService.cancelAutoRelease(orderId);

let worker = null;

if (redisClient) {
  worker = new Worker(
    'escrow',
    async (job) => {
      if (job.name === 'auto-release') {
        logger.info(`Auto-releasing escrow for order ${job.data.orderId}`);
        return escrowService.releasePayment(job.data.orderId, {
          forceRelease: false,
          releaseMethod: 'auto_72h',
        });
      }

      if (job.name === 'catchup') {
        const pending = await Escrow.find({
          status: 'DELIVERED',
          autoReleaseAt: { $lte: new Date() },
        }).select('order');

        for (const escrow of pending) {
          await escrowService.releasePayment(escrow.order, {
            forceRelease: false,
            releaseMethod: 'auto_72h_catchup',
          });
        }

        return { processed: pending.length };
      }

      return null;
    },
    { connection: redisClient }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Escrow job ${job?.id} failed: ${error.message}`);
  });

  escrowQueue.add(
    'catchup',
    {},
    {
      jobId: 'escrow-catchup',
      repeat: { pattern: '*/15 * * * *' },
      removeOnComplete: true,
    }
  ).catch((error) => logger.error(`Failed to schedule escrow catchup: ${error.message}`));
}

module.exports = { escrowQueue, scheduleAutoRelease, cancelAutoRelease, worker };
