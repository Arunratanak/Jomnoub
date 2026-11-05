import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { SESSION_EXPIRED } from '../utils/feedback';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Session ended (expired or logged out elsewhere): ProtectedRoute sends them to
    // login, then back to the page they were on
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  // Reloads the user, e.g. after their email was verified
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  }, []);

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential });
    setUser(res.data.user);
  };

  const loginWithPassword = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithPassword, register, logout, refreshUser, setSessionUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);