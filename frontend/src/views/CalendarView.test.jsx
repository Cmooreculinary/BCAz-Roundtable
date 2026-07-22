import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import CalendarView from "./CalendarView";

jest.mock("../lib/api", () => ({
  api: {
    get: jest.fn(),
    delete: jest.fn(),
  },
  formatApiErrorDetail: jest.fn(() => ""),
}));

jest.mock("../components/rt/HelpTip", () => () => null);
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

describe("CalendarView", () => {
  let container;
  let root;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("opens the event flow from a calendar day", async () => {
    const date = localDateKey();
    const onNew = jest.fn();
    api.get.mockResolvedValue({ data: [] });

    await act(async () => {
      root.render(<CalendarView onNew={onNew} tables={[]} />);
      await Promise.resolve();
    });

    const day = container.querySelector(`[data-testid="cal-cell-${date}"]`);
    expect(day).not.toBeNull();
    expect(day.getAttribute("role")).toBe("button");

    await act(async () => day.click());
    expect(onNew).toHaveBeenCalledWith(date);
  });

  test("deletes an event without triggering the day action", async () => {
    const date = localDateKey();
    const onNew = jest.fn();
    api.get.mockResolvedValue({
      data: [{ id: "event-1", title: "Roundtable", date, time: "12:00", color: "#007AFF" }],
    });
    api.delete.mockResolvedValue({ data: { ok: true } });

    await act(async () => {
      root.render(<CalendarView onNew={onNew} tables={[]} />);
      await Promise.resolve();
    });

    const deleteButton = container.querySelector('[data-testid="cal-event-del-event-1"]');
    expect(deleteButton).not.toBeNull();

    await act(async () => {
      deleteButton.click();
      await Promise.resolve();
    });

    expect(api.delete).toHaveBeenCalledWith("/events/event-1");
    expect(onNew).not.toHaveBeenCalled();
  });
});
