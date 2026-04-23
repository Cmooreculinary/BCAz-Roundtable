import { useEffect, useRef, useCallback } from "react";
import logger from "./logger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Simple shared event bus so any component can subscribe to live events
const listeners = new Set();
export function onRTEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(evt) {
  listeners.forEach((fn) => {
    try { fn(evt); } catch (err) { logger.error("RT event listener error:", err); }
  });
}

let socket = null;
let reconnectTimer = null;
let pingInterval = null;

function connect(onOpen) {
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return socket;
  const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/api/ws";
  try {
    socket = new WebSocket(wsUrl);
  } catch (e) {
    scheduleReconnect();
    return null;
  }
  socket.onopen = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: "ping" }));
    }, 25000);
    onOpen?.();
  };
  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      emit(data);
    } catch (err) { logger.error("WS message parse error:", err); }
  };
  socket.onclose = () => {
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    scheduleReconnect();
  };
  socket.onerror = () => { /* let onclose handle reconnect */ };
  return socket;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

export function sendWS(payload) {
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function useWebSocket(enabled = true) {
  const initRef = useRef(false);
  useEffect(() => {
    if (!enabled || initRef.current) return;
    initRef.current = true;
    connect();
    return () => {
      // Keep socket alive across page changes; close only on full unmount path
    };
  }, [enabled]);
}

export function useRTEvent(handler, deps = []) {
  const cb = useCallback(handler, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const off = onRTEvent(cb);
    return off;
  }, [cb]);
}
