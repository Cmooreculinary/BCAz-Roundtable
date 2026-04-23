import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import logger from "../lib/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, object = user, false = not logged in
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (err) {
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatApiErrorDetail(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatApiErrorDetail(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      logger.error("Logout API error (non-blocking):", err);
    }
    setUser(false);
  }, []);

  const updateMe = useCallback(async (patch) => {
    const { data } = await api.put("/me", patch);
    setUser(data);
    return data;
  }, []);

  const contextValue = useMemo(() => ({
    user, setUser, login, register, logout, updateMe, error, refresh: fetchMe
  }), [user, error, fetchMe, login, register, logout, updateMe]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
