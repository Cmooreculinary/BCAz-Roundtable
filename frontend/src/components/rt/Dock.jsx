import React from "react";
import { Home, Calendar, MessageSquare, Radio, Users, Grid3x3, Mail, Share2, Bell, PhoneCall } from "lucide-react";

const items = [
  { key: "/", label: "Portal", icon: <Home size={22} />, bg: "linear-gradient(135deg, #007AFF, #5AC8FA)" },
  { key: "/messages", label: "Messages", icon: <MessageSquare size={22} />, bg: "linear-gradient(135deg, #34C759, #5AC8FA)" },
  { key: "/communications", label: "Email", icon: <Mail size={22} />, bg: "linear-gradient(135deg, #AF52DE, #FF2D55)" },
  { key: "/walkie", label: "Walkie", icon: <Radio size={22} />, bg: "linear-gradient(135deg, #FF9500, #FF3B30)" },
  { key: "/call-history", label: "Calls", icon: <PhoneCall size={22} />, bg: "linear-gradient(135deg, #34C759, #30D158)" },
  { key: "/calendar", label: "Calendar", icon: <Calendar size={22} />, bg: "linear-gradient(135deg, #FF3B30, #FF9500)" },
  { key: "/contacts", label: "Contacts", icon: <Users size={22} />, bg: "linear-gradient(135deg, #5AC8FA, #007AFF)" },
  { key: "/apps", label: "Apps", icon: <Grid3x3 size={22} />, bg: "linear-gradient(135deg, #8E8E93, #3A3A3C)" },
  { key: "/invites", label: "Invites", icon: <Share2 size={22} />, bg: "linear-gradient(135deg, #FFCC00, #FF9500)" },
  { key: "/notifications", label: "Alerts", icon: <Bell size={22} />, bg: "linear-gradient(135deg, #FF2D55, #AF52DE)" },
];

export default function Dock({ currentPath, onNav, unreadCount = 0 }) {
  return (
    <nav className="dock-container" data-testid="dock" aria-label="Primary application shortcuts">
      {items.map((it) => {
        const isActive = it.key === "/" ? currentPath === "/" : currentPath.startsWith(it.key);
        return (
          <button
            key={`${it.key}-${it.label}`}
            type="button"
            className={`dock-item ${isActive ? "active" : ""}`}
            onClick={() => onNav(it.key)}
            style={{ background: it.bg }}
            data-testid={`dock-${it.label.toLowerCase()}`}
            aria-label={it.label}
            aria-current={isActive ? "page" : undefined}
            title={it.label}
          >
            {it.icon}
            <span className="dock-tooltip" aria-hidden="true">{it.label}</span>
            {it.label === "Alerts" && unreadCount > 0 && <span className="dock-badge" aria-label={`${unreadCount} unread notifications`}>{unreadCount}</span>}
          </button>
        );
      })}
    </nav>
  );
}
