import React from "react";
import { Home, Calendar, MessageSquare, Grid3x3, Users, Plus, Radio, PhoneCall } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import UserAvatar from "../UserAvatar";

export default function Sidebar({ tables = [], activeTableId, currentPath, onNav, onSelectTable, onCreateTable, mobileOpen = false, onMobileClose }) {
  const { user } = useAuth();

  const navItems = [
    { key: "/", label: "My Portal", icon: <Home size={15} /> },
    { key: "/calendar", label: "Calendar", icon: <Calendar size={15} /> },
    { key: "/messages", label: "Messages", icon: <MessageSquare size={15} /> },
    { key: "/walkie", label: "Walkie Talkie", icon: <Radio size={15} /> },
    { key: "/call-history", label: "Call History", icon: <PhoneCall size={15} /> },
    { key: "/apps", label: "Apps", icon: <Grid3x3 size={15} /> },
    { key: "/contacts", label: "Contacts", icon: <Users size={15} /> },
  ];

  const isActive = (path) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} data-testid="sidebar">
      <div className="sb-label">Navigation</div>
      {navItems.map((it) => (
        <div
          key={it.key}
          className={`sb-item ${isActive(it.key) ? "active" : ""}`}
          onClick={() => onNav(it.key)}
          data-testid={`sb-nav-${it.key.replace("/", "") || "home"}`}
        >
          <span className="sb-icon">{it.icon}</span>
          {it.label}
        </div>
      ))}

      <div className="sb-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Round Tables
        <button className="btn btn-ghost" onClick={onCreateTable} title="Create table" data-testid="sb-create-table-btn" style={{ padding: 2 }}>
          <Plus size={14} />
        </button>
      </div>

      {tables.length === 0 && (
        <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--text-tertiary)" }}>
          No tables yet. Click + to start.
        </div>
      )}

      {tables.map((t) => {
        const active = activeTableId === t.id && currentPath.startsWith("/table");
        return (
          <div
            key={t.id}
            className={`sb-table-item ${t.active ? "" : "dormant"} ${active ? "active" : ""}`}
            onClick={() => onSelectTable(t.id)}
            data-testid={`sb-table-${t.id}`}
          >
            {t.active && <span className="sb-table-bar" />}
            <span className={`sb-table-dot ${t.active ? "" : "dormant"}`} style={{ background: t.active ? "var(--mac-green)" : "var(--mac-gray)" }} />
            <span className="sb-table-name" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            {t.active && <span style={{ fontSize: 10, color: active ? "#fff" : "var(--mac-green)", fontWeight: 600 }}>{t.active_count} on</span>}
          </div>
        );
      })}

      <div style={{ marginTop: "auto", padding: "12px 10px 8px", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10 }}>
        {user && (
          <>
            <UserAvatar user={user} size={32} style={{ position: "relative" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "var(--mac-green)" }}>Online</div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
