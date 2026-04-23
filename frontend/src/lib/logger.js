/**
 * Development-only logger. Silent in production.
 * Replaces raw console.error/log throughout the app.
 */
const isDev = process.env.NODE_ENV === "development";

const logger = {
  error: (...args) => { if (isDev) console.error("[RT]", ...args); },
  warn: (...args) => { if (isDev) console.warn("[RT]", ...args); },
  info: (...args) => { if (isDev) console.log("[RT]", ...args); },
};

export default logger;
