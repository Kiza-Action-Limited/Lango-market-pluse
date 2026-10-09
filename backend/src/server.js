require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const logger = require('./utils/logger');
const { getVertoConfig, validateVertoConfig, getSafeVertoConfig } = require('./config/verto');

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const isPlaceholderSecret = (value = '') => (
  !String(value || '').trim() ||
  /^(change_me|changeme|secret|password|admin123|test|demo|your_|replace_with)/i.test(String(value).trim()) ||
  /\.{3,}/.test(String(value))
);

const validateProductionConfig = () => {
  if (!isProduction) return;

  const errors = [];
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) errors.push('MONGODB_URI is required.');
  if (isPlaceholderSecret(process.env.JWT_SECRET)) errors.push('JWT_SECRET must be a strong production secret.');
  if (process.env.AUTH_FALLBACK_MODE === 'true') errors.push('AUTH_FALLBACK_MODE cannot be enabled in production.');
  if (process.env.VERTO_ENABLED === 'true') {
    if (isPlaceholderSecret(process.env.VERTO_CLIENT_ID)) errors.push('VERTO_CLIENT_ID is required.');
    if (isPlaceholderSecret(process.env.VERTO_API_KEY)) errors.push('VERTO_API_KEY must be the full production secret.');
    if (!process.env.VERTO_PUBLIC_CERTIFICATE && process.env.VERTO_ENCRYPT_API_KEY !== 'false') {
      errors.push('VERTO_PUBLIC_CERTIFICATE is required for certificate-based Verto auth.');
    }
  }

  if (errors.length) {
    throw new Error(`Production configuration invalid: ${errors.join(' ')}`);
  }
};

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
    validateProductionConfig();
    const vertoValidation = validateVertoConfig(getVertoConfig());
    if (!vertoValidation.ok && getVertoConfig().enabled) {
      throw new Error(`Verto configuration invalid: ${vertoValidation.errors.join(' ')}`);
    }

    const mongoConnected = await connectDB();
    if (!mongoConnected) {
      if (isProduction) {
        throw new Error('MongoDB connection is required in production.');
      }
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
      const vertoStatus = getSafeVertoConfig();
      console.log(`Verto payments: ${vertoStatus.enabled ? 'enabled' : 'disabled'} (${vertoStatus.environment})`);
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
