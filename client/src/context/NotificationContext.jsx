/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { apiGet, apiPut } from '../utils/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

function relativeTime(dateValue) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])

  const loadNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiGet('/notifications')
      setNotifications(data.map(item => ({ ...item, time: relativeTime(item.createdAt) })))
    } catch {
      // Authentication failures are handled centrally. A notification failure
      // should not prevent the rest of the CRM from rendering.
    }
  }, [user])

  useEffect(() => {
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 60000)
    return () => window.clearInterval(timer)
  }, [loadNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try { await apiPut(`/notifications/${id}/read`, {}) } catch { loadNotifications() }
  }, [loadNotifications])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try { await apiPut('/notifications/read-all', {}) } catch { loadNotifications() }
  }, [loadNotifications])

  const addNotification = useCallback((notification) => {
    setNotifications(prev => [{ ...notification, time: 'just now', read: false }, ...prev])
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, addNotification, refreshNotifications: loadNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
