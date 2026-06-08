import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

function safeParseUser(stored) {
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && parsed.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token  = localStorage.getItem('etl_token');
    const stored = localStorage.getItem('etl_user');

    if (!token || !stored) {
      setLoading(false);
      return;
    }

    const parsedUser = safeParseUser(stored);
    if (!parsedUser) {
      localStorage.removeItem('etl_token');
      localStorage.removeItem('etl_user');
      setLoading(false);
      return;
    }

    // Seta usuário imediatamente do localStorage
    setUser(parsedUser);
    setLoading(false);

    // Valida token em background
    authAPI.me()
      .then(r => {
        // Backend retorna o usuário diretamente em r.data (não em r.data.user)
        const updatedUser = r.data.user ?? r.data;
        if (updatedUser?.email) {
          setUser(updatedUser);
          localStorage.setItem('etl_user', JSON.stringify(updatedUser));
        }
      })
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('etl_token');
          localStorage.removeItem('etl_user');
          setUser(null);
        }
        // Erro de rede → mantém usuário logado
      });
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('etl_token', res.data.token);
    localStorage.setItem('etl_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('etl_token');
    localStorage.removeItem('etl_user');
    setUser(null);
  };

  const canDo = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canDo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
