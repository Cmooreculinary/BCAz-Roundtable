import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { Mail, Send, Star, Inbox, Trash2, MessageSquare, Radio, X, Reply } from "lucide-react";
import EmptyState from "../components/rt/EmptyState";
import HelpTip from "../components/rt/HelpTip";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import UserAvatar from "../components/UserAvatar";
import logger from "../lib/logger";

export default function Communications({ tables, onVideoCall }) {
  const [tab, setTab] = useState("email");
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <HelpTip section="email" text="Your inbox, right here. No need to switch to another app." />
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Communications</h1>
      </div>
      <div className="card" style={{ padding: 0, minHeight: 560, overflow: "hidden" }}>
        <div className="tabs">
          <div className={`tab ${tab === "email" ? "active" : ""}`} onClick={() => setTab("email")} data-testid="hub-tab-email"><Mail size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Email</div>
          <div className={`tab ${tab === "texts" ? "active" : ""}`} onClick={() => setTab("texts")} data-testid="hub-tab-texts"><MessageSquare size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Texts</div>
          <div className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")} data-testid="hub-tab-chat"><Send size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Chat</div>
          <div className={`tab ${tab === "walkie" ? "active" : ""}`} onClick={() => setTab("walkie")} data-testid="hub-tab-walkie"><Radio size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Walkie</div>
        </div>
        {tab === "email" && <EmailPane />}
        {tab === "texts" && <TextsPane />}
        {tab === "chat" && <ChatPane />}
        {tab === "walkie" && <WalkiePreview onVideoCall={onVideoCall} />}
      </div>
    </div>
  );
}

function EmailPane() {
  const { user } = useAuth();
  const [folder, setFolder] = useState("inbox");
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ to_user: "", subject: "", body: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/emails?folder=${folder}`);
      setEmails(data || []);
    } catch (err) {
      logger.error("Failed to load emails:", err);
    }
  }, [folder]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/members").then((r) => setMembers(r.data || [])).catch((err) => logger.error("Failed to load members:", err)); }, []);

  const filteredMembers = useMemo(() => members.filter((m) => m.id !== user?.id), [members, user?.id]);

  const open = async (e) => {
    setSelected(e);
    if (!e.read) { await api.post(`/emails/${e.id}/read`); load(); }
  };

  const toggleStar = async (e) => {
    await api.post(`/emails/${e.id}/star`);
    load();
    if (selected?.id === e.id) setSelected({ ...selected, starred: !selected.starred });
  };

  const send = async () => {
    if (!form.to_user || !form.subject || !form.body) return toast.error("Fill all fields");
    try {
      await api.post("/emails", form);
      toast.success("Sent");
      setComposing(false); setForm({ to_user: "", subject: "", body: "" }); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 520 }}>
      <div style={{ borderRight: "1px solid var(--border-light)", overflowY: "auto" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
          {["inbox", "sent", "starred", "trash"].map((f) => (
            <button key={f} className={`tab ${folder === f ? "active" : ""}`} onClick={() => { setFolder(f); setSelected(null); }} data-testid={`email-folder-${f}`} style={{ flex: 1, fontSize: 10, padding: "8px 4px" }}>
              {f === "inbox" && <Inbox size={11} style={{ marginRight: 2, verticalAlign: -1 }} />}
              {f === "starred" && <Star size={11} style={{ marginRight: 2, verticalAlign: -1 }} />}
              {f === "trash" && <Trash2 size={11} style={{ marginRight: 2, verticalAlign: -1 }} />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ padding: 8 }}>
          <button className="btn btn-primary" onClick={() => setComposing(true)} style={{ width: "100%", fontSize: 11 }} data-testid="email-compose-btn"><Mail size={13} /> Compose</button>
        </div>
        {emails.map((e) => (
          <div key={e.id} onClick={() => open(e)} data-testid={`email-item-${e.id}`} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", background: selected?.id === e.id ? "var(--bg-tertiary)" : "transparent", opacity: e.read ? 0.7 : 1 }}>
            <div style={{ fontSize: 12, fontWeight: e.read ? 400 : 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{e.from_name}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 18, overflowY: "auto" }}>
        {composing ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>New Email</div>
              <button className="btn btn-ghost" onClick={() => setComposing(false)}><X size={14} /></button>
            </div>
            <label style={lbl}>To</label>
            <select className="input" value={form.to_user} onChange={(e) => setForm({ ...form, to_user: e.target.value })} data-testid="email-to-select" style={{ margin: "6px 0 10px" }}>
              <option value="">Select member…</option>
              {filteredMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <label style={lbl}>Subject</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="email-subject-input" style={{ margin: "6px 0 10px" }} />
            <label style={lbl}>Body</label>
            <textarea className="input" rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="email-body-input" style={{ margin: "6px 0 14px", fontFamily: "inherit", resize: "vertical" }} />
            <button className="btn btn-primary" onClick={send} data-testid="email-send-btn">Send</button>
          </div>
        ) : selected ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.subject}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" onClick={() => toggleStar(selected)} data-testid="email-star-btn">
                  <Star size={14} fill={selected.starred ? "var(--mac-yellow)" : "none"} color={selected.starred ? "var(--mac-yellow)" : "currentColor"} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-light)", marginBottom: 14 }}>
              <div className="avatar" style={{ width: 34, height: 34, background: "var(--mac-blue)", fontSize: 12 }}>{selected.from_initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.from_name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>to {selected.to_name}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{selected.body}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setComposing(true); setSelected(null); setForm({ to_user: selected.from_user, subject: `Re: ${selected.subject}`, body: `\n\n> ${selected.body}` }); }} data-testid="email-reply-btn"><Reply size={13} /> Reply</button>
              <button className="btn btn-secondary" onClick={async () => { await api.delete(`/emails/${selected.id}`); toast.success("Email trashed"); setSelected(null); load(); }} data-testid="email-delete-btn" style={{ color: "var(--mac-red)" }}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Mail size={28} />} title="Select an email" subtitle="Click an email from the list to read it." testId="email-no-selection" />
        )}
      </div>
    </div>
  );
}

function TextsPane() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [target, setTarget] = useState(null);
  const [thread, setThread] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => { api.get("/members").then((r) => setMembers(r.data || [])).catch((err) => logger.error("Failed to load members:", err)); }, []);

  const filteredMembers = useMemo(() => members.filter((m) => m.id !== user?.id), [members, user?.id]);

  const loadThread = async (t) => {
    setTarget(t);
    const { data } = await api.get(`/texts?with=${t.id}`);
    setThread(data || []);
  };

  const send = async () => {
    if (!input.trim() || !target) return;
    await api.post("/texts", { to_user: target.id, text: input.trim() });
    setInput("");
    loadThread(target);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 520 }}>
      <div style={{ borderRight: "1px solid var(--border-light)", overflowY: "auto" }}>
        <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Contacts</div>
        {filteredMembers.map((m) => (
          <div key={m.id} onClick={() => loadThread(m)} data-testid={`texts-contact-${m.id}`} style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: target?.id === m.id ? "var(--bg-tertiary)" : "transparent", borderBottom: "1px solid var(--border-light)" }}>
            <UserAvatar user={m} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>SMS</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
        {!target ? (
          <EmptyState icon={<MessageSquare size={28} />} title="No conversation selected" subtitle="Pick a contact to start texting." testId="texts-empty" />
        ) : (
          <>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", fontSize: 13, fontWeight: 600 }}>{target.name}</div>
            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              {thread.length === 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No messages yet.</div>}
              {thread.map((m) => (
                <div key={m.id} className={`bubble ${m.from_user === user?.id ? "me" : "them"}`}>
                  {m.text}
                  {m.from_user === user?.id && (
                    <div style={{ fontSize: 9, opacity: 0.5, textAlign: "right", marginTop: 2 }}>{m.read ? "Read" : "Sent"}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid var(--border-light)", display: "flex", gap: 6 }}>
              <input className="input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" data-testid="texts-input" />
              <button className="btn btn-primary" onClick={send} data-testid="texts-send-btn"><Send size={14} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChatPane() {
  return (
    <div style={{ padding: 30 }}>
      <EmptyState icon={<Send size={28} />} title="Team chat" subtitle="Open Messages for full-screen chat conversations." testId="chat-preview-empty" />
    </div>
  );
}

function WalkiePreview({ onVideoCall }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  useEffect(() => { api.get("/members").then((r) => setMembers(r.data || [])).catch((err) => logger.error("Failed to load members:", err)); }, []);

  const onlineMembers = useMemo(() => members.filter((m) => m.status === "online" && m.id !== user?.id), [members, user?.id]);

  const ping = async (m) => {
    try { await api.post("/walkie/ping", { to_user: m.id }); toast.success(`Pinged ${m.name}`); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
  };
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>Online members available on the walkie:</div>
      {onlineMembers.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
          <UserAvatar user={m} size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 10, color: "var(--mac-green)" }}>Online</div>
          </div>
          <button className="btn btn-secondary" onClick={() => ping(m)} data-testid={`walkie-ping-${m.id}`}><Radio size={13} /> Talk</button>
          <button className="btn btn-secondary" onClick={() => onVideoCall?.(m)} data-testid={`walkie-video-${m.id}`}>Video</button>
        </div>
      ))}
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
