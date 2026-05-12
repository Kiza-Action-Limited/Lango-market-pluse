const { Queue, Worker } = require('bull');
const { redisClient } = require('../config/redis');
const Transaction = require('../models/Transaction.model');
const logger = require('../utils/logger');

const ledgerQueue = new Queue('ledger', { connection: redisClient });

// Run daily at 2 AM to generate reports
ledgerQueue.add('daily-report', {}, {
  repeat: { cron: '0 2 * * *' },
  removeOnComplete: true,
});

const worker = new Worker('ledger', async (job) => {
  logger.info('Generating ledger daily report');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const report = await Transaction.aggregate([
    { $match: { createdAt: { $gte: yesterday, $lt: today }, status: 'completed' } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  logger.info('Daily ledger report', report);
  // Optionally store report in a separate collection or send to admin
}, { connection: redisClient });

module.exports = { ledgerQueue, worker };