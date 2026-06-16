import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { KEYS } from '../utils/storage';

const AuthContext = createContext(null);

function readSession() {
  try {
    const raw = localStorage.getItem(KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) localStorage.setItem(KEYS.session, JSON.stringify(session));
  else localStorage.removeItem(KEYS.session);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!api.config.useMock && session?.token) {
      api.getSession().catch(() => setSession(null));
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      const next = { ...result, loginAt: Date.now() };
      saveSession(next);
      setSession(next);
      return next;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithMicrosoft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.loginWithMicrosoft();
      const next = { ...result, loginAt: Date.now() };
      saveSession(next);
      setSession(next);
      return next;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
    setError(null);
  }, []);

  const user = session?.user ?? null;
  const initials = user
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <AuthContext.Provider value={{
      user, session, loading, error, login, loginWithMicrosoft, logout,
      isAuthenticated: !!session,
      initials,
      roleName: user?.roleName || '',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
