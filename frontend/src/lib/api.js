import axios from "axios";

export function normalizeBackendUrl(value) {
  const configured = (value || "http://localhost:8001").trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}

export const BACKEND_URL = normalizeBackendUrl(process.env.REACT_APP_BACKEND_URL);
export const API = `${BACKEND_URL}/api`;

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

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
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
