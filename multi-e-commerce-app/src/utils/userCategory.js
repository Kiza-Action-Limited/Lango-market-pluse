const SELLER_CATEGORIES = new Set(['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business']);

const CATEGORY_ALIASES = {
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
};

export const normalizeUserCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_ALIASES[normalized] || normalized;
};

export const getEffectiveUserCategory = (user = {}) => {
  user = user || {};
  const role = normalizeUserCategory(user.role);
  const businessType = normalizeUserCategory(user.businessType);

  if (role === 'admin') return 'admin';
  if (role === 'buyer' || role === 'consumer') return 'consumer';
  if (role === 'logistics' || businessType === 'logistics') return 'logistics';
  if (role === 'farmer' || businessType === 'farmer') return 'farmer';
  if (SELLER_CATEGORIES.has(role)) return role;
  if (SELLER_CATEGORIES.has(businessType)) return businessType;
  if (role === 'seller') return businessType || 'retailer';
  return businessType || role || 'unknown';
};

export const isFarmerUser = (user = {}) => getEffectiveUserCategory(user) === 'farmer';

export const isSellerUser = (user = {}) => {
  const category = getEffectiveUserCategory(user);
  return category === 'admin' || SELLER_CATEGORIES.has(category);
};

export const isBuyerUser = (user = {}) => {
  const category = getEffectiveUserCategory(user);
  return category === 'buyer' || category === 'consumer';
};

export const getUserCategoryLabel = (user = {}) => {
  const labels = {
    admin: 'Admin',
    logistics: 'Logistics',
    farmer: 'Farmer',
    brand: 'Brand',
    wholesaler: 'Wholesaler',
    manufacturer: 'Manufacturer',
    retailer: 'Retailer',
    small_business: 'Small Business',
    consumer: 'Consumer',
    buyer: 'Buyer',
  };
  const category = getEffectiveUserCategory(user);
  return labels[category] || category.replace(/_/g, ' ');
};
