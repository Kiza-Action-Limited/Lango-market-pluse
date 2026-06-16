import api from '../config/axios';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response ?? null;

export const paymentService = {
  initiateMpesaPayment: async ({ orderId, phoneNumber }) => {
    const response = await api.post('/v1/payments/mpesa/stkpush', { orderId, phoneNumber });
    return unwrap(response);
  },

  checkMpesaStatus: async (checkoutRequestId) => {
    const response = await api.get(`/v1/payments/mpesa/status/${encodeURIComponent(checkoutRequestId)}`);
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
    const response = await api.post('/v1/wallet/transfer', payload);
    return unwrap(response);
  },

  withdrawWalletFunds: async (payload) => {
    const response = await api.post('/v1/wallet/withdraw', payload);
    return unwrap(response);
  },

  addWalletFunds: async (payload) => {
    const response = await api.post('/v1/wallet/add-funds', payload);
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
    const response = await api.post(`/v1/transactions/${transactionId}/reverse`, { reason });
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

  createExternalEscrowTransaction: async (orderId, payload) => {
    const response = await api.post(`/v1/escrow/external/${encodeURIComponent(orderId)}/create`, payload);
    return unwrap(response);
  },

  syncExternalEscrowTransaction: async (orderId) => {
    const response = await api.post(`/v1/escrow/external/${encodeURIComponent(orderId)}/sync`);
    return unwrap(response);
  },

  releaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/release/${encodeURIComponent(orderId)}`, payload);
    return unwrap(response);
  },

  holdEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/hold/${encodeURIComponent(orderId)}`, payload);
    return unwrap(response);
  },

  partialReleaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/partial-release/${encodeURIComponent(orderId)}`, payload);
    return unwrap(response);
  },

  cancelEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/cancel/${encodeURIComponent(orderId)}`, payload);
    return unwrap(response);
  },
};

export default paymentService;
