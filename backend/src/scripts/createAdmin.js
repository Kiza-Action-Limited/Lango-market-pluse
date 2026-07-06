const path = require('path');
const dns = require('dns').promises;
const mongoose = require('mongoose');
const User = require('../models/User.model');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/Marketpluse';

const redactMongoUri = (uri) => String(uri || 'missing')
  .replace(/\/\/([^:/@]+):([^@]+)@/, '//***:***@');

const withTimeout = (promise, timeoutMs, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  }),
]);

const preflightMongoUri = async (uri) => {
  if (!uri.startsWith('mongodb+srv://')) return;
  const host = new URL(uri.replace('mongodb+srv://', 'https://')).hostname;
  const dnsTimeoutMs = Number(process.env.MONGODB_DNS_TIMEOUT_MS || 3000);
  await withTimeout(
    dns.resolveSrv(`_mongodb._tcp.${host}`),
    dnsTimeoutMs,
    `DNS lookup timed out for ${host} after ${dnsTimeoutMs}ms`
  );
};

const connect = async () => {
  const uris = [
    process.env.MONGODB_URI,
    process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI,
  ].filter(Boolean);

  let lastError = null;
  for (const uri of uris) {
    try {
      await preflightMongoUri(uri);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 8000),
      });
      console.log(`Connected to MongoDB: ${redactMongoUri(uri)}`);
      console.log(`DB: ${mongoose.connection.name}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`MongoDB unavailable: ${redactMongoUri(uri)} - ${error.message}`);
    }
  }

  throw lastError || new Error('No MongoDB URI configured');
};

const createAdmin = async () => {
  const email = String(process.env.SEED_ADMIN_EMAIL || 'admin@langomarket.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const phone = process.env.SEED_ADMIN_PHONE || '254700000000';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  await User.create({
    fullName: 'System Admin',
    email,
    phone,
    password,
    role: 'admin',
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
    verificationStatus: 'verified',
  });

  console.log('Admin created successfully');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
};

(async () => {
  try {
    await connect();
    await createAdmin();
  } catch (error) {
    console.error('Create admin failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
