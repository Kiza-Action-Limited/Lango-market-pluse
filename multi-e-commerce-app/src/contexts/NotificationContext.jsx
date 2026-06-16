// src/context/NotificationContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchNotifications();
      const notificationSocket = setupSocket();
      
      // Poll for new notifications every 30 seconds as fallback
      const interval = setInterval(fetchNotifications, 30000);
      
      return () => {
        clearInterval(interval);
        notificationSocket?.close();
      };
    }
  }, [isAuthenticated, token]);

  const setupSocket = () => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
    const notificationSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    
    notificationSocket.on('connect', () => {
      console.log('Notification socket connected');
    });
    
    notificationSocket.on('new_notification', handleIncomingNotification);
    notificationSocket.on('notification', handleIncomingNotification);
    notificationSocket.on('order_update', handleIncomingNotification);
    
    notificationSocket.on('connect_error', (error) => {
      console.error('Notification socket error:', error.message);
    });
    
    return notificationSocket;
  };

  const handleIncomingNotification = (payload) => {
    const notification = payload?.notification || payload;
    if (!notification) return;

    addNewNotification(notification);
    toast.info(notification.message || notification.title || 'New notification');
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications();
      const nextNotifications = Array.isArray(response.notifications) ? response.notifications : [];
      setNotifications(nextNotifications);
      setUnreadCount(
        typeof response.unreadCount === 'number'
          ? response.unreadCount
          : nextNotifications.filter(n => !n.read).length
      );
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNewNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      const wasUnread = notifications.some(n => n.id === notificationId && !n.read);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notifications.find(n => n.id === notificationId && !n.read)) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await notificationService.deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications deleted');
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      toast.error('Failed to delete notifications');
    }
  };

  const getUnreadCount = useCallback(() => {
    return unreadCount;
  }, [unreadCount]);

  const getNotificationsByType = (type) => {
    return notifications.filter(n => n.type === type);
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getUnreadCount,
    getNotificationsByType
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
