import api from '../config/axios';

const MAX_PRODUCT_LIMIT = 100;

export const manufacturerService = {
  getMarketplaceData: async () => {
    const productsRes = await api.get('/v1/products', { params: { limit: MAX_PRODUCT_LIMIT } });
    const products = productsRes.data?.products || productsRes.data?.data || [];

    let categories = [];
    try {
      const categoriesRes = await api.get('/v1/categories');
      categories = categoriesRes.data?.categories || categoriesRes.data?.data || [];
    } catch (error) {
      // Derive categories from live products when categories endpoint is unavailable.
      const categorySet = Array.from(new Set(products.map((item) => item?.category).filter(Boolean)));
      categories = categorySet.map((name) => ({ id: name, name }));
    }

    let businesses = [];
    try {
      const businessesRes = await api.get('/v1/businesses', { params: { limit: 200 } });
      businesses =
        businessesRes.data?.businesses ||
        businessesRes.data?.suppliers ||
        businessesRes.data?.data ||
        [];
      if (!Array.isArray(businesses)) businesses = [];
    } catch (error) {
      businesses = [];
    }

    return {
      categories,
      products,
      businesses,
    };
  },

  predictSuppliers: async (payload) => {
    const response = await api.post('/v1/businesses/predict-suppliers', payload);
    return response.data;
  },

  getHubHeaderConfig: async () => {
    const response = await api.get('/v1/businesses/header');

    return response.data?.data || response.data;
  },

  searchBusinesses: async ({ query = '', category = '', businessType = '', limit = MAX_PRODUCT_LIMIT } = {}) => {
    const safeLimit = Math.min(Number(limit) || MAX_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT);
    const params = { query, q: query, search: query, category, businessType, limit: safeLimit };

    const response = await api.get('/v1/businesses/search', { params });

    return response.data;
  },

  searchByImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/v1/businesses/search-by-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

    return response.data;
  },
};
