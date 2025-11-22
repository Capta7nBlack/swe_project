import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import api from '../services/api';

interface AuthContextType {
  user: any;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userId = await SecureStore.getItemAsync('user_id');
    if (token && userId) {
      setUser({ id: userId });
      // Ideally fetch full profile here
    }
    setIsLoading(false);
  };

  const login = async (username: string, pass: string) => {
    // Backend expects form-data for OAuth2
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', pass);

    const res = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await SecureStore.setItemAsync('auth_token', res.data.access_token);
    await SecureStore.setItemAsync('user_id', res.data.user_id.toString());
    setUser({ id: res.data.user_id, role: res.data.role });
    
    router.replace('/(tabs)'); // Go to Home
  };

  const register = async (email: string, pass: string, name: string) => {
    await api.post('/auth/register', null, {
      params: { email, password: pass, name, role: 'consumer' }
    });
    await login(email, pass); // Auto-login after register
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_id');
    setUser(null);
    router.replace('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
