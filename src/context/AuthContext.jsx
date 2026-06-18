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
  const [loading, setLoading] = useState(() => Boolean(readSession()?.token));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session?.token) {
      setLoading(true);
      api.getSession()
        .then(({ user }) => {
          const next = { ...session, user };
          saveSession(next);
          setSession(next);
        })
        .catch(() => {
          saveSession(null);
          setSession(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
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
  const perms = user?.perms || {};
  const hasPermission = useCallback((permission) => perms[permission] === true, [perms]);
  const hasRole = useCallback((...roles) => roles.map(Number).includes(Number(user?.role)), [user?.role]);
  const initials = user
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <AuthContext.Provider value={{
      user, session, loading, error, login, loginWithMicrosoft, logout,
      isAuthenticated: !!session,
      initials,
      roleName: user?.roleName || '',
      perms,
      hasPermission,
      hasRole,
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
