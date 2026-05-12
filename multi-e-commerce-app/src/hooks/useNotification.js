// src/hooks/useNotifications.js
import { useNotifications as useNotificationsContext } from '../context/NotificationContext';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

export const useNotifications = () => {
  const notifications = useNotificationsContext();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNotifications = useCallback(() => {
    let filtered = notifications.notifications;
    
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.read);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(n => 
        n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [notifications.notifications, filter, searchTerm]);

  const showNotification = (message, type = 'info') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast(message, { icon: '⚠️' });
        break;
      default:
        toast(message);
    }
  };

  const notifyOrderStatus = (orderId, status) => {
    const messages = {
      pending: 'Your order has been placed',
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled'
    };
    
    showNotification(messages[status] || `Order #${orderId} status: ${status}`, 'info');
  };

  const notifyPaymentReceived = (amount) => {
    showNotification(`Payment of ${formatCurrency(amount)} received successfully`, 'success');
  };

  const notifyProductShipped = (productName) => {
    showNotification(`${productName} has been shipped`, 'info');
  };

  const notifyProductDelivered = (productName) => {
    showNotification(`${productName} has been delivered`, 'success');
  };

  const notifyLowStock = (productName, stock) => {
    showNotification(`${productName} is running low on stock (${stock} left)`, 'warning');
  };

  return {
    ...notifications,
    filteredNotifications: filteredNotifications(),
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    showNotification,
    notifyOrderStatus,
    notifyPaymentReceived,
    notifyProductShipped,
    notifyProductDelivered,
    notifyLowStock
  };
};
