import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, onOffline } from './api.js';

const Ctx = createContext(null);
const THEME_KEY = 'studysync_theme';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem(THEME_KEY) || '{}'); } catch { return {}; }
  });
  const [toast, setToastState] = useState(null);

  // Simple toast system — auto-dismisses after 3.5s
  const showToast = useCallback((message, type = 'info') => {
    setToastState({ message, type, id: Date.now() });
    setTimeout(() => setToastState(null), 3500);
  }, []);

  useEffect(() => { onOffline(() => showToast('Backend unreachable — showing saved data', 'warn')); }, [showToast]);

  // Restore session on refresh
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  // Apply theme classes to <html>
  useEffect(() => {
    const dark = theme.dark ?? matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('contrast', !!theme.contrast);
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [theme]);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token); setUser(data.user);
  };
  const register = async (name, email, password) => {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    setToken(data.token); setUser(data.user);
  };
  const logout = () => { setToken(null); setUser(null); };

  const isDark = theme.dark ?? matchMedia('(prefers-color-scheme: dark)').matches;
  const toggleDark = () => setTheme((t) => ({ ...t, dark: !isDark }));
  const toggleContrast = () => setTheme((t) => ({ ...t, contrast: !t.contrast }));

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, isDark, toggleDark, contrast: !!theme.contrast, toggleContrast, toast: showToast }}>
      {children}
      {toast && (
        <div role="status" aria-live="polite" className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-lg px-4 py-2.5 text-sm shadow-lg animate-fade-in ${toast.type === 'error' ? 'bg-destructive text-destructive-foreground' : toast.type === 'warn' ? 'bg-amber-500 text-black' : 'bg-foreground text-background'}`}>
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
