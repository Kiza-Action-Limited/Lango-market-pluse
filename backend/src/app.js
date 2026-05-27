require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/v1/auth.routes');
const productRoutes = require('./routes/v1/products.routes');
const orderRoutes = require('./routes/v1/orders.routes');
const notificationRoutes = require('./routes/v1/notifications.routes');
const cartRoutes = require('./routes/v1/cart.routes');
const wishlistRoutes = require('./routes/v1/wishlist.routes');
const adminRoutes = require('./routes/v1/admin.routes');
const logisticsRoutes = require('./routes/v1/logistics.routes');
const analyticsRoutes = require('./routes/v1/analytics.routes');
const subscriptionRoutes = require('./routes/v1/subscriptions.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const envOrigins = (process.env.FRONTEND_URL || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const allowedOrigins = new Set([
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:5000',
      ...envOrigins,
    ]);

    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for local uploads if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database connection
mongoose.set('strictQuery', false);
connectDB()
  .then((connected) => {
    if (connected) {
      console.log('MongoDB connected successfully');
      console.log('Database:', mongoose.connection.name);
    } else {
      console.warn('MongoDB is unavailable. Server is starting in fallback mode. Database-backed routes may fail.');
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.warn(' Continuing without MongoDB. Start MongoDB or set MONGO_URI / MONGODB_URI to a reachable instance.');
  });

// Route mounts
console.log(' Mounting routes...');
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/logistics', logisticsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Test route to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working!',
    endpoints: {
      auth: '/api/v1/auth',
      products: '/api/v1/products',
      orders: '/api/v1/orders',
      notifications: '/api/v1/notifications',
      cart: '/api/v1/cart',
      admin: '/api/v1/admin',
      logistics: '/api/v1/logistics',
      analytics: '/api/v1/analytics'
    }
  });
});

// 404 handler - keep at the end
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server if not in test mode
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: http://localhost:${PORT}/api/v1`);
    console.log(`  Health check: http://localhost:${PORT}/health\n`);
  });
}

module.exports = app;