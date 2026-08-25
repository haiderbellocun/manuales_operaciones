import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.removeItem('acervo_session');
    api.getSession()
      .then(({ user }) => setSession({ user, provider: 'session' }))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.loginWithGoogle(credential);
      const next = { ...result, loginAt: Date.now() };
      setSession(next);
      return next;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
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
      user, session, loading, error, loginWithGoogle, logout,
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
