require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason?.message || reason,
    stack: reason?.stack,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    message: error.message,
    stack: error.stack,
  });
});

const startServer = async () => {
  try {
    const mongoConnected = await connectDB();
    if (!mongoConnected) {
      process.env.AUTH_FALLBACK_MODE = 'true';
      console.warn('Auth fallback mode enabled (in-memory users).');
    }
    if (process.env.REDIS_ENABLED === 'true') {
      require('./jobs/escrowAutoRelease');
    }
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();
