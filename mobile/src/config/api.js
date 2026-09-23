import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const REQUEST_TIMEOUT_MS = 20000;
const SERVER_URL_KEY = 'crm_server_url';
const TOKEN_KEY = 'crm_auth_token';
const USER_KEY = 'crm_auth_user';
let unauthorizedHandler = null;

function normalizeServerUrl(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.endsWith('/api') ? raw : raw + '/api';
}

function getDevelopmentServerUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return 'http://' + (window.location.hostname || 'localhost') + ':5001/api';
  }
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri || '';
  const host = hostUri.split(':')[0];
  return host ? 'http://' + host + ':5001/api' : '';
}

export const DEFAULT_SERVER_URL = normalizeServerUrl(
  process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? getDevelopmentServerUrl() : '')
);

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export async function getServerUrl() {
  try {
    return (await AsyncStorage.getItem(SERVER_URL_KEY)) || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export async function setServerUrl(url) {
  const cleanUrl = normalizeServerUrl(url);
  if (!cleanUrl) throw new Error('Enter a valid API server URL.');

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new Error('Enter a complete URL beginning with https://.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP or HTTPS server URLs are supported.');
  }
  if (!__DEV__ && parsed.protocol !== 'https:') {
    throw new Error('Production builds require an HTTPS API URL.');
  }

  await AsyncStorage.setItem(SERVER_URL_KEY, cleanUrl);
  return cleanUrl;
}

export async function getAuthToken() {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(TOKEN_KEY);

    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secureToken) return secureToken;

    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacyToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return legacyToken;
  } catch {
    return null;
  }
}

export async function setAuthToken(token) {
  try {
    if (Platform.OS === 'web') {
      if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
      else await AsyncStorage.removeItem(TOKEN_KEY);
      return;
    }

    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error saving auth token', error);
  }
}

export async function getSavedUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setSavedUser(user) {
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Error saving user', error);
  }
}

export async function apiRequest(endpoint, options = {}) {
  const baseUrl = await getServerUrl();
  const token = await getAuthToken();

  if (!baseUrl) {
    throw new Error('API server is not configured. Open Server Settings and enter the HTTPS API URL.');
  }

  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url = baseUrl + path;
  const headers = {
    Accept: 'application/json',
    ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...options.headers
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  const config = {
    method: options.method || 'GET',
    headers,
    signal: options.signal || controller.signal,
    ...(options.body ? { body: options.isFormData ? options.body : JSON.stringify(options.body) } : {})
  };

  try {
    const response = await fetch(url, config);
    if (response.status === 401) {
      await setAuthToken(null);
      await setSavedUser(null);
      unauthorizedHandler?.();
      throw new Error('Session expired. Please log in again.');
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = typeof data === 'object' && (data.message || data.error)
        ? data.message || data.error
        : data || 'Request failed';
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The server took too long to respond. Check your connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the API server. Check your network and Server Settings.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testServerConnection(url) {
  const baseUrl = normalizeServerUrl(url || await getServerUrl());
  if (!baseUrl) throw new Error('API server is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(baseUrl.replace(/\/api$/, '') + '/health/ready', { signal: controller.signal });
    if (!response.ok) throw new Error('The server is reachable but not ready.');
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Connection test timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGetAll(path, pageSize = 200, maxPages = 50) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await apiGet(`${path}${separator}page=${page}&pageSize=${pageSize}`);
    if (!Array.isArray(batch)) return batch;
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export const apiGet = (path) => apiRequest(path, { method: 'GET' });
export const apiPost = (path, body) => apiRequest(path, { method: 'POST', body });
export const apiPut = (path, body) => apiRequest(path, { method: 'PUT', body });
export const apiDelete = (path) => apiRequest(path, { method: 'DELETE' });
export const apiUpload = (path, formData) => apiRequest(path, { method: 'POST', body: formData, isFormData: true });
