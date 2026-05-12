require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const mongoConnected = await connectDB();
    if (!mongoConnected) {
      process.env.AUTH_FALLBACK_MODE = 'true';
      console.warn('Auth fallback mode enabled (in-memory users).');
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
