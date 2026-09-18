import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import { toast } from "sonner";
import Portal from "./Portal";
import { toLocalDateKey } from "../lib/dates";

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), delete: jest.fn() },
  formatApiError: jest.fn((_err, fallback) => fallback),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", name: "Ada Lovelace", avatar_url: "x" } }),
}));

jest.mock("../components/rt/HelpTip", () => () => null);
jest.mock("../lib/logger", () => ({ error: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("Portal", () => {
  let container;
  let root;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    localStorage.setItem("rt-onboard-completed", JSON.stringify({
      avatar: true, phone: true, push: true, table: false,
    }));
    api.get.mockImplementation((url) => {
      if (url === "/events") return Promise.resolve({ data: [{ id: "evt-1", title: "Standup", date: toLocalDateKey(), time: "09:00" }] });
      if (url === "/referrals") return Promise.resolve({ data: { invited: 0, joined: 0 } });
      if (url === "/referrals/leaderboard") return Promise.resolve({ data: [] });
      if (url.startsWith("/emails")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    api.delete.mockResolvedValue({ data: { ok: true } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
  });

  const renderPortal = async (props = {}) => {
    const onCreateTable = jest.fn();
    await act(async () => {
      root.render(
        <Portal
          tables={[]}
          notifications={[]}
          loadTables={jest.fn()}
          loadNotifications={jest.fn()}
          onCreateTable={onCreateTable}
          onGoto={jest.fn()}
          {...props}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return { onCreateTable };
  };

  test("create-table setup reminder opens the create table flow", async () => {
    const { onCreateTable } = await renderPortal();
    const reminder = container.querySelector('[data-testid="setup-reminder-create-your-first-table"]');
    expect(reminder).not.toBeNull();
    await act(async () => reminder.click());
    expect(onCreateTable).toHaveBeenCalledTimes(1);
  });

  test("deleting today's event reloads events instead of tables", async () => {
    const loadTables = jest.fn();
    await renderPortal({ loadTables });
    expect(container.textContent).toContain("Standup");
    api.get.mockClear();
    await act(async () => container.querySelector('[data-testid="portal-event-del-evt-1"]').click());
    expect(loadTables).not.toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith("/events/evt-1");
    expect(api.get).toHaveBeenCalledWith("/events");
    expect(toast.success).toHaveBeenCalled();
  });
});
