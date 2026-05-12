const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Initializes Socket.io with HTTP server and sets up authentication middleware.
 * @param {http.Server} server - HTTP server instance (from app.js)
 * @returns {Server} Socket.io server instance
 */
const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*', // Restrict in production
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'], // Fallback to polling
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user; // Attach user to socket instance
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id} (${socket.id})`);

    // Join user-specific room for direct notifications
    socket.join(`user:${socket.user.id}`);

    // Example: Join order tracking room
    socket.on('join-order-room', (orderId) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${socket.user.id} joined order room ${orderId}`);
    });

    socket.on('leave-order-room', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.user.id}, reason: ${reason}`);
    });
  });

  return io;
};

/**
 * Emit a notification to a specific user.
 * @param {Server} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {string} event - Event name (e.g., 'order_update')
 * @param {any} data - Payload
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit to all users in an order room.
 * @param {Server} io
 * @param {string} orderId
 * @param {string} event
 * @param {any} data
 */
const emitToOrderRoom = (io, orderId, event, data) => {
  io.to(`order:${orderId}`).emit(event, data);
};

module.exports = { initSocket, emitToUser, emitToOrderRoom };