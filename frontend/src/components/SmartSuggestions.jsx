import React, { useState } from "react";
import { api } from "../lib/api";
import { Sparkles, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function SmartSuggestions({ tableId, onAdded }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/tables/${tableId}/suggest-events`);
      setSuggestions(data.suggestions || []);
      if (!data.suggestions?.length) {
        toast.message("No AI suggestions available right now.");
      }
    } catch (e) {
      toast.error("Couldn't reach the suggestion helper.");
    } finally { setLoading(false); }
  };

  const addSuggestion = async (s) => {
    try {
      await api.post("/events", {
        title: s.title,
        date: s.date,
        time: s.time || "12:00",
        table_id: tableId,
        description: s.description || "",
        color: s.color,
      });
      toast.success(`Added "${s.title}" to the calendar`);
      setSuggestions((prev) => prev.filter((x) => x !== s));
      onAdded?.();
    } catch (err) {
      toast.error("Couldn't add event");
    }
  };

  return (
    <div className="card" style={{ padding: 14 }} data-testid="smart-suggestions">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <Sparkles size={14} color="var(--mac-purple)" /> Smart Suggestions
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading} data-testid="suggest-refresh" style={{ fontSize: 11, padding: "4px 10px" }}>
          {loading ? "Thinking…" : suggestions.length ? "Refresh" : "Ask Claude"}
        </button>
      </div>
      {suggestions.length === 0 && !loading && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Tap <b>Ask Claude</b> and I'll suggest 3 upcoming events tailored to this table's purpose.
        </div>
      )}
      {loading && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "10px 0" }}>
          <Sparkles size={12} className="rt-pulse" style={{ verticalAlign: -1, marginRight: 4 }} /> Tailoring ideas for this table…
        </div>
      )}
      {suggestions.map((s, i) => (
        <div key={s.title + s.date} style={{ padding: "10px 0", borderBottom: i < suggestions.length - 1 ? "1px solid var(--border-light)" : "none" }} data-testid={`suggest-item-${i}`}>
          <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color || "#AF52DE", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Calendar size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{s.date} · {s.time}</div>
              {s.description && <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4, lineHeight: 1.4 }}>{s.description}</div>}
              {s.reason && <div style={{ fontSize: 10, color: "var(--mac-purple)", marginTop: 4, fontStyle: "italic" }}>✨ {s.reason}</div>}
            </div>
            <button className="btn btn-primary" onClick={() => addSuggestion(s)} data-testid={`suggest-add-${i}`} style={{ padding: "6px 10px", fontSize: 11 }}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
