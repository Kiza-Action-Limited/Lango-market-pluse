const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn('❌ MongoDB URI is missing (.env not loaded or incorrect key)');
    return false;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });

    console.log('✅ MongoDB connected');
    console.log('📀 DB:', mongoose.connection.name);

    return true;
  } catch (error) {
    console.warn('⚠️ MongoDB unavailable:', error.message);
    return false;
  }
};

module.exports = connectDB;