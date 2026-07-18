import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api, clearAccessToken, formatApiError, setAccessToken } from "../lib/api";
import { disconnectWebSocket } from "../lib/realtime";
import logger from "../lib/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, object = user, false = not logged in
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const handleUnauthorized = useCallback((err) => {
    if (err?.response?.status === 401) {
      clearAccessToken();
      disconnectWebSocket();
      setUser(false);
      return true;
    }
    return false;
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setError("");
      setUser(data.user);
      return data.user;
    } catch (err) {
      handleUnauthorized(err);
      setUser(false);
      if (err?.response?.status !== 401) {
        setError(formatApiError(err, "Could not verify your session"));
      }
      return null;
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAccessToken(data.access_token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      clearAccessToken();
      const message = formatApiError(err, "Sign-in failed");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      setAccessToken(data.access_token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      clearAccessToken();
      const message = formatApiError(err, "Registration failed");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    clearAccessToken();
    disconnectWebSocket();
    try {
      await api.post("/auth/logout");
    } catch (err) {
      logger.error("Logout API error (non-blocking):", err);
    }
    setUser(false);
  }, []);

  const updateMe = useCallback(async (patch) => {
    try {
      const { data } = await api.put("/me", patch);
      setUser(data);
      return data;
    } catch (err) {
      handleUnauthorized(err);
      throw err;
    }
  }, [handleUnauthorized]);

  const contextValue = useMemo(() => ({
    user,
    setUser,
    login,
    register,
    logout,
    updateMe,
    error,
    refresh: fetchMe,
  }), [user, error, fetchMe, login, register, logout, updateMe]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
