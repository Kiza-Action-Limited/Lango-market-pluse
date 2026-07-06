const mongoose = require('mongoose');
const dns = require('dns').promises;

const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/Marketpluse';

const redactMongoUri = (uri) => {
  if (!uri) return 'missing';
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//***:***@');
};

const withTimeout = (promise, timeoutMs, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  }),
]);

const connectWithUri = async (uri, label) => {
  if (uri.startsWith('mongodb+srv://')) {
    const host = new URL(uri.replace('mongodb+srv://', 'https://')).hostname;
    const dnsTimeoutMs = Number(process.env.MONGODB_DNS_TIMEOUT_MS || 3000);
    await withTimeout(
      dns.resolveSrv(`_mongodb._tcp.${host}`),
      dnsTimeoutMs,
      `DNS lookup timed out for ${host} after ${dnsTimeoutMs}ms`
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 8000),
  });

  console.log(`MongoDB connected (${label})`);
  console.log('DB:', mongoose.connection.name);
  return true;
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localMongoUri = process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI;

  if (!mongoUri) {
    console.warn('MongoDB URI is missing. Trying local MongoDB fallback.');
    try {
      return await connectWithUri(localMongoUri, 'local fallback');
    } catch (error) {
      console.warn('Local MongoDB unavailable:', error.message);
      return false;
    }
  }

  try {
    return await connectWithUri(mongoUri, 'configured URI');
  } catch (error) {
    console.warn(`MongoDB unavailable for configured URI ${redactMongoUri(mongoUri)}:`, error.message);

    if (process.env.MONGODB_DISABLE_LOCAL_FALLBACK === 'true' || mongoUri === localMongoUri) {
      return false;
    }

    try {
      console.warn(`Trying local MongoDB fallback ${redactMongoUri(localMongoUri)}.`);
      return await connectWithUri(localMongoUri, 'local fallback');
    } catch (fallbackError) {
      console.warn('Local MongoDB fallback unavailable:', fallbackError.message);
      return false;
    }
  }
};

module.exports = connectDB;
