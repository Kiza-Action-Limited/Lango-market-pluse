const { Queue, Worker } = require('bull');
const { redisClient } = require('../config/redis');
const thresholdService = require('../services/inventory/threshold.service');
const logger = require('../utils/logger');

// Queue definition
const scarcityQueue = new Queue('scarcity', { connection: redisClient });

// Add recurring job every 60 minutes
scarcityQueue.add('check-scarcity', {}, {
  repeat: { cron: '0 * * * *' }, // every hour at minute 0
  removeOnComplete: true,
});

// Worker processes the job
const worker = new Worker('scarcity', async (job) => {
  logger.info('Running scarcity detection job');
  try {
    await thresholdService.monitorAndAlert();
    logger.info('Scarcity detection completed');
  } catch (err) {
    logger.error('Scarcity detection failed:', err);
    throw err;
  }
}, { connection: redisClient });

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed: ${err.message}`);
});

module.exports = { scarcityQueue, worker };