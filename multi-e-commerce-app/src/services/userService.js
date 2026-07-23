// src/services/userService.js
import api from '../config/axios';

const normalizeAddressLabel = (addressData = {}) => {
  if (typeof addressData === 'string') return addressData.trim();
  return (
    addressData.address ||
    addressData.label ||
    addressData.street ||
    [addressData.addressLine1, addressData.addressLine2, addressData.city, addressData.county]
      .filter(Boolean)
      .join(', ')
  ).trim();
};

const userToAddressResponse = (user) => {
  const label = user?.address || user?.location?.address || '';
  return {
    success: true,
    data: label
      ? [{
        id: 'primary',
        _id: 'primary',
        label,
        address: label,
        isDefault: true,
      }]
      : [],
  };
};

export const userService = {
  getProfile: async () => {
    const response = await api.get('/v1/auth/me');
    return response.data?.data?.user || response.data?.user || null;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/v1/auth/me', profileData);
    return response.data?.data?.user || response.data?.user || null;
  },

  updateAvatar: async (avatarFile) => {
    const formData = new FormData();
    formData.append('profileImage', avatarFile);
    const response = await api.post('/v1/auth/me/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getAddresses: async () => {
    const user = await userService.getProfile();
    return userToAddressResponse(user);
  },

  addAddress: async (addressData) => {
    const address = normalizeAddressLabel(addressData);
    const user = await userService.updateProfile({ address });
    return { success: true, data: userToAddressResponse(user).data[0] || null };
  },

  updateAddress: async (addressId, addressData) => {
    const address = normalizeAddressLabel(addressData);
    const user = await userService.updateProfile({ address });
    return { success: true, data: userToAddressResponse(user).data[0] || null };
  },

  deleteAddress: async (addressId) => {
    const user = await userService.updateProfile({ address: '' });
    return { success: true, data: userToAddressResponse(user).data };
  },

  getWishlist: async () => {
    const response = await api.get('/wishlist');
    return response.data;
  },

  addToWishlist: async (productId) => {
    const response = await api.post(`/wishlist/${productId}`);
    return response.data;
  },

  removeFromWishlist: async (productId) => {
    const response = await api.delete(`/wishlist/${productId}`);
    return response.data;
  },

  checkWishlist: async (productId) => {
    const response = await api.get(`/wishlist/check/${productId}`);
    return response.data;
  },

  getOrderHistory: async () => {
    const response = await api.get('/v1/orders');
    return response.data;
  },

  getOrderDetails: async (orderId) => {
    const response = await api.get(`/v1/orders/${orderId}`);
    return response.data;
  },

  cancelOrder: async (orderId) => {
    const response = await api.put(`/v1/orders/${orderId}/cancel`);
    return response.data;
  }
};
