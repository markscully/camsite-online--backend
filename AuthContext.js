import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      api.getBalance().then(d => setBalance(d.balance)).catch(() => {});
    }
    setLoading(false);
  }, []);

  function login(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    api.getBalance().then(d => setBalance(d.balance)).catch(() => {});
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setBalance(0);
  }

  function refreshBalance() {
    api.getBalance().then(d => setBalance(d.balance)).catch(() => {});
  }

  function setBalanceDirect(value) {
    setBalance(value);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, balance, refreshBalance, setBalanceDirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
