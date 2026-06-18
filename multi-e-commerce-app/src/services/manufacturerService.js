import api from '../config/axios';

const MAX_PRODUCT_LIMIT = 100;

const firstSuccess = async (requests = []) => {
  for (const request of requests) {
    try {
      const result = await request();
      return result;
    } catch (error) {
      // Try next candidate endpoint.
    }
  }
  throw new Error('All endpoint candidates failed');
};

export const manufacturerService = {
  getMarketplaceData: async () => {
    const productsRes = await firstSuccess([
      () => api.get('/v1/products', { params: { limit: MAX_PRODUCT_LIMIT } }),
      () => api.get('/products', { params: { limit: MAX_PRODUCT_LIMIT } }),
    ]);
    const products = productsRes.data?.products || productsRes.data?.data || [];

    let categories = [];
    try {
      const categoriesRes = await api.get('/categories');
      categories = categoriesRes.data?.categories || categoriesRes.data?.data || [];
    } catch (error) {
      // Derive categories from live products when categories endpoint is unavailable.
      const categorySet = Array.from(new Set(products.map((item) => item?.category).filter(Boolean)));
      categories = categorySet.map((name) => ({ id: name, name }));
    }

    let businesses = [];
    try {
      const businessesRes = await firstSuccess([
        () => api.get('/v1/businesses', { params: { limit: 200 } }),
        () => api.get('/businesses', { params: { limit: 200 } }),
        () => api.get('/v1/suppliers', { params: { limit: 200 } }),
        () => api.get('/suppliers', { params: { limit: 200 } }),
      ]);
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
    const response = await api.post('/ai/predict/suppliers', payload);
    return response.data;
  },

  getHubHeaderConfig: async () => {
    const response = await firstSuccess([
      () => api.get('/business-hub/header'),
      () => api.get('/platform/header-config'),
      () => api.get('/marketplace/header'),
    ]);

    return response.data;
  },

  searchBusinesses: async ({ query = '', category = '', businessType = '', limit = MAX_PRODUCT_LIMIT } = {}) => {
    const safeLimit = Math.min(Number(limit) || MAX_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT);
    const params = { query, q: query, search: query, category, businessType, limit: safeLimit };

    const response = await firstSuccess([
      () => api.get('/business-hub/search', { params }),
      () => api.get('/businesses/search', { params }),
      () => api.get('/suppliers/search', { params }),
      () => api.get('/products', { params: { search: query, category, limit: safeLimit } }),
    ]);

    return response.data;
  },

  searchByImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await firstSuccess([
      () => api.post('/business-hub/search/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      () => api.post('/ai/search/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      () => api.post('/products/search-by-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    ]);

    return response.data;
  },
};
