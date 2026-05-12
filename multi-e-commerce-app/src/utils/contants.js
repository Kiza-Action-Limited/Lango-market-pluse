// src/utils/constants.js
export const USER_ROLES = {
  BUYER: 'user',
  SELLER: {
    BRAND: 'brand',
    WHOLESALER: 'wholesaler',
    MANUFACTURER: 'manufacturer',
    RETAILER: 'retailer',
    FARMER: 'farmer',
    SMALL_BUSINESS: 'small_business'
  },
  ADMIN: 'admin',
};

export const BUSINESS_TYPES = [
  'Brand',
  'Wholesaler',
  'Manufacturer',
  'Retailer',
  'Farmer',
  'Small Business',
];

export const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const PAYMENT_METHODS = {
  MPESA : 'mpesa',
};

export const SHIPPING_COST = 5;
export const FREE_SHIPPING_THRESHOLD = 50;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
];