import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useFileUrl, { isPrivateFileUrl } from "./useFileUrl";
import { api, API } from "../lib/api";

jest.mock("../lib/api", () => ({
  API: "https://api.example.com/api",
  api: { get: jest.fn() },
  buildFileUrl: (value) => value,
  formatApiError: () => "File unavailable",
}));

test("only fetches protected files from the configured backend", () => {
  expect(isPrivateFileUrl(`${API}/files/file.pdf`)).toBe(true);
  expect(isPrivateFileUrl("https://attacker.example/api/files/file.pdf")).toBe(false);
  expect(isPrivateFileUrl("https://api.example.com.attacker.example/api/files/file.pdf")).toBe(false);
});

test("loads protected files through the authenticated client and releases blobs", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const file = new Blob(["private content"], { type: "application/pdf" });
  api.get.mockResolvedValue({ data: file });
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:private-file");
  URL.revokeObjectURL = jest.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  function Viewer() {
    const { url } = useFileUrl(`${API}/files/report.pdf`);
    return <span>{url}</span>;
  }
  try {
    await act(async () => root.render(<Viewer />));
    expect(api.get).toHaveBeenCalledWith(`${API}/files/report.pdf`, expect.objectContaining({ responseType: "blob" }));
    expect(container.textContent).toBe("blob:private-file");
    await act(async () => root.unmount());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-file");
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
