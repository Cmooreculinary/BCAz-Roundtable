/**
 * WebRTC service for MICRO — handles peer connections, media streams,
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
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Send ICE candidates to remote peer
  pc.onicecandidate = (e) => {
    if (e.candidate) {
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
export async function startCall(options = {}) {
  const { tableId, targetUser, type = "video" } = options;
  callType = type;

  try {
    localStream = await getMedia(type);
  } catch (err) {
    throw new Error("Could not access microphone" + (type === "video" ? "/camera" : ""));
  }

  const newCallId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  callId = newCallId;

  sendWS({
    type: "call_start",
    call_id: callId,
    table_id: tableId || null,
    call_type: type,
    target_user: targetUser || null,
  });

  notifyStateChange("call_started", { callId, type });
  return callId;
}

export async function joinCall(joinCallId, type = "video") {
  callType = type;
  callId = joinCallId;

  try {
    localStream = await getMedia(type);
  } catch (err) {
    throw new Error("Could not access microphone" + (type === "video" ? "/camera" : ""));
  }

  sendWS({ type: "call_join", call_id: callId });
  notifyStateChange("call_joining", { callId, type });
}

export function leaveCall() {
  if (callId) {
    sendWS({ type: "call_leave", call_id: callId });
  }
  cleanup();
  notifyStateChange("call_ended", {});
}

function cleanup() {
  peers.forEach(({ pc }) => {
    try { pc.close(); } catch (e) { logger.error("PC close error:", e); }
  });
  peers.clear();
  stopLocalStream();
  callId = null;
  callType = null;
}

// ── Signaling handlers (called from WS events) ────────
async function handleCallJoined(data) {
  // We joined a call — create offers to all existing peers
  const existingPeers = data.existing_peers || [];
  for (const peer of existingPeers) {
    await createOfferForPeer(peer.id);
  }
}

async function handlePeerJoined(data) {
  // A new peer joined — they will receive our offer
  // The existing peer (us) creates the offer
  await createOfferForPeer(data.peer.id);
  notifyStateChange("peer_joined", data);
}

async function handlePeerLeft(data) {
  const peerId = data.peer?.id;
  if (peerId && peers.has(peerId)) {
    const { pc } = peers.get(peerId);
    try { pc.close(); } catch (e) { logger.error("PC close error:", e); }
    peers.delete(peerId);
  }
  notifyStateChange("peer_left", data);
}

async function createOfferForPeer(peerId) {
  const pc = createPeerConnection(peerId);
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
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
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
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
  } catch (err) {
    logger.error("handleAnswer failed:", err);
  }
}

async function handleIce(data) {
  const peerId = data.from_user;
  const entry = peers.get(peerId);
  if (!entry) return;
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
const unsubscribe = onRTEvent((evt) => {
  if (!evt) return;
  switch (evt.type) {
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
