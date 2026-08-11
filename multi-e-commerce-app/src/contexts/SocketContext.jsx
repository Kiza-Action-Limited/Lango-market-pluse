// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getSocketUrl } from '../config/apiBase';
import { requireMongoId } from '../utils/backendRules';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { token, isAuthenticated } = useAuth();

  const joinOrderRoom = (orderId) => new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Live tracking connection is not ready.'));
      return;
    }

    let normalizedOrderId;
    try {
      normalizedOrderId = requireMongoId(orderId, 'Order ID');
    } catch (error) {
      reject(error);
      return;
    }

    socket.emit('join-order-room', normalizedOrderId, (response = {}) => {
      if (response.success) resolve(response);
      else reject(new Error(response.message || 'Not authorized to track this order.'));
    });
  });

  const leaveOrderRoom = (orderId) => {
    if (!socket?.connected) return;
    socket.emit('leave-order-room', requireMongoId(orderId, 'Order ID'));
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = io(getSocketUrl(), {
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      
      newSocket.on('connect', () => {
        console.log('Socket connected');
      });
      
      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
      
      setSocket(newSocket);
      
      return () => {
        newSocket.close();
      };
    }
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, joinOrderRoom, leaveOrderRoom }}>
      {children}
    </SocketContext.Provider>
  );
};
