/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import { BASE } from '../utils/api'

const AuthContext = createContext(null)

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DIRECTOR: 'director',
  ACCOUNTS: 'accounts',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
  INSTALLATION_MANAGER: 'installation_manager',
  GPS_INSTALLER: 'gps_installer',
  CCTV_TECHNICIAN: 'cctv_technician',
  WEBSITE_DEVELOPER: 'website_developer',
  DIGITAL_MARKETING: 'digital_marketing',
  SUPPORT_EXECUTIVE: 'support_executive',
  CUSTOMER: 'customer',
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    const headers = { Authorization: `Bearer ${token}` }
    fetch(`${BASE}/auth/profile`, { headers, credentials: 'include' })
      .then(async response => {
        if (response.ok) {
          const profile = await response.json()
          setUser(profile)
        } else if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token')
          setUser(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    let res
    try {
      res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })
    } catch {
      throw new Error('Unable to connect to backend server. Please make sure the backend is running on port 5001.')
    }

    let data
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      if (res.status === 502) {
        throw new Error(data?.message || 'Backend server is not reachable on port 5001. Please make sure the backend server is running.')
      }
      throw new Error(data?.message || 'Invalid credentials')
    }
    if (data?.token) {
      localStorage.setItem('token', data.token)
    }
    setUser(data?.user)
    return { success: true }
  }

  const logout = async () => {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    await fetch(`${BASE}/auth/logout`, { method: 'POST', headers, credentials: 'include' }).catch(() => {})
    localStorage.removeItem('token')
    setUser(null)
  }

  const updateUser = (changes) => {
    setUser(prev => {
      const next = { ...prev, ...changes }
      return next
    })
  }

  const hasPermission = (allowedRoles) => {
    if (!user) return false
    if (user.role === ROLES.SUPER_ADMIN) return true
    return allowedRoles.includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasPermission, ROLES }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
