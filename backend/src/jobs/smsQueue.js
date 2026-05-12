const { Queue, Worker } = require('bull');
const { redisClient } = require('../config/redis');
const smsService = require('../services/navigation/sms.service');
const logger = require('../utils/logger');

// Define queue
const smsQueue = new Queue('sms', { connection: redisClient });

// Worker processes each SMS job
const worker = new Worker('sms', async (job) => {
  const { to, message, userId } = job.data;
  logger.info(`Sending SMS to ${to}`);
  try {
    if (userId) {
      await smsService.sendToUser(userId, message);
    } else {
      await smsService.sendToNumber(to, message);
    }
    logger.info(`SMS sent to ${to}`);
    return { success: true };
  } catch (err) {
    logger.error(`SMS failed for ${to}: ${err.message}`);
    throw err; // Bull will retry
  }
}, {
  connection: redisClient,
  concurrency: 5, // send up to 5 SMS simultaneously
  settings: {
    backoffStrategies: {
      exponential: (attemptsMade) => Math.pow(2, attemptsMade) * 1000,
    },
  },
});

worker.on('failed', (job, err) => {
  logger.error(`SMS job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
});

module.exports = { smsQueue, worker };