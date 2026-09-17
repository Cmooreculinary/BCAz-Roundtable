import { toLocalDateKey } from "./dates";

describe("toLocalDateKey", () => {
  test("formats a local calendar date as YYYY-MM-DD", () => {
    expect(toLocalDateKey(new Date(2026, 8, 17))).toBe("2026-09-17");
  });

  test("uses the local calendar day, not the UTC ISO date", () => {
    const date = new Date(Date.UTC(2026, 0, 2, 2, 0, 0));
    const localKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    expect(toLocalDateKey(date)).toBe(localKey);
    expect(date.toISOString().slice(0, 10)).toBe("2026-01-02");
  });
});
