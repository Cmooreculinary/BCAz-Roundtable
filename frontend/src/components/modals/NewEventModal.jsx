import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";

export default function NewEventModal({ tables = [], onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "", date: new Date().toISOString().slice(0, 10), time: "12:00",
    table_id: "", description: "", location: "", recurring: "none",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.table_id) delete payload.table_id;
      await api.post("/events", payload);
      toast.success("Event created");
      onCreated?.();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal" role="dialog" aria-modal="true" data-testid="new-event-modal">
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>New Event</div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <label style={lbl} htmlFor="new-event-title">Title</label>
          <input id="new-event-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="event-title" style={{ margin: "6px 0 10px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={lbl} htmlFor="new-event-date">Date</label>
              <input id="new-event-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="event-date" style={{ marginTop: 6 }} />
            </div>
            <div>
              <label style={lbl} htmlFor="new-event-time">Time</label>
              <input id="new-event-time" type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} data-testid="event-time" style={{ marginTop: 6 }} />
            </div>
          </div>
          <div style={lbl}>Repeats</div>
          <div style={{ display: "flex", gap: 6, margin: "8px 0 12px" }}>
            {[
              { k: "none", l: "Once" },
              { k: "weekly", l: "Weekly" },
              { k: "monthly", l: "Monthly" },
            ].map((r) => (
              <button
                key={r.k}
                onClick={() => setForm({ ...form, recurring: r.k })}
                data-testid={`event-recurring-${r.k}`}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  border: form.recurring === r.k ? "2px solid var(--mac-blue)" : "1px solid var(--border-color)",
                  background: form.recurring === r.k ? "rgba(0,122,255,0.1)" : "var(--bg-secondary)",
                  color: form.recurring === r.k ? "var(--mac-blue)" : "var(--text-primary)",
                }}>{r.l}</button>
            ))}
          </div>
          <label style={lbl} htmlFor="new-event-table">Table (optional)</label>
          <select id="new-event-table" className="input" value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })} data-testid="event-table" style={{ margin: "6px 0 10px" }}>
            <option value="">Personal event</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label style={lbl} htmlFor="new-event-location">Location (optional)</label>
          <input id="new-event-location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="event-location" style={{ margin: "6px 0 10px" }} />
          <label style={lbl} htmlFor="new-event-description">Description (optional)</label>
          <textarea id="new-event-description" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="event-description" style={{ margin: "6px 0 0", fontFamily: "inherit", resize: "vertical" }} />
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} data-testid="event-submit">{busy ? "Creating…" : "Create Event"}</button>
        </div>
      </div>
    </div>
  );
}
const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
