import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Search, Send, Video, Radio } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import EmptyState from "../components/rt/EmptyState";
import { toast } from "sonner";
import { useRTEvent } from "../lib/realtime";
import UserAvatar from "../components/UserAvatar";

export default function MessagesView({ onVideoCall }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => { api.get("/members").then((r) => setMembers(r.data || [])); }, []);

  const open = async (m) => {
    setActive(m);
    const { data } = await api.get(`/messages?with=${m.id}`);
    setMessages(data || []);
  };

  const send = async () => {
    if (!input.trim() || !active) return;
    await api.post("/messages", { to_user: active.id, text: input.trim() });
    setInput("");
    open(active);
  };

  // Live: append messages from the active conversation as they arrive
  useRTEvent((evt) => {
    if (evt?.type !== "message" || !active) return;
    const m = evt.message;
    if (!m) return;
    const fromActive = m.from_user === active.id && m.to_user === user?.id;
    const toActive = m.from_user === user?.id && m.to_user === active.id;
    if (fromActive || toActive) {
      setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
    }
  }, [active, user]);

  const ping = async () => {
    if (!active) return;
    await api.post("/walkie/ping", { to_user: active.id });
    toast.success(`Pinged ${active.name}`);
  };

  const filtered = members.filter((m) => m.id !== user?.id && (m.name || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.02em" }}>Messages</h1>
      <div className="card" style={{ padding: 0, display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 560, overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid var(--border-light)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={13} color="var(--text-tertiary)" />
            <input className="input" style={{ border: "none", background: "transparent", padding: 2 }} placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="messages-search" />
          </div>
          <div style={{ overflowY: "auto" }}>
            {filtered.map((m) => (
              <div key={m.id} onClick={() => open(m)} data-testid={`messages-person-${m.id}`} style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: "1px solid var(--border-light)", background: active?.id === m.id ? "var(--bg-tertiary)" : "transparent" }}>
                <div style={{ position: "relative" }}>
                  <UserAvatar user={m} size={34} />
                  {m.status === "online" && <span style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "var(--mac-green)", border: "2px solid var(--bg-secondary)" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "capitalize" }}>{m.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 560 }}>
          {!active ? (
            <EmptyState title="Select a conversation" subtitle="Pick someone from the list to start chatting." testId="messages-empty" />
          ) : (
            <>
              <div style={{ padding: 12, borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10 }}>
                <UserAvatar user={active} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>{active.status}</div>
                </div>
                <button className="btn btn-secondary" onClick={ping} data-testid="messages-walkie-btn"><Radio size={13} /></button>
                <button className="btn btn-secondary" onClick={() => onVideoCall?.(active)} data-testid="messages-video-btn"><Video size={13} /></button>
              </div>
              <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {messages.length === 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Start a conversation.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.from_user === user?.id ? "me" : "them"}`}>
                    {m.text}
                    {m.from_user === user?.id && (
                      <div style={{ fontSize: 9, opacity: 0.5, textAlign: "right", marginTop: 2 }}>
                        {m.read ? "Read" : "Sent"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: 10, borderTop: "1px solid var(--border-light)", display: "flex", gap: 6 }}>
                <input className="input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a message…" data-testid="messages-input" />
                <button className="btn btn-primary" onClick={send} data-testid="messages-send-btn"><Send size={14} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
