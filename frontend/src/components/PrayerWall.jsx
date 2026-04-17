import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { HeartHandshake, Sparkles, Heart, Hand, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useRTEvent } from "../lib/realtime";
import EmptyState from "./rt/EmptyState";
import { formatDistanceToNow } from "date-fns";

const REACTIONS = [
  { type: "praying", label: "Praying", icon: <HandHeart size={14} />, color: "#AF52DE" },
  { type: "amen", label: "Amen", icon: <Hand size={14} />, color: "#FF9500" },
  { type: "heart", label: "Heart", icon: <Heart size={14} />, color: "#FF3B30" },
  { type: "thanks", label: "Thanks", icon: <Sparkles size={14} />, color: "#FFCC00" },
];

export default function PrayerWall({ tableId, onShare }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tables/${tableId}/prayers`);
      setItems(data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tableId]);

  useEffect(() => { load(); }, [load]);

  useRTEvent((evt) => {
    if (evt?.type === "item_reaction" && evt.table_id === tableId) {
      setItems((prev) => prev.map((it) => it.id === evt.item_id ? { ...it, reactions: evt.reactions } : it));
    }
    if (evt?.type === "item_added" && evt.table_id === tableId) {
      const it = evt.item;
      if (it && (it.type === "prayer" || it.type === "intention")) {
        setItems((prev) => prev.some((x) => x.id === it.id) ? prev : [it, ...prev]);
      }
    }
  }, [tableId]);

  const react = async (item, type) => {
    try {
      const { data } = await api.post(`/tables/${tableId}/items/${item.id}/react`, { type });
      setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, reactions: data.reactions } : it));
      if (data.action === "added" && type === "praying") {
        toast.success("🙏 You're lifting them up");
      }
    } catch { toast.error("Couldn't save reaction"); }
  };

  const timeAgo = (iso) => { try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; } };

  if (loading) {
    return <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>Loading the wall…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <EmptyState
          icon={<HeartHandshake size={28} />}
          title="The wall is quiet"
          subtitle="Share a prayer request or an intention — the group will lift it up with you."
          action={<button className="btn btn-primary" onClick={onShare} data-testid="prayer-wall-empty-share">Share a Prayer</button>}
          testId="prayer-wall-empty"
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="prayer-wall">
      {items.map((it) => {
        const isPrayer = it.type === "prayer";
        const reactions = it.reactions || { praying: [], amen: [], heart: [], thanks: [] };
        return (
          <div key={it.id} className="card" style={{ padding: 14, borderLeft: `3px solid ${isPrayer ? "#AF52DE" : "#FFCC00"}` }} data-testid={`prayer-item-${it.id}`}>
            <div style={{ display: "flex", gap: 10, alignItems: "start" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: isPrayer ? "rgba(175,82,222,0.14)" : "rgba(255,204,0,0.18)",
                color: isPrayer ? "#AF52DE" : "#FFCC00",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {isPrayer ? <HeartHandshake size={16} /> : <Sparkles size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isPrayer ? "#AF52DE" : "#FFCC00", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {isPrayer ? "Prayer" : "Intention"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· by {it.shared_by_name} · {timeAgo(it.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{it.name}</div>
                {it.url && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{it.url}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {REACTIONS.map((r) => {
                const arr = reactions[r.type] || [];
                const on = arr.includes(user?.id);
                return (
                  <button
                    key={r.type}
                    onClick={() => react(it, r.type)}
                    data-testid={`prayer-react-${r.type}-${it.id}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      border: `1px solid ${on ? r.color : "var(--border-color)"}`,
                      background: on ? `${r.color}1e` : "var(--bg-secondary)",
                      color: on ? r.color : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}>
                    <span style={{ color: r.color }}>{r.icon}</span>
                    {r.label}
                    {arr.length > 0 && <span style={{ marginLeft: 2, fontVariantNumeric: "tabular-nums" }}>{arr.length}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
