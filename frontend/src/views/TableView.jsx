import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import RoundTableViz from "../components/rt/RoundTableViz";
import EmptyState from "../components/rt/EmptyState";
import HelpTip from "../components/rt/HelpTip";
import { Share2, UploadCloud, Video, Users, Calendar, Send, FileText, Image, MessageSquare, HeartHandshake, Armchair, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useRTEvent } from "../lib/realtime";
import SmartSuggestions from "../components/SmartSuggestions";
import PrayerWall from "../components/PrayerWall";
import FileViewerModal from "../components/modals/FileViewerModal";

export default function TableView({ onShare, onInvite, onVideoCall }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [table, setTable] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("table");
  const [viewingItem, setViewingItem] = useState(null);
  const [incomingPresentation, setIncomingPresentation] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tables/${id}`);
      setTable(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/messages?table_id=${id}`);
      setMessages(data || []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    load();
    loadMessages();
    // Reduced polling — WS handles realtime
    const int = setInterval(loadMessages, 30000);
    return () => clearInterval(int);
  }, [load, loadMessages]);

  // Live updates
  useRTEvent((evt) => {
    if (!evt) return;
    if (evt.type === "message" && evt.message?.table_id === id) {
      setMessages((prev) => prev.some((m) => m.id === evt.message.id) ? prev : [...prev, evt.message]);
    }
    if (evt.type === "item_added" && evt.table_id === id) {
      load();
    }
    if (evt.type === "presence" || evt.type === "user_updated") {
      load();
    }
    if (evt.type === "present_start" && evt.table_id === id) {
      // Someone is presenting a file — open the viewer
      const presentItem = { id: evt.item_id, name: evt.item_name, url: evt.item_url, mime_type: evt.item_mime, shared_by_name: "Presenter" };
      setIncomingPresentation(presentItem);
      setViewingItem(presentItem);
      toast.info(`Someone is presenting "${evt.item_name}"`);
    }
    if (evt.type === "present_stop" && evt.table_id === id) {
      setIncomingPresentation(null);
      toast.info("Presentation ended");
    }
  }, [id, load]);

  const sendMessage = async () => {
    if (!msgText.trim() || !table) return;
    setBusy(true);
    try {
      const other = (table.members || []).find((m) => m.id !== user.id);
      await api.post("/messages", { to_user: other?.id || user.id, text: msgText.trim(), table_id: id });
      setMsgText("");
      loadMessages();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!table) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading table…</div>;
  }

  const live = table.active;
  const today = new Date().toISOString().slice(0, 10);
  const prayerCount = (table.items || []).filter((it) => it.type === "prayer" || it.type === "intention").length;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <HelpTip section="table" text="This is your table. Members sit around it, shared items appear on it. Live tables glow." />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{table.name}</h1>
            <span className={`badge ${live ? "green" : ""}`}>
              {live && <span className="live-badge-dot" />}
              {live ? "LIVE" : "DORMANT"}
            </span>
          </div>
          <div className="text-mute" style={{ fontSize: 13, marginTop: 4 }}>
            {table.member_count} member{table.member_count !== 1 ? "s" : ""} · {table.active_count} online · {table.items?.length || 0} shared item{table.items?.length === 1 ? "" : "s"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onInvite?.(table)} data-testid="table-invite-btn"><Users size={14} /> Invite</button>
          <button className="btn btn-secondary" onClick={() => onVideoCall?.(table.members?.find((m) => m.id !== user.id))} data-testid="table-video-btn"><Video size={14} /> Video Call</button>
          <button className="btn btn-primary" onClick={() => onShare?.(table)} data-testid="table-share-btn"><UploadCloud size={14} /> Share</button>
        </div>
      </div>

      {/* Table tabs */}
      <div className="tabs" style={{ marginBottom: 14, paddingLeft: 0 }}>
        <div className={`tab ${tab === "table" ? "active" : ""}`} onClick={() => setTab("table")} data-testid="tab-table">
          <Armchair size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> The Table
        </div>
        <div className={`tab ${tab === "prayers" ? "active" : ""}`} onClick={() => setTab("prayers")} data-testid="tab-prayers">
          <HeartHandshake size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Prayer Wall
          {prayerCount > 0 && <span className="tab-badge" style={{ background: "var(--mac-purple)" }}>{prayerCount}</span>}
        </div>
      </div>

      {tab === "prayers" ? (
        <PrayerWall tableId={id} onShare={() => onShare?.(table)} />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 14 }} className="table-grid-2col">
        {/* Left: Round Table viz */}
        <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 560, position: "relative" }}>
          <RoundTableViz table={table} />
        </div>

        {/* Right: Table-scoped panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={14} color="var(--mac-blue)" /> Members
            </div>
            {(table.members || []).map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div className="avatar" style={{ width: 32, height: 32, background: m.color, fontSize: 12 }}>{m.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "capitalize" }}>{m.status}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} color="var(--mac-green)" /> Shared Items
            </div>
            {(!table.items || table.items.length === 0) ? (
              <EmptyState icon={<UploadCloud size={28} />} title="This table is empty" subtitle="Share something to get it started." action={<button className="btn btn-primary" onClick={() => onShare?.(table)} data-testid="table-items-empty-share">Share Item</button>} testId="table-items-empty" />
            ) : table.items.slice(0, 6).map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)", cursor: it.url ? "pointer" : "default" }} onClick={() => it.url && setViewingItem(it)} data-testid={`table-item-${it.id}`}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: table.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {it.type === "photo" ? <Image size={14} /> : <FileText size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>shared by {it.shared_by_name}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={14} color="var(--mac-orange)" /> Upcoming Events
            </div>
            {(!table.events || table.events.length === 0) ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No events scheduled.</div>
            ) : table.events.filter((e) => e.date >= today).slice(0, 4).map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ width: 4, height: 30, background: e.color || table.color, borderRadius: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {e.title}
                    {e.recurring && e.recurring !== "none" && (
                      <span className="badge" style={{ fontSize: 9, padding: "1px 6px" }}>↻ {e.recurring}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{e.date} · {e.time}</div>
                </div>
              </div>
            ))}
          </div>

          <SmartSuggestions tableId={id} onAdded={load} />

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <MessageSquare size={14} color="var(--mac-purple)" /> Table Chat
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 4 }}>
              {messages.length === 0 && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No messages yet.</div>}
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.from_user === user.id ? "me" : "them"}`} data-testid={`table-msg-${m.id}`}>
                  {m.from_user !== user.id && <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>{m.from_name}</div>}
                  {m.text}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                className="input"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Say something at this table…"
                data-testid="table-chat-input"
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={busy} data-testid="table-chat-send"><Send size={14} /></button>
            </div>
          </div>
        </div>
      </div>
      )}

      {viewingItem && (
        <FileViewerModal
          item={viewingItem}
          tableId={id}
          isPresenting={!!incomingPresentation && incomingPresentation.id === viewingItem.id}
          onClose={() => { setViewingItem(null); setIncomingPresentation(null); }}
        />
      )}
    </div>
  );
}
