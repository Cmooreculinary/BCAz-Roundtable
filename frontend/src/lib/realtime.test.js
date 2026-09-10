import { buildWebSocketUrl, buildWebSocketProtocols } from "./realtime";

describe("WebSocket URL authentication", () => {
  test("uses the secure websocket scheme for an HTTPS backend", () => {
    expect(buildWebSocketUrl("https://roundtable.example.com", ""))
      .toBe("wss://roundtable.example.com/api/ws");
  });

  test("sends bearer authentication through subprotocols instead of URL logs", () => {
    expect(buildWebSocketProtocols("signed.jwt.token")).toEqual(["rt-v1", "rt-auth.signed.jwt.token"]);
    expect(buildWebSocketProtocols("")).toEqual(["rt-v1"]);
  });

  test("keeps local development on ws", () => {
    expect(buildWebSocketUrl("http://localhost:8001", "local-token"))
      .toBe("ws://localhost:8001/api/ws");
  });
});
