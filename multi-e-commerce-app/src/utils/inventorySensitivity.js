export const PRODUCT_CATEGORY_OPTIONS = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'home-garden', label: 'Home and Garden' },
  { value: 'beauty-health', label: 'Beauty and Health' },
  { value: 'sports-outdoor', label: 'Sports and Outdoor' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'grains-cereals', label: 'Grains and Cereals' },
  { value: 'food-staples', label: 'Food Staples' },
  { value: 'sugar-baking', label: 'Sugar and Baking' },
  { value: 'cooking-oil', label: 'Cooking Oil' },
  { value: 'dairy-eggs', label: 'Dairy and Eggs' },
  { value: 'meat-fish', label: 'Meat and Fish' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'household', label: 'Household' },
  { value: 'farm-inputs', label: 'Farm Inputs' },
  { value: 'other', label: 'Other' },
];

const categoryLabels = PRODUCT_CATEGORY_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

const stockSensitivityRules = [
  { threshold: 50, terms: ['maize', 'corn', 'unga', 'posho', 'grains-cereals', 'food-staples'] },
  { threshold: 45, terms: ['sugar', 'jaggery', 'sugar-baking'] },
  { threshold: 40, terms: ['rice', 'beans', 'wheat', 'flour', 'millet', 'sorghum'] },
  { threshold: 25, terms: ['cooking oil', 'oil', 'cooking-oil'] },
  { threshold: 20, terms: ['milk', 'dairy', 'eggs', 'dairy-eggs'] },
  { threshold: 18, terms: ['vegetables', 'tomato', 'onion', 'potato', 'cabbage', 'fresh'] },
  { threshold: 15, terms: ['beverage', 'water', 'juice', 'soda', 'beverages'] },
  { threshold: 12, terms: ['household', 'soap', 'detergent', 'tissue'] },
  { threshold: 10, terms: ['farm-inputs', 'seed', 'fertilizer', 'feed'] },
];

export const formatProductCategory = (category) => {
  const key = typeof category === 'string' ? category : category?.slug || category?.name;
  return categoryLabels[key] || String(key || 'Other').replace(/-/g, ' ');
};

export const getAutoLowStockThreshold = (product = {}) => {
  const haystack = `${product.name || ''} ${product.category || ''}`.toLowerCase();
  const matchedRule = stockSensitivityRules.find((rule) => (
    rule.terms.some((term) => haystack.includes(term))
  ));

  return matchedRule?.threshold || 10;
};

export const getEffectiveLowStockThreshold = (product = {}) => {
  const configured = Number(product.minThreshold);
  if (Number.isFinite(configured) && configured === 0) return 0;
  const autoThreshold = getAutoLowStockThreshold(product);
  if (!Number.isFinite(configured) || configured < 0) return autoThreshold;
  return Math.max(configured, autoThreshold);
};
