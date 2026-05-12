const MOQ_BUSINESS_TYPES = new Set(['wholesaler', 'manufacturer']);

export const MQQ_TIERS = [
  { label: 'MQQ1', range: '10 - 2,999 pieces' },
  { label: 'MQQ2', range: '3,000+ pieces' },
];

export function normalizeBusinessType(value) {
  return String(value || '').trim().toLowerCase();
}

export function isMqqRestrictedBusinessType(businessType) {
  return MOQ_BUSINESS_TYPES.has(normalizeBusinessType(businessType));
}

export function getMinimumOrderQuantity(productOrBusinessType) {
  if (typeof productOrBusinessType === 'string') {
    return isMqqRestrictedBusinessType(productOrBusinessType) ? 10 : 1;
  }

  const businessType =
    productOrBusinessType?.seller?.businessType ||
    productOrBusinessType?.businessType ||
    '';

  return isMqqRestrictedBusinessType(businessType) ? 10 : 1;
}

export function clampToMinimumOrder(quantity, minimumOrderQty = 1) {
  const parsed = Number.parseInt(quantity, 10);
  if (!Number.isFinite(parsed)) return minimumOrderQty;
  return Math.max(minimumOrderQty, parsed);
}

