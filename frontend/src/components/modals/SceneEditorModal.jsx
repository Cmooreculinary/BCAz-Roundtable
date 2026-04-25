import React, { useState } from "react";
import { X, Settings2, Check } from "lucide-react";
import { ROOMS, TABLES, TABLETOPS, FOODS, AMBIANCES, MUSICS, DEFAULT_SCENE, SEAT_COUNTS } from "../../lib/scenes";

/**
 * SceneEditor — controlled form. Used inline inside CreateTableModal.
 * Emits changes immediately via onChange. No save button (parent controls submit).
 */
export function SceneEditor({ value, onChange }) {
  const scene = value || DEFAULT_SCENE;
  const update = (key, val) => onChange?.({ ...scene, [key]: val });
  const seatCount = SEAT_COUNTS[scene.table] || 8;

  return (
    <div data-testid="scene-editor">
      <ScenePreview scene={scene} seatCount={seatCount} />

      <Section title="Room">
        <Grid>
          {ROOMS.map((r) => (
            <Card
              key={r.id}
              selected={scene.room === r.id}
              onClick={() => update("room", r.id)}
              testId={`scene-room-${r.id}`}
              style={{ height: 72, background: r.gradient, padding: 10, alignItems: "flex-end", display: "flex" }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{r.name}</span>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title={`Table — ${seatCount} seats`}>
        <Grid>
          {TABLES.map((t) => (
            <Card
              key={t.id}
              selected={scene.table === t.id}
              onClick={() => update("table", t.id)}
              testId={`scene-table-${t.id}`}
              style={{ height: 64, background: t.wood, padding: 10, alignItems: "center", justifyContent: "center", display: "flex" }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: t.id === "luncheon" ? "#222" : "#fff", textShadow: t.id === "luncheon" ? "none" : "0 1px 3px rgba(0,0,0,0.4)" }}>
                {t.name} <span style={{ opacity: 0.7 }}>({SEAT_COUNTS[t.id]} seats)</span>
              </span>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title="Tabletop">
        <Grid>
          {TABLETOPS.map((tt) => (
            <Card
              key={tt.id}
              selected={scene.tabletop === tt.id}
              onClick={() => update("tabletop", tt.id)}
              testId={`scene-tabletop-${tt.id}`}
              style={{ padding: 10, textAlign: "center" }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{tt.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{tt.name}</div>
            </Card>
          ))}
        </Grid>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
        <PillSection title="Food & Beverage" items={FOODS} value={scene.food} onChange={(v) => update("food", v)} testPrefix="scene-food" />
        <PillSection title="Ambiance" items={AMBIANCES} value={scene.ambiance} onChange={(v) => update("ambiance", v)} testPrefix="scene-ambiance" showDot />
        <PillSection title="Music" items={MUSICS} value={scene.music} onChange={(v) => update("music", v)} testPrefix="scene-music" />
      </div>
    </div>
  );
}

/**
 * SceneEditorModal — full-screen modal with own state + save button.
 * Used by TableView for "Edit scene".
 */
export default function SceneEditorModal({ initial, onSave, onClose }) {
  const [scene, setScene] = useState({ ...DEFAULT_SCENE, ...(initial || {}) });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave?.(scene);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="scene-editor-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "92vw", maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ padding: 18, borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="avatar" style={{ width: 36, height: 36, background: "var(--mac-blue)", borderRadius: 10 }}>
              <Settings2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Customize Scene</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Choose the room. Set the table. Shape the gathering.</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} data-testid="scene-editor-close"><X size={16} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <SceneEditor value={scene} onChange={setScene} />
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy} data-testid="scene-editor-save">
            <Check size={14} /> {busy ? "Saving…" : "Save Scene"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScenePreview({ scene, seatCount }) {
  const room = ROOMS.find((r) => r.id === scene.room) || ROOMS[0];
  const table = TABLES.find((t) => t.id === scene.table) || TABLES[0];
  const tabletop = TABLETOPS.find((tt) => tt.id === scene.tabletop) || TABLETOPS[0];
  const ambiance = AMBIANCES.find((a) => a.id === scene.ambiance) || AMBIANCES[0];
  return (
    <div data-testid="scene-preview" style={{
      borderRadius: 14, overflow: "hidden", marginBottom: 14, position: "relative",
      height: 130, background: room.gradient, border: "1px solid var(--border-light)",
    }}>
      <div style={{ position: "absolute", inset: 0, background: ambiance.overlay }} />
      <div style={{
        position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)",
        width: 90, height: 50, borderRadius: "50%", background: table.wood,
        boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 18 }}>{tabletop.icon}</span>
      </div>
      <div style={{
        position: "absolute", top: 10, left: 12, fontSize: 10, fontWeight: 700,
        color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      }}>
        {room.name} · {seatCount} seats
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>{children}</div>;
}
function Card({ selected, onClick, testId, style, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{
        borderRadius: 12, cursor: "pointer", overflow: "hidden",
        border: selected ? "2px solid var(--mac-blue)" : "1px solid var(--border-color)",
        background: "var(--bg-secondary)", padding: 0,
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s",
        transform: selected ? "scale(1.02)" : "scale(1)",
        ...style,
      }}>
      {children}
    </button>
  );
}
function PillSection({ title, items, value, onChange, testPrefix, showDot }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            data-testid={`${testPrefix}-${it.id}`}
            style={{
              padding: "7px 10px", borderRadius: 8, fontSize: 12, textAlign: "left",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              border: value === it.id ? "1px solid var(--mac-blue)" : "1px solid var(--border-color)",
              background: value === it.id ? "rgba(0,122,255,0.10)" : "var(--bg-secondary)",
              color: "var(--text-primary)", fontWeight: value === it.id ? 600 : 400,
              transition: "all 0.15s",
            }}>
            {showDot && it.color && <span style={{ width: 8, height: 8, borderRadius: 4, background: it.color }} />}
            {it.name}
          </button>
        ))}
      </div>
    </div>
  );
}
