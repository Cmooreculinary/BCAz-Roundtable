import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import MessagesView from "./MessagesView";

const mockSearchParams = new URLSearchParams("with=other");

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams],
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", name: "Me" } }),
}));

jest.mock("../lib/realtime", () => ({ useRTEvent: () => {} }));
jest.mock("../lib/logger", () => ({ error: jest.fn() }));
jest.mock("../components/UserAvatar", () => function MockAvatar({ user }) { return <div>{user.name}</div>; });
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe("MessagesView", () => {
  let container;
  let root;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === "/members") return Promise.resolve({ data: [{ id: "other", name: "Other", status: "online" }] });
      if (url.startsWith("/messages")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("opens a conversation from the with query and shares files through Share Item", async () => {
    const onShare = jest.fn();
    await act(async () => {
      root.render(<MessagesView onShare={onShare} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="messages-person-other"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="messages-attach"]')).not.toBeNull();
    await act(async () => container.querySelector('[data-testid="messages-attach"]').click());
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
