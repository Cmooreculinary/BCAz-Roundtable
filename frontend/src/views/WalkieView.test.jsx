import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import { sendTalkState, setAudioEnabled, startCall } from "../lib/webrtc";
import WalkieView from "./WalkieView";

jest.mock("../lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", name: "Me" } }),
}));

jest.mock("../lib/webrtc", () => ({
  startCall: jest.fn(),
  leaveCall: jest.fn(),
  isInCall: jest.fn(() => false),
  onCallStateChange: jest.fn(() => () => {}),
  setAudioEnabled: jest.fn(),
  sendTalkState: jest.fn(),
}));

jest.mock("../components/UserAvatar", () => function MockUserAvatar({ user }) { return <div>{user.name}</div>; });
jest.mock("../lib/logger", () => ({ error: jest.fn() }));
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("WalkieView", () => {
  let container;
  let root;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [{ id: "other", name: "Other", status: "online" }] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("does not enable the microphone when the user releases before the room joins", async () => {
    let finishJoin;
    startCall.mockImplementation(() => new Promise((resolve) => { finishJoin = resolve; }));

    await act(async () => {
      root.render(<WalkieView onVideoCall={jest.fn()} />);
      await Promise.resolve();
    });

    await act(async () => container.querySelector('[data-testid="walkie-select-other"]').click());
    const talkButton = container.querySelector('[data-testid="walkie-talk-btn"]');

    await act(async () => {
      talkButton.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      talkButton.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      finishJoin();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startCall).toHaveBeenCalledWith({ targetUser: "other", type: "audio" });
    expect(setAudioEnabled).not.toHaveBeenCalledWith(true);
    expect(sendTalkState).not.toHaveBeenCalledWith(true);
  });

  test("does not transmit after a failed room join", async () => {
    startCall.mockRejectedValue(new Error("Microphone denied"));

    await act(async () => {
      root.render(<WalkieView onVideoCall={jest.fn()} />);
      await Promise.resolve();
    });

    await act(async () => container.querySelector('[data-testid="walkie-select-other"]').click());
    const talkButton = container.querySelector('[data-testid="walkie-talk-btn"]');

    await act(async () => {
      talkButton.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setAudioEnabled).not.toHaveBeenCalledWith(true);
    expect(sendTalkState).not.toHaveBeenCalledWith(true);
  });
});
