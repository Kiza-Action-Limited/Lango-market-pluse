module.exports = {
  // Order statuses
  ORDER_STATUS: {
    PENDING_PAYMENT: 'pending_payment',
    PAYMENT_ESCROWED: 'payment_escrowed',
    PROCESSING: 'processing',
    DISPATCHED: 'dispatched',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    DISPUTED: 'disputed',
  },

  // User roles
  USER_ROLES: {
    FARMER: 'farmer',
    BUYER: 'buyer',
    LOGISTICS: 'logistics',
    ADMIN: 'admin',
  },

  // Subscription plans
  SUBSCRIPTION_TIERS: {
    FREE: 'free',
    V3: 'v3',
    V4: 'v4',
  },

  // Transaction types
  TRANSACTION_TYPES: {
    DEPOSIT: 'deposit',
    WITHDRAWAL: 'withdrawal',
    PAYMENT: 'payment',
    REFUND: 'refund',
    ESCROW_HOLD: 'escrow_hold',
    ESCROW_RELEASE: 'escrow_release',
    FEE: 'fee',
  },

  // Escrow release period (milliseconds)
  ESCROW_RELEASE_DELAY_MS: 72 * 60 * 60 * 1000, // 72 hours

  // Pagination defaults
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,

  // Redis key prefixes
  REDIS_PREFIX: {
    SESSION: 'sess:',
    RESET_CODE: 'reset:',
    CACHE: 'cache:',
  },
};