const SELLER_BUSINESS_TYPES = new Set(['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business']);

const BUSINESS_TYPE_ALIASES = {
  'other business': 'small_business',
  other_business: 'small_business',
  smallbusiness: 'small_business',
  sme: 'small_business',
  wholesale: 'wholesaler',
  retail: 'retailer',
  farming: 'farmer',
  crops: 'farmer',
  livestock: 'farmer',
  dairy: 'farmer',
  poultry: 'farmer',
  logistics: 'logistics',
};

const normalizeCategoryValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const normalizeBusinessType = (businessType) => {
  const normalized = normalizeCategoryValue(businessType);
  return BUSINESS_TYPE_ALIASES[normalized] || normalized || null;
};

const getEffectiveUserCategory = (user = {}) => {
  const role = normalizeCategoryValue(user.role);
  const businessType = normalizeBusinessType(user.businessType);

  if (role === 'admin') return 'admin';
  if (role === 'logistics' || businessType === 'logistics') return 'logistics';
  if (role === 'farmer' || businessType === 'farmer') return 'farmer';
  if (SELLER_BUSINESS_TYPES.has(businessType)) return businessType;
  if (role === 'seller') return businessType || 'retailer';
  if (role === 'buyer' || role === 'consumer') return 'consumer';
  return businessType || role || 'unknown';
};

const isFarmerUser = (user = {}) => getEffectiveUserCategory(user) === 'farmer';

const isSellerUser = (user = {}) => {
  const category = getEffectiveUserCategory(user);
  return category === 'admin' || SELLER_BUSINESS_TYPES.has(category);
};

module.exports = {
  SELLER_BUSINESS_TYPES,
  getEffectiveUserCategory,
  isFarmerUser,
  isSellerUser,
  normalizeBusinessType,
};
