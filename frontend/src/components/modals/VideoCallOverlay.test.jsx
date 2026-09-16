import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { startCall, leaveCall, isInCall } from "../../lib/webrtc";
import VideoCallOverlay from "./VideoCallOverlay";

jest.mock("../../lib/webrtc", () => ({
  startCall: jest.fn(), joinCall: jest.fn(), leaveCall: jest.fn(),
  isInCall: jest.fn(), getLocalStream: jest.fn(() => null), getPeers: jest.fn(() => new Map()),
  onCallStateChange: jest.fn(() => () => {}), toggleMute: jest.fn(), toggleCamera: jest.fn(),
  getCallType: jest.fn(() => "video"),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
let container;
let root;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  jest.clearAllMocks();
  isInCall.mockReturnValue(false);
  startCall.mockResolvedValue("call");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); container.remove(); });

test("parent rerenders do not restart a call and unmount releases it", async () => {
  await act(async () => root.render(<VideoCallOverlay target={{ id: "peer" }} onClose={() => {}} />));
  await act(async () => root.render(<VideoCallOverlay target={{ id: "peer" }} onClose={() => {}} />));
  expect(startCall).toHaveBeenCalledTimes(1);
  expect(leaveCall).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  root = null;
  expect(leaveCall).toHaveBeenCalledTimes(1);
});

test("closing during a media prompt cancels the owned call", async () => {
  let finish;
  startCall.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const closed = jest.fn();
  await act(async () => root.render(<VideoCallOverlay target={{ id: "peer" }} onClose={closed} />));
  await act(async () => root.unmount());
  root = null;
  expect(leaveCall).toHaveBeenCalledTimes(1);
  await act(async () => finish("cancelled"));
  expect(closed).not.toHaveBeenCalled();
});

test("a rejected second call does not end an existing call on unmount", async () => {
  isInCall.mockReturnValue(true);
  startCall.mockRejectedValue(new Error("End your current call first"));
  const closed = jest.fn();
  await act(async () => root.render(<VideoCallOverlay target={{ id: "peer" }} onClose={closed} />));
  expect(closed).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  root = null;
  expect(leaveCall).not.toHaveBeenCalled();
});
