import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPut } from '../config/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotification, setToastNotification] = useState(null);
  
  const prevIdsRef = useRef(new Set());
  const toastTimeoutRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiGet('/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
        const unread = data.filter(n => !n.read);
        setUnreadCount(unread.length);
        
        const currentIds = new Set(data.map(n => n._id || n.id));
        const prevIds = prevIdsRef.current;
        
        // Find new unread notifications
        const newUnread = unread.filter(n => !prevIds.has(n._id || n.id));
        
        if (newUnread.length > 0 && prevIds.size > 0) {
          // Show toast for the most recent one (or first one)
          showToast(newUnread[0]);
        }
        
        prevIdsRef.current = currentIds;
      }
    } catch (e) {
      console.error('Error fetching notifications', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      prevIdsRef.current = new Set();
      return;
    }
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  const showToast = (notification) => {
    setToastNotification(notification);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  const dismissToast = () => {
    setToastNotification(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };

  const markRead = async (id) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => {
      const nId = n._id || n.id;
      if (nId === id && !n.read) {
        setUnreadCount(count => Math.max(0, count - 1));
        return { ...n, read: true };
      }
      return n;
    }));
    try {
      await apiPut(`/notifications/${id}/read`, {});
    } catch (e) {
      console.error('Failed to mark read', e);
      fetchNotifications();
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiPut('/notifications/read-all', {});
    } catch (e) {
      console.error('Failed to mark all read', e);
      fetchNotifications();
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      refreshNotifications: fetchNotifications,
      toastNotification,
      dismissToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
