// Utility for authenticated API calls
const envBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '')
  : '';
export const BASE = envBase ? (envBase.endsWith('/api') ? envBase : `${envBase}/api`) : '/api';

function authHeaders() {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Session expired. Please log in again.')
  }
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed')
  return data
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), credentials: 'include' })
  return handleResponse(res)
}

export async function apiGetAll(path, pageSize = 200) {
  const rows = []
  let page = 1
  while (true) {
    const separator = path.includes('?') ? '&' : '?'
    const batch = await apiGet(`${path}${separator}page=${page}&pageSize=${pageSize}`)
    if (!Array.isArray(batch)) return batch
    rows.push(...batch)
    if (batch.length < pageSize) return rows
    page += 1
  }
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(body)
  })
  return handleResponse(res)
}

export async function apiPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(body)
  })
  return handleResponse(res)
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include'
  })
  return handleResponse(res)
}

export async function apiUpload(path, formData) {
  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData
  })
  return handleResponse(res)
}

export async function apiDownload(path, filename) {
  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${BASE}${path}`, {
    headers,
    credentials: 'include'
  })
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await res.json() : await res.text()
    throw new Error(data.message || data.error || 'Download failed')
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
