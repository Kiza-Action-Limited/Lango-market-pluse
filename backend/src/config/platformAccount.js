const PLATFORM_ACCOUNT = Object.freeze({
  id: process.env.PLATFORM_ACCOUNT_ID || 'lango-market-pulse',
  name: process.env.PLATFORM_ACCOUNT_NAME || 'Lango Market Pulse',
  type: 'platform',
});

const getPlatformAccountPublicPayload = () => ({
  id: PLATFORM_ACCOUNT.id,
  name: PLATFORM_ACCOUNT.name,
  type: PLATFORM_ACCOUNT.type,
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
