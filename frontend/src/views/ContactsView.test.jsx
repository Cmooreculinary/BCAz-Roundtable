import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import ContactsView from "./ContactsView";

const mockNavigate = jest.fn();

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  formatApiError: jest.fn((_err, fallback) => fallback),
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("../components/rt/HelpTip", () => () => null);
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("ContactsView", () => {
  let container;
  let root;

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === "/contacts") {
        return Promise.resolve({
          data: [{ id: "c1", name: "Pat", email: "pat@example.com", is_member: true, member_id: "user-pat" }],
        });
      }
      if (url === "/bridges/status") return Promise.resolve({ data: { sms_configured: false, email_configured: false } });
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

  test("member Chat opens the matching conversation", async () => {
    await act(async () => {
      root.render(<ContactsView />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => container.querySelector('[data-testid="contact-chat-c1"]').click());
    expect(mockNavigate).toHaveBeenCalledWith("/messages?with=user-pat");
  });
});
