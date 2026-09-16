import { onRTEvent, sendWS } from "./realtime";
import { startCall, joinCall, leaveCall, getCallId, getLocalStream, getPeers } from "./webrtc";

jest.mock("./realtime", () => ({ onRTEvent: jest.fn(), sendWS: jest.fn() }));
jest.mock("./logger", () => ({ error: jest.fn() }));
const emit = onRTEvent.mock.calls[0][0];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let track;
let stream;
let connections;
beforeEach(() => {
  jest.useFakeTimers();
  sendWS.mockReset().mockReturnValue(true);
  track = { stop: jest.fn(), enabled: true };
  stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue(stream) },
  });
  connections = [];
  global.RTCSessionDescription = function (data) { return data; };
  global.RTCIceCandidate = function (data) { return data; };
  global.RTCPeerConnection = jest.fn(() => {
    const pc = {
      addTrack: jest.fn(), close: jest.fn(), remoteDescription: null,
      createOffer: jest.fn(async () => ({ type: "offer", sdp: "offer" })),
      createAnswer: jest.fn(async () => ({ type: "answer", sdp: "answer" })),
      setLocalDescription: jest.fn(async (data) => { pc.localDescription = { toJSON: () => data }; }),
      setRemoteDescription: jest.fn(async (data) => { pc.remoteDescription = data; }),
      addIceCandidate: jest.fn(async () => {}),
    };
    connections.push(pc);
    return pc;
  });
});
afterEach(() => { leaveCall(); jest.useRealTimers(); });
async function connectedCall() {
  const promise = startCall({ targetUser: "peer", type: "audio" });
  await flush();
  emit({ type: "call_started", call_id: getCallId() });
  await promise;
  return getCallId();
}
test("rejects disconnected signaling and releases acquired media", async () => {
  sendWS.mockReturnValue(false);
  await expect(startCall({ targetUser: "peer" })).rejects.toThrow("Connection lost");
  expect(track.stop).toHaveBeenCalled();
  expect(getCallId()).toBeNull();
});
test("does not report a started call until the server acknowledges it", async () => {
  let resolved = false;
  const promise = startCall({ targetUser: "peer" }).then(() => { resolved = true; });
  await flush();
  expect(resolved).toBe(false);
  emit({ type: "call_started", call_id: getCallId() });
  await promise;
  expect(resolved).toBe(true);
});
test("cancels late media permission without keeping the camera on", async () => {
  let grant;
  navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
  const promise = startCall({ targetUser: "peer" });
  leaveCall();
  grant(stream);
  await expect(promise).rejects.toThrow("cancelled");
  expect(track.stop).toHaveBeenCalled();
  expect(getLocalStream()).toBeNull();
  expect(sendWS).not.toHaveBeenCalledWith(expect.objectContaining({ type: "call_start" }));
});
test("media denial while joining does not leave a phantom active call", async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error("denied"));
  await expect(joinCall("room")).rejects.toThrow("Could not access");
  expect(getCallId()).toBeNull();
});
test("unacknowledged calls time out and release media", async () => {
  const promise = startCall({ targetUser: "peer" });
  const outcome = promise.catch((error) => error);
  await flush();
  jest.advanceTimersByTime(15000);
  expect((await outcome).message).toContain("did not connect");
  expect(track.stop).toHaveBeenCalled();
  expect(getCallId()).toBeNull();
});
test("joining participant answers without competing offers and retains early ICE", async () => {
  const promise = joinCall("room");
  await flush();
  emit({ type: "call_joined", call_id: "room", existing_peers: [{ id: "peer" }] });
  await promise;
  expect(connections).toHaveLength(0);
  emit({ type: "webrtc_ice", call_id: "room", from_user: "peer", candidate: { candidate: "early" } });
  emit({ type: "webrtc_offer", call_id: "room", from_user: "peer", sdp: { type: "offer" } });
  await flush();
  expect(connections).toHaveLength(1);
  expect(connections[0].createOffer).not.toHaveBeenCalled();
  expect(connections[0].createAnswer).toHaveBeenCalledTimes(1);
  expect(connections[0].addIceCandidate).toHaveBeenCalledWith({ candidate: "early" });
});
test("existing participant offers once and stale call events cannot create peers", async () => {
  const id = await connectedCall();
  emit({ type: "webrtc_offer", call_id: "old-room", from_user: "stranger", sdp: {} });
  expect(connections).toHaveLength(0);
  emit({ type: "call_peer_joined", call_id: id, peer: { id: "peer" } });
  await flush();
  expect(connections[0].createOffer).toHaveBeenCalledTimes(1);
  emit({ type: "webrtc_answer", call_id: id, from_user: "peer", sdp: { type: "answer" } });
  await flush();
  expect(connections[0].remoteDescription.type).toBe("answer");
});
test("lost signaling releases both microphone and peer connections", async () => {
  const id = await connectedCall();
  emit({ type: "call_peer_joined", call_id: id, peer: { id: "peer" } });
  await flush();
  emit({ type: "connection_closed" });
  expect(track.stop).toHaveBeenCalled();
  expect(connections[0].close).toHaveBeenCalled();
  expect(getPeers().size).toBe(0);
  expect(getCallId()).toBeNull();
});

test("caller tears down immediately when recipient declines", async () => {
  const id = await connectedCall();
  emit({ type: "call_declined", call_id: id, from_user: "peer" });
  await flush();
  expect(track.stop).toHaveBeenCalled();
  expect(getPeers().size).toBe(0);
  expect(getCallId()).toBeNull();
});

test("generic stale call errors do not tear down the current call", async () => {
  const id = await connectedCall();
  emit({ type: "call_error", error: "An older call ended" });
  await flush();
  expect(getCallId()).toBe(id);
});
