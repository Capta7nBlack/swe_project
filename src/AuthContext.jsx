// src/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
// CHANGED: Import the real API helper
import { api } from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (token) localStorage.setItem("token", token);
      else localStorage.removeItem("token");
    } catch {}
  }, [token]);

  const login = async (username, password) => {
    // CHANGED: Use real API call
    try {
      const data = await api.login(username, password);
      setToken(data.access_token);
      return data;
    } catch (e) {
      console.error("Auth error", e);
      return null;
    }
  };

  const logout = () => setToken(null);

  return (
    <AuthContext.Provider value={{ token, setToken, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
