import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { formatApiErrorDetail } from "../lib/api";
import { User, Palette, Activity, LogOut, Bell, BellOff } from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, isPushSupported, getPushPermission } from "../lib/push";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#FFCC00", "#5AC8FA"];

export default function Settings() {
  const { user, updateMe, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.color || "#007AFF");
  const [status, setStatus] = useState(user?.status || "online");
  const [busy, setBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    setPushEnabled(getPushPermission() === "granted");
  }, []);

  const togglePush = async () => {
    if (pushEnabled) {
      await unsubscribeFromPush();
      setPushEnabled(false);
      toast.success("Push notifications disabled");
    } else {
      const ok = await subscribeToPush();
      setPushEnabled(ok);
      if (ok) toast.success("Push notifications enabled!");
      else toast.error("Could not enable push notifications");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateMe({ name: name.trim(), color, status });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.02em" }}>Settings</h1>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div className="avatar" style={{ width: 64, height: 64, background: color, fontSize: 22 }}>{(name || user?.name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{name || user?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user?.email}</div>
          </div>
        </div>

        <label style={lbl}><User size={11} /> Display Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} data-testid="settings-name" style={{ margin: "6px 0 16px" }} />

        <label style={lbl}><Palette size={11} /> Seat Color</label>
        <div style={{ display: "flex", gap: 8, margin: "8px 0 16px", flexWrap: "wrap" }}>
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} data-testid={`settings-color-${c.replace("#", "")}`} style={{
              width: 36, height: 36, borderRadius: 10, background: c, cursor: "pointer",
              border: color === c ? "3px solid var(--text-primary)" : "1px solid var(--border-color)",
            }} />
          ))}
        </div>

        <label style={lbl}><Activity size={11} /> Status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="settings-status" style={{ margin: "6px 0 20px" }}>
          <option value="online">Online</option>
          <option value="away">Away</option>
          <option value="dnd">Do Not Disturb</option>
        </select>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button className="btn btn-danger" onClick={logout} data-testid="settings-logout"><LogOut size={13} /> Sign Out</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} data-testid="settings-save" style={{ minWidth: 140 }}>{busy ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>

      {pushSupported && (
        <div className="card" style={{ padding: 16, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {pushEnabled ? <Bell size={14} color="var(--mac-green)" /> : <BellOff size={14} />}
                Push Notifications
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                {pushEnabled ? "You'll receive alerts even when the tab is closed" : "Enable to get notified of pings, messages & calls"}
              </div>
            </div>
            <button className={`btn ${pushEnabled ? "btn-secondary" : "btn-primary"}`} onClick={togglePush} data-testid="settings-push-toggle">
              {pushEnabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Keyboard Shortcuts</div>
        <Row k="Esc" v="Dismiss any overlay or modal" />
        <Row k="Click + on Tables" v="Create a new Round Table" />
        <Row k="Hold the Talk button" v="Walkie talkie push-to-talk" />
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 4 };
const Row = ({ k, v }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12, borderBottom: "1px solid var(--border-light)" }}>
    <code style={{ background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 11, fontFamily: "Menlo, monospace" }}>{k}</code>
    <span style={{ color: "var(--text-secondary)" }}>{v}</span>
  </div>
);
