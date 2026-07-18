import {
  isHexColor,
  normalizeHexColor,
  onboardingErrorMessage,
  ONBOARDING_COLORS,
} from "./onboarding";

describe("onboarding color handling", () => {
  test("includes both preset and BCA fire-orange choices", () => {
    expect(ONBOARDING_COLORS).toContain("#007AFF");
    expect(ONBOARDING_COLORS).toContain("#EC5B13");
  });

  test("normalizes valid custom colors", () => {
    expect(normalizeHexColor(" #ec5b13 ")).toBe("#EC5B13");
    expect(isHexColor("#34c759")).toBe(true);
  });

  test("rejects unsafe or incomplete CSS values", () => {
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("url(javascript:alert(1))")).toBe(false);
    expect(normalizeHexColor("not-a-color", "#34C759")).toBe("#34C759");
  });
});

describe("onboarding error messages", () => {
  test("explains cookie or token authorization failures", () => {
    expect(onboardingErrorMessage({ response: { status: 401 } }))
      .toMatch(/secure session/i);
  });

  test("keeps server-provided validation details", () => {
    expect(onboardingErrorMessage({ response: { status: 422, data: { detail: "Invalid color" } } }))
      .toBe("Invalid color");
  });
});
