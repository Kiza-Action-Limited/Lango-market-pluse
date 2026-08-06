import api from '../config/axios';

const readData = (response) => response.data?.data || response.data || {};

export const marketingContentService = {
  getHomepageAds: async () => {
    const response = await api.get('/v1/marketing/homepage-ads');
    return readData(response);
  },

  getAdminHomepageAds: async () => {
    const response = await api.get('/v1/admin/marketing/homepage-ads');
    return readData(response);
  },

  saveAdminHomepageAds: async (payload) => {
    const response = await api.put('/v1/admin/marketing/homepage-ads', payload);
    return readData(response);
  },

  uploadHomepageAdImage: async (file, placement = 'homepage') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('placement', placement);

    const response = await api.post('/v1/admin/marketing/homepage-ads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return readData(response);
  },
};
