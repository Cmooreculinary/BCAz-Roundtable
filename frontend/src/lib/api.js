import { create as createAxiosInstance } from "axios";

export const ACCESS_TOKEN_KEY = "rt-access-token";

export function normalizeBackendUrl(value) {
  const configured = (value || "http://localhost:8001").trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}

export const BACKEND_URL = normalizeBackendUrl(process.env.REACT_APP_BACKEND_URL);
export const API = `${BACKEND_URL}/api`;

function getSessionStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) || "";
}

export function setAccessToken(token) {
  const storage = getSessionStorage();
  if (!storage) return;
  if (token) storage.setItem(ACCESS_TOKEN_KEY, token);
  else storage.removeItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  setAccessToken("");
}

export function buildFileUrl(value) {
  if (!value) return "";

  const configured = String(value).trim().replace("/api/api/files/", "/api/files/");
  if (/^https?:\/\//i.test(configured)) return configured;

  const storagePath = configured
    .replace(/^\/+/, "")
    .replace(/^api\/files\//, "")
    .replace(/^files\//, "");
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${API}/files/${encodedPath}`;
}

export function formatApiError(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (detail != null) return formatApiErrorDetail(detail);
  return error?.message || fallback;
}

export const api = createAxiosInstance({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (!token) return config;

  if (typeof config.headers?.set === "function") {
    if (!config.headers.has("Authorization")) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  } else {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
