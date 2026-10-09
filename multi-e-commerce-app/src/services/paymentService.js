import api from '../config/axios';
import {
  requireMongoId,
  requireOrderReference,
  requirePositiveAmount,
  withIdempotency,
} from '../utils/backendRules';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response ?? null;

export const paymentService = {
  getVertoConfig: async () => {
    const response = await api.get('/v1/payments/verto/config');
    return unwrap(response);
  },

  initiateVertoPayment: async ({ orderId }) => {
    const body = { orderId: requireOrderReference(orderId) };
    const response = await api.post('/v1/payments/verto/create', body, withIdempotency('verto-create'));
    return unwrap(response);
  },

  checkVertoStatus: async (providerReference) => {
    const response = await api.get(`/v1/payments/verto/status/${encodeURIComponent(providerReference)}`);
    return unwrap(response);
  },

  getVertoTransactions: async (params = {}) => {
    const response = await api.get('/v1/payments/verto/transactions', { params });
    return unwrap(response);
  },

  getVertoPayouts: async (params = {}) => {
    const response = await api.get('/v1/payments/verto/payouts', { params });
    return unwrap(response);
  },

  createVertoPayout: async (payload = {}) => {
    const body = {
      ...payload,
      orderId: requireMongoId(payload.orderId, 'Order ID'),
      reason: String(payload.reason || '').trim(),
    };
    const response = await api.post('/v1/payments/verto/payouts', body, withIdempotency('verto-payout'));
    return unwrap(response);
  },

  initiateSubscriptionVertoPayment: async ({ planId, paymentReference, agentNationalId }) => {
    if (!['solo', 'smart', 'growth'].includes(planId)) {
      throw new Error('Choose a valid seller subscription plan.');
    }

    const body = {
      planId,
      paymentMethod: 'verto',
      paymentCompleted: true,
      paymentReference: String(paymentReference || '').trim(),
    };
    if (!body.paymentReference) {
      throw new Error('Enter the verified Verto payment reference.');
    }
    if (agentNationalId) body.agentNationalId = String(agentNationalId).replace(/\D/g, '');
    const response = await api.post('/v1/subscriptions/subscribe', body, withIdempotency('subscription-verto'));
    return unwrap(response);
  },

  checkSubscriptionVertoStatus: async (paymentReference) => {
    const response = await api.get(`/v1/payments/verto/status/${encodeURIComponent(paymentReference)}`);
    return unwrap(response);
  },

  getWalletBalance: async () => {
    const response = await api.get('/v1/wallet/balance');
    return unwrap(response);
  },

  getWalletDetails: async () => {
    const response = await api.get('/v1/wallet');
    return unwrap(response);
  },

  getWalletTransactions: async (params = {}) => {
    const response = await api.get('/v1/wallet/transactions', { params });
    return unwrap(response);
  },

  getWalletStatement: async (params = {}) => {
    const response = await api.get('/v1/wallet/statement', { params });
    return unwrap(response);
  },

  transferWalletFunds: async (payload) => {
    const body = {
      ...payload,
      toUserId: requireMongoId(payload?.toUserId, 'Recipient user ID'),
      amount: requirePositiveAmount(payload?.amount, 10, 'Transfer amount'),
    };
    const response = await api.post('/v1/wallet/transfer', body, withIdempotency('wallet-transfer'));
    return unwrap(response);
  },

  withdrawWalletFunds: async (payload) => {
    const body = {
      ...payload,
      amount: requirePositiveAmount(payload?.amount, 50, 'Withdrawal amount'),
      provider: 'verto',
    };
    const response = await api.post('/v1/wallet/withdraw', body, withIdempotency('wallet-withdraw'));
    return unwrap(response);
  },

  addWalletFunds: async (payload) => {
    const body = {
      ...payload,
      amount: requirePositiveAmount(payload?.amount, 10, 'Top-up amount'),
      paymentMethod: 'verto',
    };
    const response = await api.post('/v1/wallet/add-funds', body, withIdempotency('wallet-add-funds'));
    return unwrap(response);
  },

  getTransactionHistory: async (params = {}) => {
    const response = await api.get('/v1/transactions', { params });
    return unwrap(response);
  },

  getTransactionSummary: async (days = 30) => {
    const response = await api.get('/v1/transactions/summary', { params: { days } });
    return unwrap(response);
  },

  reverseTransaction: async (transactionId, reason) => {
    const response = await api.post(`/v1/transactions/${requireMongoId(transactionId, 'Transaction ID')}/reverse`, { reason }, withIdempotency('transaction-reverse'));
    return unwrap(response);
  },

  getAdminTransactions: async (params = {}) => {
    const response = await api.get('/v1/transactions/admin/all', { params });
    return unwrap(response);
  },

  getAdminTransactionStats: async (params = {}) => {
    const response = await api.get('/v1/transactions/admin/stats', { params });
    return unwrap(response);
  },

  getEscrowStatus: async (orderId) => {
    const response = await api.get(`/v1/escrow/status/${encodeURIComponent(orderId)}`);
    return unwrap(response);
  },

  getEscrowSummary: async () => {
    const response = await api.get('/v1/escrow/summary');
    return unwrap(response);
  },

  getEscrowTransactions: async () => {
    const response = await api.get('/v1/escrow/transactions');
    return unwrap(response);
  },

  releaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/release/${encodeURIComponent(requireOrderReference(orderId))}`, payload, withIdempotency('escrow-release'));
    return unwrap(response);
  },

  holdEscrow: async (orderId, payload = {}) => {
    const body = { ...payload, reason: String(payload.reason || '').trim() || 'Manual escrow hold' };
    const response = await api.post(`/v1/escrow/hold/${encodeURIComponent(requireOrderReference(orderId))}`, body, withIdempotency('escrow-hold'));
    return unwrap(response);
  },

  partialReleaseEscrow: async (orderId, payload = {}) => {
    const body = {
      ...payload,
      amount: requirePositiveAmount(payload?.amount, 1, 'Partial release amount'),
    };
    const response = await api.post(`/v1/escrow/partial-release/${encodeURIComponent(requireOrderReference(orderId))}`, body, withIdempotency('escrow-partial-release'));
    return unwrap(response);
  },

  cancelEscrow: async (orderId, payload = {}) => {
    const body = { ...payload, reason: String(payload.reason || '').trim() || 'Escrow cancelled from frontend' };
    const response = await api.post(`/v1/escrow/cancel/${encodeURIComponent(requireOrderReference(orderId))}`, body, withIdempotency('escrow-cancel'));
    return unwrap(response);
  },
};

export default paymentService;
