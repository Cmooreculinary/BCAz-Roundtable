import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import { toast } from "sonner";
import TableView from "./TableView";

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), put: jest.fn() },
  formatApiErrorDetail: jest.fn((detail) => detail || "error"),
}));

jest.mock("react-router-dom", () => ({
  useParams: () => ({ id: "table-1" }),
  useNavigate: () => jest.fn(),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", name: "Me" } }),
}));

jest.mock("../lib/realtime", () => ({ useRTEvent: () => {} }));
jest.mock("../lib/logger", () => ({ error: jest.fn() }));
jest.mock("../components/rt/HelpTip", () => () => null);
jest.mock("../components/rt/RoundTableViz", () => function MockRoundTableViz() { return <div data-testid="rt-viz" />; });
jest.mock("../components/rt/StageViz", () => function MockStageViz() { return <div data-testid="stage-viz" />; });
jest.mock("../components/SmartSuggestions", () => () => null);
jest.mock("../components/PrayerWall", () => () => null);
jest.mock("../components/modals/FileViewerModal", () => () => null);
jest.mock("../components/modals/SceneEditorModal", () => () => null);
jest.mock("../components/UserAvatar", () => function MockAvatar({ user }) { return <div>{user?.name}</div>; });
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe("TableView", () => {
  let container;
  let root;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === "/tables/table-1") {
        return Promise.resolve({
          data: {
            id: "table-1",
            name: "Family",
            created_by: "me",
            members: [{ id: "me", name: "Me" }],
            items: [],
            events: [{ id: "past", title: "Yesterday", date: "2000-01-01", time: "12:00" }],
            seats: [],
            active: false,
            member_count: 1,
            active_count: 0,
          },
        });
      }
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

  test("shows a retryable error when the table fails to load", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/tables/table-1") return Promise.reject({ response: { data: { detail: "Not found" } }, message: "Not found" });
      return Promise.resolve({ data: [] });
    });
    await act(async () => {
      root.render(<TableView />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="table-load-error"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="table-retry-btn"]')).not.toBeNull();
  });

  test("does not start a video call when the table has no other member", async () => {
    const onVideoCall = jest.fn();
    await act(async () => {
      root.render(<TableView onVideoCall={onVideoCall} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("No upcoming events.");
    await act(async () => container.querySelector('[data-testid="table-video-btn"]').click());
    expect(onVideoCall).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });
});
