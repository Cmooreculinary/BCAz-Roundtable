import { API, buildFileUrl, formatApiError, normalizeBackendUrl } from "./api";

describe("API URL handling", () => {
  test("defaults to the local backend", () => {
    expect(normalizeBackendUrl()).toBe("http://localhost:8001");
  });

  test("adds HTTPS to Render hostnames and removes a trailing slash", () => {
    expect(normalizeBackendUrl(" roundtable.example.com/ ")).toBe("https://roundtable.example.com");
  });

  test("preserves an explicit local HTTP URL", () => {
    expect(normalizeBackendUrl("http://127.0.0.1:8001/ ")).toBe("http://127.0.0.1:8001");
  });

  test("builds a portable file URL from a storage path", () => {
    expect(buildFileUrl("Roundtable_VO/uploads/user/file name.pdf"))
      .toBe(`${API}/files/Roundtable_VO/uploads/user/file%20name.pdf`);
  });

  test("accepts an existing API file path", () => {
    expect(buildFileUrl("/api/files/Roundtable_VO/uploads/user/file.pdf"))
      .toBe(`${API}/files/Roundtable_VO/uploads/user/file.pdf`);
  });

  test("repairs legacy double-api absolute file URLs", () => {
    expect(buildFileUrl("https://api.example.com/api/api/files/example.pdf"))
      .toBe("https://api.example.com/api/files/example.pdf");
  });
});

describe("API error handling", () => {
  test("uses server detail when available", () => {
    expect(formatApiError({ response: { data: { detail: "Invalid password" } } }))
      .toBe("Invalid password");
  });

  test("keeps useful network error messages", () => {
    expect(formatApiError(new Error("Network Error"))).toBe("Network Error");
  });
});
