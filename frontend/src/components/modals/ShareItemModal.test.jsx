import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../../lib/api";
import { toast } from "sonner";
import ShareItemModal from "./ShareItemModal";

jest.mock("../../lib/api", () => ({ api: { post: jest.fn() }, formatApiError: (e) => e.message }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let root;
let container;
let shared;
const setValue = async (selector, value) => act(async () => {
  const element = container.querySelector(selector);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(async () => {
  jest.clearAllMocks();
  shared = jest.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ShareItemModal tables={[{ id: "table", name: "Table" }]} onShared={shared} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
test("uploads through the authenticated API client with browser multipart boundary", async () => {
  const file = new File(["private text"], "launch.txt", { type: "text/plain" });
  Object.defineProperty(container.querySelector('input[type="file"]'), "files", { value: [file] });
  api.post.mockResolvedValueOnce({ data: { storage_path: "owner/launch.txt", size: 12 } }).mockResolvedValueOnce({ data: {} });
  await act(async () => container.querySelector('[data-testid="share-submit"]').click());
  expect(api.post.mock.calls[0][0]).toBe("/upload");
  expect(api.post.mock.calls[0][1].get("file")).toBe(file);
  expect(api.post.mock.calls[0][2]).toEqual({ headers: { "Content-Type": undefined } });
  expect(api.post).toHaveBeenLastCalledWith("/tables/table/items", expect.objectContaining({ url: "owner/launch.txt" }));
  expect(shared).toHaveBeenCalledTimes(1);
});
test("failed note sharing gives feedback and permits retry", async () => {
  await act(async () => container.querySelector('[data-testid="share-type-note"]').click());
  await setValue('[data-testid="share-name"]', "Meeting notes");
  api.post.mockRejectedValueOnce(new Error("Connection lost"));
  await act(async () => container.querySelector('[data-testid="share-submit"]').click());
  expect(toast.error).toHaveBeenCalledWith("Connection lost");
  expect(shared).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="share-submit"]').disabled).toBe(false);
});
test("unsafe link schemes never reach the API", async () => {
  await act(async () => container.querySelector('[data-testid="share-type-link"]').click());
  await setValue('[data-testid="share-url"]', ['javascript', 'alert(1)'].join(':'));
  await act(async () => container.querySelector('[data-testid="share-submit"]').click());
  expect(api.post).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalled();
});
