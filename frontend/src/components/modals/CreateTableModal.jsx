import React, { useState } from "react";
import { X, Armchair, Home, BookOpen, Heart, Sparkles, Briefcase, Users, Settings2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { DEFAULT_SCENE } from "../../lib/scenes";
import { SceneEditor } from "./SceneEditorModal";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#FFCC00", "#5AC8FA"];

const PURPOSES = [
  { key: "family", label: "Family", icon: <Home size={18} />, color: "#FF9500", hint: "Shared meals, birthdays, game nights" },
  { key: "bible_study", label: "Bible Study", icon: <BookOpen size={18} />, color: "#AF52DE", hint: "Weekly studies, prayer, fellowship" },
  { key: "community", label: "Community", icon: <Heart size={18} />, color: "#34C759", hint: "Neighborhood, potlucks, help projects" },
  { key: "friends", label: "Friends", icon: <Sparkles size={18} />, color: "#5AC8FA", hint: "Hangouts, trips, dinners" },
  { key: "work", label: "Work", icon: <Briefcase size={18} />, color: "#007AFF", hint: "Projects, syncs, planning" },
  { key: "other", label: "Other", icon: <Users size={18} />, color: "#8E8E93", hint: "Any gathering" },
];

export default function CreateTableModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#007AFF");
  const [active, setActive] = useState(true);
  const [purpose, setPurpose] = useState("family");
  const [busy, setBusy] = useState(false);
  const [scene, setScene] = useState({ ...DEFAULT_SCENE });

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      const { data } = await api.post("/tables", { name: name.trim(), color, active, purpose, scene });
      toast.success(`Table "${data.name}" created`);
      onCreated?.(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-table-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="create-table-modal"
        style={{ maxWidth: 1080, maxHeight: "94vh", overflowY: "auto", borderRadius: 18 }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="avatar"
              style={{
                width: 42,
                height: 42,
                background: color,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 6px 16px ${color}40`,
              }}
            >
              <Armchair size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Create a table</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 1 }}>A space for your people to gather.</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} data-testid="create-table-close" style={{ borderRadius: 10 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 22px 10px" }}>
          {/* Purpose */}
          <label style={lbl}>What's this table for?</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "10px 0 18px" }}>
            {PURPOSES.map((p) => {
              const selected = purpose === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPurpose(p.key)}
                  data-testid={`create-purpose-${p.key}`}
                  title={p.hint}
                  style={{
                    padding: "12px 8px",
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    border: selected ? `2px solid ${p.color}` : "1px solid var(--border-color)",
                    background: selected ? `${p.color}18` : "var(--bg-secondary)",
                    color: p.color,
                    fontSize: 12,
                    fontWeight: 650,
                    transition: "transform 0.2s var(--spring), box-shadow 0.2s, border-color 0.15s",
                    boxShadow: selected ? `0 4px 14px ${p.color}30` : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {p.icon}
                  <span style={{ color: "var(--text-primary)" }}>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Name */}
          <label style={lbl}>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={PURPOSES.find((p) => p.key === purpose)?.hint || "Family Circle, Project Team…"}
            maxLength={80}
            data-testid="create-table-name"
            style={{ margin: "8px 0 18px", fontSize: 14, padding: "11px 14px" }}
          />

          {/* Color */}
          <label style={lbl}>Accent color</label>
          <div style={{ display: "flex", gap: 10, margin: "10px 0 18px", flexWrap: "wrap" }}>
            {COLORS.map((c) => {
              const selected = color === c;
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  data-testid={`create-table-color-${c.replace("#", "")}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: c,
                    cursor: "pointer",
                    border: selected ? "3px solid var(--text-primary)" : "2px solid transparent",
                    boxShadow: selected ? `0 0 0 2px ${c}55, 0 4px 12px ${c}40` : "0 2px 6px rgba(0,0,0,0.12)",
                    transition: "transform 0.2s var(--spring)",
                    transform: selected ? "scale(1.12)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>

          {/* Live toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13.5,
              cursor: "pointer",
              marginBottom: 18,
              padding: "10px 12px",
              borderRadius: 10,
              background: active ? "rgba(52,199,89,0.08)" : "var(--bg-secondary)",
              border: `1px solid ${active ? "rgba(52,199,89,0.25)" : "var(--border-color)"}`,
            }}
          >
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="create-table-active" />
            <span style={{ fontWeight: 500 }}>Make this table live right now</span>
          </label>

          {/* Scene section */}
          <div
            data-testid="create-table-scene-toggle"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              fontSize: 13.5,
              fontWeight: 650,
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            <Settings2 size={16} color="var(--mac-blue)" />
            <span style={{ flex: 1, textAlign: "left" }}>Choose the room and table</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>
              {scene.room === DEFAULT_SCENE.room && scene.table === DEFAULT_SCENE.table ? "Defaults" : "Customized"}
            </span>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 14,
              border: "1px solid var(--border-light)",
              background: "var(--bg-tertiary)",
            }}
          >
            <SceneEditor value={scene} onChange={setScene} />
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              This room, table, seat count, service, and atmosphere will open with the new table.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 22px",
            borderTop: "1px solid var(--border-light)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-secondary)",
          }}
        >
          <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 90 }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            data-testid="create-table-submit"
            style={{ minWidth: 130, fontWeight: 600 }}
          >
            {busy ? "Creating…" : "Create Table"}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 11,
  fontWeight: 650,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};
