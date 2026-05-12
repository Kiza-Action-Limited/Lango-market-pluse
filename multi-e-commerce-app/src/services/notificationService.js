// src/services/notificationService.js
import api from '../config/axios';

export const notificationService = {
  getNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  deleteAllNotifications: async () => {
    const response = await api.delete('/notifications');
    return response.data;
  },

  subscribeToOrderUpdates: async (orderId) => {
    const response = await api.post(`/notifications/subscribe/${orderId}`);
    return response.data;
  },

  unsubscribeFromOrderUpdates: async (orderId) => {
    const response = await api.delete(`/notifications/unsubscribe/${orderId}`);
    return response.data;
  },

  getNotificationPreferences: async () => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  updateNotificationPreferences: async (preferences) => {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  }
};