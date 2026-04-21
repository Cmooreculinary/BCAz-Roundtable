import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { api } from "../lib/api";
import { Search, Send, Paperclip, Phone, Video, Trash2, MoreHorizontal } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { useRTEvent } from "../lib/realtime";
import UserAvatar from "../components/UserAvatar";

function timeAgo(iso) {
  if (!iso) return "";
  const now = new Date();
  const then = new Date(iso);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessagesView({ onVideoCall, onWalkie }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    api.get("/members").then((r) => setMembers(r.data || [])).catch((err) => console.error("Failed to load members:", err));
  }, []);

  const filteredMembers = useMemo(() => {
    const others = members.filter((m) => m.id !== user?.id);
    if (!search.trim()) return others;
    return others.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  }, [members, user?.id, search]);

  const open = useCallback(async (m) => {
    setActive(m);
    try {
      const { data } = await api.get(`/messages?with=${m.id}`);
      setMessages(data || []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  const send = async () => {
    if (!input.trim() || !active) return;
    try {
      await api.post("/messages", { to_user: active.id, text: input.trim() });
      setInput("");
      const { data } = await api.get(`/messages?with=${active.id}`);
      setMessages(data || []);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error("Failed to send");
    }
  };

  const deleteMessage = async (msgId) => {
    try {
      await api.delete(`/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Could not delete message");
    }
  };

  const clearConversation = async () => {
    if (!active || !window.confirm(`Move all messages with ${active.name} to trash?`)) return;
    try {
      await api.delete(`/messages/clear/${active.id}`);
      setMessages([]);
      toast.success("Conversation cleared");
    } catch (err) {
      toast.error("Could not clear conversation");
    }
  };

  useRTEvent((evt) => {
    if (evt?.type === "message" && active) {
      const msg = evt.message;
      if (msg && (msg.from_user === active.id || msg.to_user === active.id)) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, [active]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", height: "calc(100vh - 140px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", height: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        {/* Left panel — Conversations */}
        <div style={{ borderRight: "1px solid var(--border-light)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* Search */}
          <div style={{ padding: "12px 14px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: "var(--bg-tertiary)", borderRadius: 10,
            }}>
              <Search size={14} color="var(--text-tertiary)" />
              <input
                style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="messages-search"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredMembers.map((m) => {
              const isActive = active?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => open(m)}
                  data-testid={`messages-person-${m.id}`}
                  style={{
                    padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
                    cursor: "pointer",
                    background: isActive ? "var(--mac-blue)" : "transparent",
                    color: isActive ? "#fff" : "var(--text-primary)",
                    borderBottom: isActive ? "none" : "1px solid var(--border-light)",
                    transition: "background 0.15s",
                  }}
                >
                  <UserAvatar user={m} size={40} style={{ borderRadius: "50%" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.7)" : "var(--text-secondary)", flexShrink: 0 }}>
                        {timeAgo(m.last_seen || m.created_at)}
                      </span>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginTop: 2,
                    }}>
                      <span style={{
                        fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                        color: isActive ? "rgba(255,255,255,0.8)" : "var(--text-secondary)",
                      }}>
                        {m.status === "online" ? "Online" : "Offline"}
                      </span>
                      {m.status === "online" && !isActive && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mac-blue)", flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel — Chat */}
        {!active ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 14 }}>
            Select a conversation
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Chat header */}
            <div style={{
              padding: "12px 18px", borderBottom: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <UserAvatar user={active} size={40} style={{ borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{active.name}</div>
                <div style={{ fontSize: 12, color: active.status === "online" ? "var(--mac-green)" : "var(--text-secondary)" }}>
                  {active.status === "online" ? "online" : "offline"}
                </div>
              </div>
              <button
                onClick={() => onWalkie?.(active)}
                className="btn btn-ghost"
                data-testid="messages-walkie-btn"
                style={{
                  width: 40, height: 40, borderRadius: "50%", padding: 0,
                  background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Phone size={18} />
              </button>
              <button
                onClick={() => onVideoCall?.(active)}
                className="btn btn-ghost"
                data-testid="messages-video-btn"
                style={{
                  width: 40, height: 40, borderRadius: "50%", padding: 0,
                  background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Video size={18} />
              </button>
              <button
                onClick={clearConversation}
                className="btn btn-ghost"
                data-testid="messages-clear-convo"
                title="Clear conversation"
                style={{
                  width: 40, height: 40, borderRadius: "50%", padding: 0,
                  background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--mac-red)",
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, padding: "40px 0" }}>
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map((m) => {
                const isMine = m.from_user === user?.id;
                return (
                  <div key={m.id} className="msg-row" style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 4, position: "relative" }}>
                    <div style={{ display: "flex", alignItems: isMine ? "center" : "center", gap: 4, flexDirection: isMine ? "row" : "row-reverse" }}>
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="msg-delete-btn"
                        data-testid={`msg-delete-${m.id}`}
                        title="Delete message"
                        style={{
                          opacity: 0, width: 24, height: 24, borderRadius: "50%", border: "none",
                          background: "var(--bg-tertiary)", color: "var(--mac-red)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "opacity 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                      <div
                        data-testid={`msg-bubble-${m.id}`}
                        style={{
                          maxWidth: "65%", padding: "10px 14px",
                          borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isMine ? "var(--mac-blue)" : "var(--bg-tertiary)",
                          color: isMine ? "#fff" : "var(--text-primary)",
                          fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0 }}>
                      {formatTime(m.created_at)}
                      {isMine && <span style={{ marginLeft: 6 }}>{m.read ? "Read" : ""}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div style={{
              padding: "12px 16px", borderTop: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <button className="btn btn-ghost" style={{ padding: 6, color: "var(--text-secondary)" }} data-testid="messages-attach">
                <Paperclip size={18} />
              </button>
              <div style={{
                flex: 1, display: "flex", alignItems: "center",
                background: "var(--bg-tertiary)", borderRadius: 22, padding: "0 14px",
                border: "1px solid var(--border-light)",
              }}>
                <input
                  style={{
                    border: "none", background: "transparent", outline: "none",
                    fontSize: 14, color: "var(--text-primary)", width: "100%", padding: "10px 0",
                  }}
                  placeholder={`Message ${active.name}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  data-testid="messages-input"
                />
              </div>
              <button
                onClick={send}
                disabled={!input.trim()}
                data-testid="messages-send-btn"
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: input.trim() ? "var(--mac-blue)" : "var(--bg-tertiary)",
                  color: input.trim() ? "#fff" : "var(--text-tertiary)",
                  cursor: input.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                <Send size={16} style={{ transform: "rotate(-45deg)", marginLeft: 2, marginTop: -1 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
