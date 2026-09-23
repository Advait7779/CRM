import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, setAuthToken, setSavedUser, getAuthToken, getSavedUser, registerUnauthorizedHandler } from '../config/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from storage
  const initAuth = useCallback(async () => {
    try {
      const savedToken = await getAuthToken();
      const savedUser = await getSavedUser();
      
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
        
        // Verify token in background
        try {
          const profile = await apiGet('/auth/profile');
          if (profile) {
            setUser(profile);
            await setSavedUser(profile);
          }
        } catch {
          // Keep saved user if offline/unreachable
        }
      }
    } catch (e) {
      console.error('Error loading auth state', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => registerUnauthorizedHandler(() => {
    setToken(null);
    setUser(null);
  }), []);

  // Login handler
  const login = async (email, password) => {
    const res = await apiPost('/auth/login', { email: email.trim(), password });
    if (!res || !res.token) {
      throw new Error('Invalid response from server.');
    }
    
    setToken(res.token);
    setUser(res.user);
    await setAuthToken(res.token);
    await setSavedUser(res.user);
    return res.user;
  };

  // Logout handler
  const logout = async () => {
    try {
      await apiPost('/auth/logout', {}).catch(() => {});
    } catch {}
    setToken(null);
    setUser(null);
    await setAuthToken(null);
    await setSavedUser(null);
  };

  // Refresh profile handler
  const refreshProfile = async () => {
    try {
      const profile = await apiGet('/auth/profile');
      if (profile) {
        setUser(profile);
        await setSavedUser(profile);
      }
      return profile;
    } catch (e) {
      console.error('Failed to refresh profile', e);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile,
      isAuthenticated: !!token && !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
