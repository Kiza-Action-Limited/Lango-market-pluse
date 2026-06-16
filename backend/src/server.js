require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');

const PORT = process.env.PORT || 5000;

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
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
