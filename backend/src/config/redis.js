const Redis = require('ioredis');
const { Queue } = require('bull');

const redisEnabled = process.env.REDIS_ENABLED === 'true';
const redisUrl = process.env.REDIS_URL;

const createNoopQueue = () => ({
  add: async () => ({ skipped: true }),
});

const createNoopExports = () => ({
  redisClient: null,
  connectRedis: () => {},
  smsQueue: createNoopQueue(),
  scarcityQueue: createNoopQueue(),
  escrowQueue: createNoopQueue(),
});

if (!redisEnabled || !redisUrl) {
  console.warn('Redis disabled. Set REDIS_ENABLED=true and REDIS_URL to enable queues.');
  module.exports = createNoopExports();
} else {
  const redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });

  redisClient.on('connect', () => console.log('Redis connected'));
  redisClient.on('error', (err) => console.warn(`Redis unavailable: ${err.message}`));
  redisClient.on('close', () => console.warn('Redis connection closed'));

  const connectRedis = async () => {
    try {
      await redisClient.connect();
    } catch (error) {
      console.warn(`Redis connection failed: ${error.message}`);
    }
  };

  const smsQueue = new Queue('sms', { connection: redisClient });
  const scarcityQueue = new Queue('scarcity', { connection: redisClient });
  const escrowQueue = new Queue('escrow', { connection: redisClient });

  module.exports = {
    redisClient,
    connectRedis,
    smsQueue,
    scarcityQueue,
    escrowQueue,
  };
}
