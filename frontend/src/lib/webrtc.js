/**
 * WebRTC service for Roundtable_VO — handles peer connections, media streams,
 * and signaling via the existing WebSocket layer.
 *
 * Supports mesh topology for group calls (up to ~6 peers).
 */
import { sendWS, onRTEvent } from "./realtime";
import logger from "./logger";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// ── State ──────────────────────────────────────────────
let localStream = null;
let callId = null;
let pendingCall = null;
const pendingIce = new Map();
let callType = null; // "audio" | "video"
const peers = new Map(); // peerId -> { pc: RTCPeerConnection, streams: MediaStream[] }
const stateListeners = new Set();

// ── Public getters ─────────────────────────────────────
export function getCallId() { return callId; }
export function getCallType() { return callType; }
export function getLocalStream() { return localStream; }
export function getPeers() { return peers; }
export function isInCall() { return !!callId; }

// ── State change notifications ─────────────────────────
export function onCallStateChange(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}
function notifyStateChange(event, data) {
  stateListeners.forEach((fn) => {
    try { fn(event, data); } catch (err) { logger.error("Call state listener error:", err); }
  });
}

// ── Media helpers ──────────────────────────────────────
export async function getMedia(type = "video") {
  const constraints = type === "audio"
    ? { audio: true, video: false }
    : { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    logger.error("getUserMedia failed:", err);
    throw err;
  }
}

export function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

// ── Peer connection factory ────────────────────────────
function createPeerConnection(peerId) {
  if (peers.has(peerId)) return peers.get(peerId).pc;
  const peerCallId = callId;
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Send ICE candidates to remote peer
  pc.onicecandidate = (e) => {
    if (e.candidate && callId === peerCallId) {
      sendWS({
        type: "webrtc_ice",
        target_user: peerId,
        call_id: callId,
        candidate: e.candidate.toJSON(),
      });
    }
  };

  // Receive remote tracks
  pc.ontrack = (e) => {
    const existing = peers.get(peerId);
    if (existing) {
      existing.streams = e.streams;
    }
    notifyStateChange("track", { peerId, streams: e.streams });
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
      notifyStateChange("peer_connection_state", { peerId, state: pc.iceConnectionState });
    }
  };

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  peers.set(peerId, { pc, streams: [] });
  return pc;
}

// ── Call lifecycle ─────────────────────────────────────
async function beginCall(id, type, payload) {
  if (callId) throw new Error("End your current call first");
  callId = id;
  callType = type;
  const attempt = {};
  pendingCall = attempt;
  let stream;
  try {
    stream = await getMedia(type);
  } catch {
    if (pendingCall === attempt) cleanup();
    throw new Error("Could not access microphone" + (type === "video" ? "/camera" : ""));
  }
  // A closed overlay or lost connection must not leave a late camera stream running.
  if (pendingCall !== attempt) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("Call cancelled");
  }
  localStream = stream;
  return new Promise((resolve, reject) => {
    attempt.resolve = resolve;
    attempt.reject = reject;
    attempt.timer = setTimeout(() => {
      if (pendingCall === attempt) {
        sendWS({ type: "call_leave", call_id: id });
        cleanup("The call did not connect. Please try again.");
      }
    }, 15000);
    if (!sendWS(payload)) {
      cleanup("Connection lost. Reconnect before starting a call.");
    }
  });
}

function confirmCall() {
  if (!pendingCall) return;
  const attempt = pendingCall;
  pendingCall = null;
  clearTimeout(attempt.timer);
  attempt.resolve?.(callId);
}

export function startCall(options = {}) {
  const { tableId, targetUser, type = "video" } = options;
  if (!tableId && !targetUser) return Promise.reject(new Error("Choose someone to call"));
  const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return beginCall(id, type, {
    type: "call_start", call_id: id, table_id: tableId || null,
    call_type: type, target_user: targetUser || null,
  });
}

export function joinCall(id, type = "video") {
  if (!id) return Promise.reject(new Error("Call not found"));
  return beginCall(id, type, { type: "call_join", call_id: id });
}

export function leaveCall() {
  if (callId) {
    sendWS({ type: "call_leave", call_id: callId });
  }
  cleanup();
  notifyStateChange("call_ended", {});
}

function cleanup(reason = "Call cancelled") {
  if (pendingCall) {
    clearTimeout(pendingCall.timer);
    pendingCall.reject?.(new Error(reason));
    pendingCall = null;
  }
  pendingIce.clear();
  peers.forEach(({ pc }) => {
    try { pc.close(); } catch (e) { logger.error("PC close error:", e); }
  });
  peers.clear();
  stopLocalStream();
  callId = null;
  callType = null;
}

// ── Signaling handlers (called from WS events) ────────
function handleCallJoined(data) {
  // Existing participants offer; the joining participant answers. One offer per pair.
  confirmCall();
  notifyStateChange("call_joined", data);
}

async function handlePeerJoined(data) {
  // Only the existing participant creates the offer.
  await createOfferForPeer(data.peer.id);
  notifyStateChange("peer_joined", data);
}

async function handlePeerLeft(data) {
  const peerId = data.peer?.id;
  if (peerId && peers.has(peerId)) {
    const { pc } = peers.get(peerId);
    try { pc.close(); } catch (e) { logger.error("PC close error:", e); }
    peers.delete(peerId);
    pendingIce.delete(peerId);
  }
  notifyStateChange("peer_left", data);
}

async function createOfferForPeer(peerId) {
  const pc = createPeerConnection(peerId);
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (peers.get(peerId)?.pc !== pc) return;
    sendWS({
      type: "webrtc_offer",
      target_user: peerId,
      call_id: callId,
      sdp: pc.localDescription.toJSON(),
    });
  } catch (err) {
    logger.error("createOffer failed:", err);
  }
}

async function handleOffer(data) {
  const peerId = data.from_user;
  let entry = peers.get(peerId);
  let pc;

  if (!entry) {
    pc = createPeerConnection(peerId);
    entry = peers.get(peerId);
  } else {
    pc = entry.pc;
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushIce(peerId, pc);
    if (peers.get(peerId)?.pc !== pc) return;
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (peers.get(peerId)?.pc !== pc) return;
    sendWS({
      type: "webrtc_answer",
      target_user: peerId,
      call_id: callId,
      sdp: pc.localDescription.toJSON(),
    });
  } catch (err) {
    logger.error("handleOffer failed:", err);
  }
}

async function handleAnswer(data) {
  const peerId = data.from_user;
  const entry = peers.get(peerId);
  if (!entry) return;
  try {
    await entry.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushIce(peerId, entry.pc);
  } catch (err) {
    logger.error("handleAnswer failed:", err);
  }
}

async function flushIce(peerId, pc) {
  const candidates = pendingIce.get(peerId) || [];
  pendingIce.delete(peerId);
  for (const candidate of candidates) {
    if (peers.get(peerId)?.pc !== pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch (error) { logger.error("addIceCandidate failed:", error); }
  }
}

async function handleIce(data) {
  const peerId = data.from_user;
  const entry = peers.get(peerId);
  if (!entry?.pc.remoteDescription) {
    const candidates = pendingIce.get(peerId) || [];
    if (candidates.length < 256) candidates.push(data.candidate);
    pendingIce.set(peerId, candidates);
    return;
  }
  try {
    await entry.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (err) {
    logger.error("addIceCandidate failed:", err);
  }
}

// ── Media controls ─────────────────────────────────────
export function toggleMute() {
  if (!localStream) return false;
  const audioTracks = localStream.getAudioTracks();
  const newState = audioTracks.length > 0 ? !audioTracks[0].enabled : false;
  audioTracks.forEach((t) => { t.enabled = newState; });
  return !newState; // returns true if muted
}

export function toggleCamera() {
  if (!localStream) return false;
  const videoTracks = localStream.getVideoTracks();
  const newState = videoTracks.length > 0 ? !videoTracks[0].enabled : false;
  videoTracks.forEach((t) => { t.enabled = newState; });
  return !newState; // returns true if camera off
}

export function setAudioEnabled(enabled) {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((t) => { t.enabled = enabled; });
}

export function sendTalkState(talking) {
  if (callId) {
    sendWS({ type: "walkie_talk_state", call_id: callId, talking });
  }
}

// ── Event bus integration ──────────────────────────────
// Subscribe to WS events for signaling
onRTEvent((evt) => {
  if (!evt) return;
  if (evt.type === "connection_closed") {
    if (callId) {
      cleanup("Connection lost. Please start the call again.");
      notifyStateChange("call_ended", {});
    }
    return;
  }
  if (!callId || (evt.call_id && evt.call_id !== callId)) return;
  switch (evt.type) {
    case "call_started":
      confirmCall();
      notifyStateChange("call_started", evt);
      break;
    case "call_joined":
      handleCallJoined(evt);
      break;
    case "call_peer_joined":
      handlePeerJoined(evt);
      break;
    case "call_peer_left":
      handlePeerLeft(evt);
      break;
    case "webrtc_offer":
      handleOffer(evt);
      break;
    case "webrtc_answer":
      handleAnswer(evt);
      break;
    case "webrtc_ice":
      handleIce(evt);
      break;
    case "call_error":
      sendWS({ type: "call_leave", call_id: callId });
      cleanup(evt.error || "Call failed");
      notifyStateChange("error", { error: evt.error });
      break;
    default:
      break;
  }
});

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (callId) leaveCall();
  });
}
