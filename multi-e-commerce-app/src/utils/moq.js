const MOQ_BUSINESS_TYPES = new Set(['wholesaler', 'manufacturer']);
const MOQ_EXEMPT_TYPES = new Set(['farmer', 'retailer']);

export const MQQ_TIERS = [
  { label: 'MQQ1', range: '10 - 2,999 pieces' },
  { label: 'MQQ2', range: '3,000+ pieces' },
];

export function normalizeBusinessType(value) {
  return String(value || '').trim().toLowerCase();
}

export function isMqqRestrictedBusinessType(businessType) {
  const normalized = normalizeBusinessType(businessType);
  if (MOQ_EXEMPT_TYPES.has(normalized)) return false;
  return MOQ_BUSINESS_TYPES.has(normalized);
}

export function getMinimumOrderQuantity(productOrBusinessType) {
  if (typeof productOrBusinessType === 'string') {
    return isMqqRestrictedBusinessType(productOrBusinessType) ? 10 : 1;
  }

  const businessType =
    productOrBusinessType?.seller?.businessType ||
    productOrBusinessType?.seller?.role ||
    productOrBusinessType?.businessType ||
    productOrBusinessType?.role ||
    '';

  if (businessType) {
    return isMqqRestrictedBusinessType(businessType) ? 10 : 1;
  }

  const explicitMinimum = Number(
    productOrBusinessType?.minimumOrderQuantity ??
    productOrBusinessType?.minOrderQuantity ??
    productOrBusinessType?.wholesale?.minimumOrderQuantity ??
    1
  );

  return Number.isFinite(explicitMinimum) && explicitMinimum > 1 ? explicitMinimum : 1;
}

export function clampToMinimumOrder(quantity, minimumOrderQty = 1) {
  const parsed = Number.parseInt(quantity, 10);
  if (!Number.isFinite(parsed)) return minimumOrderQty;
  return Math.max(minimumOrderQty, parsed);
}

