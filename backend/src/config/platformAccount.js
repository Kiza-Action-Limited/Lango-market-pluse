const PLATFORM_ACCOUNT = Object.freeze({
  id: process.env.PLATFORM_ACCOUNT_ID || 'lango-market-pulse',
  name: process.env.PLATFORM_ACCOUNT_NAME || 'Lango Market Pulse',
  type: 'platform',
  mpesaShortCode: process.env.PLATFORM_SUBSCRIPTION_MPESA_SHORT_CODE || process.env.MPESA_SHORT_CODE || process.env.MPESA_SHORTCODE || null,
  subscriptionAccountReference: (process.env.PLATFORM_SUBSCRIPTION_MPESA_ACCOUNT_REFERENCE || 'LANGO_SUBS').substring(0, 12),
  subscriptionTransactionDesc: (process.env.PLATFORM_SUBSCRIPTION_MPESA_TRANSACTION_DESC || 'Lango Sub').substring(0, 13),
});

const getPlatformAccountPublicPayload = () => ({
  id: PLATFORM_ACCOUNT.id,
  name: PLATFORM_ACCOUNT.name,
  type: PLATFORM_ACCOUNT.type,
  mpesaShortCode: PLATFORM_ACCOUNT.mpesaShortCode,
  accountReference: PLATFORM_ACCOUNT.subscriptionAccountReference,
});

const buildPlatformRevenueMetadata = (metadata = {}) => ({
  recipientType: PLATFORM_ACCOUNT.type,
  recipientAccountId: PLATFORM_ACCOUNT.id,
  recipientAccountName: PLATFORM_ACCOUNT.name,
  revenueAccount: PLATFORM_ACCOUNT.name,
  platformRevenue: true,
  ...metadata,
});

module.exports = {
  PLATFORM_ACCOUNT,
  buildPlatformRevenueMetadata,
  getPlatformAccountPublicPayload,
};
