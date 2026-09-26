/**
 * Tiny fetch wrapper with JWT header + offline cache.
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

// ---- AI chat ----
export const chatWithNotes = (message, setId = null) =>
  api('/ai/chat', { method: 'POST', body: { message, setId } });

// ---- Quizzes ----
export const generateQuiz = (setId, count = 10, types = ['mcq', 'short']) =>
  api('/quizzes/generate', { method: 'POST', body: { setId, count, types } });

export const getQuiz = (id) => api(`/quizzes/${id}`);

export const submitQuiz = (id, answers) =>
  api(`/quizzes/${id}/submit`, { method: 'POST', body: { answers } });

export const getQuizAttemptsBySet = (setId) => api(`/quizzes/by-set/${setId}`);

// ---- Infinite Campus ----
export const getICStatus = () => api('/ic/status');
export const saveICCredentials = (payload) =>
  api('/ic/credentials', { method: 'POST', body: payload });
export const disconnectIC = () => api('/ic/credentials', { method: 'DELETE' });
export const previewICSync = () => api('/ic/preview', { method: 'POST' });
export const syncICGrades = () => api('/ic/sync', { method: 'POST' });
export const syncICGradesSelected = (selection) =>
  api('/ic/sync', { method: 'POST', body: { selection } });

// ---- Grade snapshots ----
export const updateClass = (id, body) =>
  api(`/classes/${id}`, { method: 'PUT', body });
// ---- Screenshot grade import ----
export async function scanGradesFromScreenshot(file) { export const parseGradesFromText = (text) =>
  api('/ai/grades/parse-text', { method: 'POST', body: { text } });
  const fd = new FormData();
  fd.append('file', file);
  const token = getToken();
  const res = await fetch('/api/ai/grades/scan', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Scan failed (${res.status})`);
  return data;
}
