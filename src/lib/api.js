/**
 * Tiny fetch wrapper with:
 *  - automatic JWT header
 *  - readable error messages
 *  - localStorage fallback: GET responses are cached, and served if the backend is unreachable
 */
export const TOKEN_KEY = 'studysync_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let offlineListener = null;
export const onOffline = (fn) => (offlineListener = fn);

export async function api(path, { method = 'GET', body } = {}) {
  const cacheKey = `studysync_cache:${path}`;
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token) {
        setToken(null);
        window.location.href = '/login';
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    if (method === 'GET') localStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (err) {
    // Network failure (server down) → serve cached copy for GETs
    if (method === 'GET' && err instanceof TypeError) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        offlineListener?.();
        return JSON.parse(cached);
      }
    }
    throw err;
  }
}
