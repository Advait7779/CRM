export const IMPERSONATION_TOKEN = 'impersonationToken'

export function getActiveToken() {
  return sessionStorage.getItem(IMPERSONATION_TOKEN) || localStorage.getItem('token')
}
