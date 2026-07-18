import { useEffect, useRef, useCallback } from "react";
import { BACKEND_URL, getAccessToken } from "./api";
import logger from "./logger";

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
let reconnectEnabled = false;

export function buildWebSocketUrl(backendUrl = BACKEND_URL, token = getAccessToken()) {
  const base = backendUrl.replace(/^http/, "ws") + "/api/ws";
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function connect(onOpen) {
  if (!reconnectEnabled) return null;
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return socket;
  }

  try {
    socket = new WebSocket(buildWebSocketUrl());
  } catch (error) {
    logger.error("WebSocket connection could not be created:", error);
    scheduleReconnect();
    return null;
  }

  socket.onopen = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    onOpen?.();
  };

  socket.onmessage = (event) => {
    try {
      emit(JSON.parse(event.data));
    } catch (error) {
      logger.error("WS message parse error:", error);
    }
  };

  socket.onclose = () => {
    socket = null;
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    scheduleReconnect();
  };

  socket.onerror = () => {
    // The close event owns reconnection so only one retry is scheduled.
  };

  return socket;
}

function scheduleReconnect() {
  if (!reconnectEnabled || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

export function disconnectWebSocket() {
  reconnectEnabled = false;
  clearTimers();
  if (socket) {
    const activeSocket = socket;
    socket = null;
    activeSocket.onclose = null;
    if (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN) {
      activeSocket.close(1000, "Session ended");
    }
  }
}

export function sendWS(payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function useWebSocket(enabled = true) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!enabled || initRef.current) return undefined;
    initRef.current = true;
    reconnectEnabled = true;
    connect();

    return () => {
      initRef.current = false;
      disconnectWebSocket();
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
