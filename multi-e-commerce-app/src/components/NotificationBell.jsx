// src/components/NotificationBell.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FaBell } from 'react-icons/fa';
import { useNotifications } from '../context/NotificationContext';
import { formatDate } from '../utils/helpers';

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-label="Open notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-primary"
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:w-96">
          <div className="p-3 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationId = notification.id || notification._id;
                const source = notification.data?.source || notification.type || 'system';
                const message = notification.message || notification.body || '';

                return (
                <div
                  key={notificationId}
                  className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    markAsRead(notificationId);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600">
                      {source.replace('_', ' ')}
                    </span>
                  </div>
                  {message && <p className="text-xs text-gray-600 mt-1">{message}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
