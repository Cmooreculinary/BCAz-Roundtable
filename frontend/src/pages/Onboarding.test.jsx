import React, { act } from "react";
import { createRoot } from "react-dom/client";

import Onboarding from "./Onboarding";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

const navigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    api: {
      get: jest.fn(),
      post: jest.fn(),
    },
  };
});

jest.mock("../lib/push", () => ({
  getPushPermission: () => "default",
  isPushSupported: () => false,
  subscribeToPush: jest.fn(),
}));

jest.mock("../components/AvatarPicker", () => () => null);

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Onboarding", () => {
  let container;
  let root;
  let updateMe;

  beforeAll(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    updateMe = jest.fn().mockResolvedValue({});
    useAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "chef@example.com",
        name: "Chef Moore",
        color: "#007AFF",
        onboarded: false,
      },
      updateMe,
    });
    api.get.mockResolvedValue({ data: { sms_configured: false } });
    api.post.mockReset();
    navigate.mockReset();

    await act(async () => {
      root.render(<Onboarding />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test("makes preset and custom colors visibly selectable", async () => {
    await act(async () => {
      container.querySelector('[data-testid="onboard-get-started"]').click();
    });

    const fireOrange = container.querySelector('[data-testid="onboard-color-EC5B13"]');
    expect(fireOrange.getAttribute("aria-checked")).toBe("false");

    await act(async () => fireOrange.click());

    expect(fireOrange.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("Selected: #EC5B13");

    const custom = container.querySelector('[data-testid="onboard-color-custom"]');
    await act(async () => setInputValue(custom, "#123456"));
    expect(container.textContent).toContain("Selected: #123456");
  });

  test("suppresses browser contact autofill on profile and phone fields", async () => {
    await act(async () => {
      container.querySelector('[data-testid="onboard-get-started"]').click();
    });

    const nameInput = container.querySelector('[data-testid="onboard-name-input"]');
    expect(nameInput.getAttribute("autocomplete")).toBe("off");
    expect(nameInput.getAttribute("data-form-type")).toBe("other");

    await act(async () => {
      setInputValue(nameInput, "Chef Moore");
      container.querySelector('[data-testid="onboard-profile-next"]').click();
      await Promise.resolve();
    });

    expect(updateMe).toHaveBeenCalledWith(expect.objectContaining({
      name: "Chef Moore",
      color: "#007AFF",
    }));

    const phoneInput = container.querySelector('[data-testid="onboard-phone-input"]');
    expect(phoneInput).not.toBeNull();
    expect(phoneInput.getAttribute("autocomplete")).toBe("off");
    expect(phoneInput.getAttribute("data-lpignore")).toBe("true");
  });
});
