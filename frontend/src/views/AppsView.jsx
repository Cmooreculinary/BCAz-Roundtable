import React, { useState } from "react";
import { Mail, Calendar, FileText, MessageSquare, Video, Cloud, Map, Camera, Music, FileSpreadsheet, Presentation, Film, Clock } from "lucide-react";

const APPS = [
  { name: "Mail", vendor: "apple", icon: <Mail size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #5AC8FA 0%, #007AFF 100%)" },
  { name: "Calendar", vendor: "apple", icon: <Calendar size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FF3B30 0%, #FF9500 100%)" },
  { name: "Notes", vendor: "apple", icon: <FileText size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FFCC00 0%, #FF9500 100%)" },
  { name: "Messages", vendor: "apple", icon: <MessageSquare size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #34C759 0%, #5AC8FA 100%)" },
  { name: "FaceTime", vendor: "apple", icon: <Video size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #34C759 0%, #007AFF 100%)" },
  { name: "iCloud", vendor: "apple", icon: <Cloud size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #5AC8FA 0%, #AF52DE 100%)" },
  { name: "Maps", vendor: "apple", icon: <Map size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #34C759 0%, #5AC8FA 100%)" },
  { name: "Photos", vendor: "apple", icon: <Camera size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FF9500 0%, #FF2D55 100%)" },
  { name: "Gmail", vendor: "google", icon: <Mail size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #EA4335 0%, #FBBC05 100%)" },
  { name: "Drive", vendor: "google", icon: <Cloud size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #4285F4 0%, #34A853 100%)" },
  { name: "Docs", vendor: "google", icon: <FileText size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #4285F4 0%, #34A853 100%)" },
  { name: "Sheets", vendor: "google", icon: <FileSpreadsheet size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #34A853 0%, #0F9D58 100%)" },
  { name: "Slides", vendor: "google", icon: <Presentation size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FBBC05 0%, #EA4335 100%)" },
  { name: "Meet", vendor: "google", icon: <Video size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #00AC47 0%, #4285F4 100%)" },
  { name: "Calendar", vendor: "google", icon: <Calendar size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #4285F4 0%, #34A853 100%)" },
  { name: "YouTube", vendor: "google", icon: <Film size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FF0000 0%, #CC0000 100%)" },
  { name: "Outlook", vendor: "microsoft", icon: <Mail size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #0078D4 0%, #00BCF2 100%)" },
  { name: "Word", vendor: "microsoft", icon: <FileText size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #2B579A 0%, #41729F 100%)" },
  { name: "Excel", vendor: "microsoft", icon: <FileSpreadsheet size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #217346 0%, #2E9C5D 100%)" },
  { name: "PowerPoint", vendor: "microsoft", icon: <Presentation size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #D24726 0%, #E6693E 100%)" },
  { name: "Teams", vendor: "microsoft", icon: <MessageSquare size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #6264A7 0%, #464EB8 100%)" },
  { name: "OneDrive", vendor: "microsoft", icon: <Cloud size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #0078D4 0%, #4A90E2 100%)" },
  { name: "Music", vendor: "apple", icon: <Music size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #FF2D55 0%, #AF52DE 100%)" },
  { name: "Clock", vendor: "apple", icon: <Clock size={28} strokeWidth={1.75} />, bg: "linear-gradient(145deg, #3A3A3C 0%, #1C1C1E 100%)" },
];

export default function AppsView() {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? APPS : APPS.filter((a) => a.vendor === filter);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="audit-page-header" style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>Apps</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>Integration catalog. Connections preview only.</div>
        </div>
        <div className="audit-action-group" aria-label="Filter app catalog" style={{ display: "flex", gap: 6 }}>
          {["all", "apple", "google", "microsoft"].map((f) => (
            <button
              key={f}
              type="button"
              className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter(f)}
              data-testid={`apps-filter-${f}`}
              aria-pressed={filter === f}
              style={{ textTransform: "capitalize", minWidth: 72 }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        role="list"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
          gap: 16,
        }}
      >
        {shown.map((a, i) => (
          <div
            key={`${a.name}-${a.vendor}-${i}`}
            role="listitem"
            aria-disabled="true"
            className="app-tile"
            data-testid={`app-${a.name}-${a.vendor}`}
            style={{
              position: "relative",
              padding: "18px 12px 14px",
              textAlign: "center",
              borderRadius: 16,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-sm)",
              cursor: "default",
              transition: "transform 0.25s var(--spring), box-shadow 0.25s var(--spring), border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px) scale(1.03)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              e.currentTarget.style.borderColor = "var(--border-light)";
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              Preview
            </span>

            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: a.bg,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {a.icon}
            </div>

            <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em" }}>{a.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize", marginTop: 2 }}>
              {a.vendor}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
