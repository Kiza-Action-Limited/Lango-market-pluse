const mongoose = require('mongoose');

/**
 * Database Indexes Setup
 * Improves query performance by creating necessary indexes
 */

async function setupIndexes() {
  try {
    // User indexes
    const User = require('../models/User.model');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ phone: 1 }, { unique: true, sparse: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ 'location.coordinates': '2dsphere' });
    console.log('✓ User indexes created');

    // Product indexes
    const Product = require('../models/Product.model');
    await Product.collection.createIndex({ seller: 1, createdAt: -1 });
    await Product.collection.createIndex({ category: 1 });
    await Product.collection.createIndex({ name: 'text', description: 'text' });
    await Product.collection.createIndex({ 'location.coordinates': '2dsphere' });
    console.log('✓ Product indexes created');

    // Order indexes
    const Order = require('../models/Order.model');
    await Order.collection.createIndex({ buyer: 1, createdAt: -1 });
    await Order.collection.createIndex({ seller: 1, createdAt: -1 });
    await Order.collection.createIndex({ status: 1, createdAt: -1 });
    await Order.collection.createIndex({ orderNumber: 1 }, { unique: true });
    console.log('✓ Order indexes created');

    // Payment indexes
    const Payment = require('../models/Payment.model');
    await Payment.collection.createIndex({ user: 1, createdAt: -1 });
    await Payment.collection.createIndex({ transactionId: 1 }, { sparse: true });
    await Payment.collection.createIndex({ status: 1, createdAt: -1 });
    console.log('✓ Payment indexes created');

    // Transaction indexes
    const Transaction = require('../models/Transaction.model');
    await Transaction.collection.createIndex({ user: 1, createdAt: -1 });
    await Transaction.collection.createIndex({ type: 1, createdAt: -1 });
    await Transaction.collection.createIndex({ status: 1 });
    console.log('✓ Transaction indexes created');

    // Wallet indexes
    const Wallet = require('../models/Wallet.model');
    await Wallet.collection.createIndex({ user: 1 }, { unique: true });
    console.log('✓ Wallet indexes created');

    // Escrow indexes
    const Escrow = require('../models/Escrow.model');
    await Escrow.collection.createIndex({ order: 1 }, { unique: true });
    await Escrow.collection.createIndex({ status: 1 });
    console.log('✓ Escrow indexes created');

    // Dispute indexes
    const Dispute = require('../models/Dispute.model');
    await Dispute.collection.createIndex({ order: 1 }, { unique: true, sparse: true });
    await Dispute.collection.createIndex({ status: 1, createdAt: -1 });
    await Dispute.collection.createIndex({ raisedBy: 1, createdAt: -1 });
    console.log('✓ Dispute indexes created');

    // QRToken indexes
    const QRToken = require('../models/QRToken.model');
    await QRToken.collection.createIndex({ token: 1 }, { unique: true });
    await QRToken.collection.createIndex({ order: 1, type: 1 });
    await QRToken.collection.createIndex({ isUsed: 1, expiresAt: 1 });
    console.log('✓ QRToken indexes created');

    // SinkingFund indexes
    const SinkingFund = require('../models/SinkingFund.model');
    await SinkingFund.collection.createIndex({ driver: 1 }, { unique: true });
    console.log('✓ SinkingFund indexes created');

    // AuditLog indexes
    const AuditLog = require('../models/AuditLog.model');
    await AuditLog.collection.createIndex({ entityType: 1, entityId: 1 });
    await AuditLog.collection.createIndex({ action: 1, createdAt: -1 });
    await AuditLog.collection.createIndex({ actor: 1, createdAt: -1 });
    console.log('✓ AuditLog indexes created');

    // Cart indexes
    const Cart = require('../models/Cart.model');
    await Cart.collection.createIndex({ user: 1 }, { unique: true });
    console.log('✓ Cart indexes created');

    // Wishlist indexes
    const Wishlist = require('../models/Cart.model');
    await Wishlist.collection.createIndex({ user: 1 });
    await Wishlist.collection.createIndex({ product: 1 });
    console.log('✓ Wishlist indexes created');

    // Notification indexes
    const Notification = require('../models/notification.model');
    await Notification.collection.createIndex({ user: 1, createdAt: -1 });
    await Notification.collection.createIndex({ read: 1 });
    console.log('✓ Notification indexes created');

    // Review indexes
    const Review = require('../models/Review.model');
    await Review.collection.createIndex({ product: 1, createdAt: -1 });
    await Review.collection.createIndex({ seller: 1 });
    await Review.collection.createIndex({ buyer: 1 });
    console.log('✓ Review indexes created');

    console.log('\n✓ All database indexes created successfully!\n');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

module.exports = setupIndexes;
