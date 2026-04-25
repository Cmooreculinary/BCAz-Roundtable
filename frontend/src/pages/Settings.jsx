import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";
import { User, Palette, Activity, LogOut, Bell, BellOff, Phone, MessageSquare, Camera, Sparkles, Lock } from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, isPushSupported, getPushPermission } from "../lib/push";
import AvatarPicker from "../components/AvatarPicker";
import { AVATAR_TIERS } from "../lib/scenes";
import logger from "../lib/logger";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#FFCC00", "#5AC8FA"];

export default function Settings() {
  const { user, updateMe, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.color || "#007AFF");
  const [status, setStatus] = useState(user?.status || "online");
  const [busy, setBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [autoSms, setAutoSms] = useState(user?.auto_sms || false);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    setPushEnabled(getPushPermission() === "granted");
    api.get("/bridges/status").then((r) => setSmsConfigured(r.data?.sms_configured || false)).catch(() => {});
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
      await updateMe({ name: name.trim(), color, status, phone: phone.trim() || null, auto_sms: autoSms });
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
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowAvatarPicker(true)} data-testid="settings-avatar-edit">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
            ) : (
              <div className="avatar" style={{ width: 64, height: 64, background: color, fontSize: 22 }}>{(name || user?.name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}</div>
            )}
            <div style={{
              position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%",
              background: "var(--mac-blue)", border: "2px solid var(--bg-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Camera size={10} color="#fff" />
            </div>
          </div>
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

        <label style={lbl}><Phone size={11} /> Phone Number</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" maxLength={20} data-testid="settings-phone" style={{ margin: "6px 0 16px" }} />

        {smsConfigured && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: 10, marginBottom: 20,
            background: autoSms ? "rgba(52, 199, 89, 0.08)" : "var(--bg-secondary)",
            border: `1px solid ${autoSms ? "rgba(52, 199, 89, 0.3)" : "var(--border-light)"}`,
            transition: "all 0.2s",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={13} color={autoSms ? "var(--mac-green)" : "var(--text-secondary)"} />
                Text me when I miss something
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                {autoSms
                  ? phone ? "You'll get SMS for pings, messages, prayers & calls when offline" : "Add your phone number above to activate"
                  : "Get SMS alerts for pings, messages, prayers & missed calls"}
              </div>
            </div>
            <button
              className={`btn ${autoSms ? "btn-secondary" : "btn-primary"}`}
              onClick={() => setAutoSms(!autoSms)}
              disabled={!phone.trim()}
              data-testid="settings-auto-sms-toggle"
              style={{ opacity: phone.trim() ? 1 : 0.5 }}
            >
              {autoSms ? "On" : "Off"}
            </button>
          </div>
        )}

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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} color="var(--mac-purple)" /> Avatar Tier
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>
          Your seat at every Round Table reflects your avatar tier.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {AVATAR_TIERS.map((t) => {
            const isActive = (user?.avatar_tier || "stylized") === t.id;
            return (
              <div
                key={t.id}
                data-testid={`avatar-tier-${t.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 10,
                  background: isActive ? "rgba(0,122,255,0.10)" : "var(--bg-secondary)",
                  border: `1px solid ${isActive ? "var(--mac-blue)" : "var(--border-light)"}`,
                  opacity: t.available ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {!t.available && <Lock size={11} />}
                    {t.label}
                    {isActive && <span className="badge green" style={{ fontSize: 9, padding: "1px 6px" }}>Active</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.hint}</div>
                </div>
                {!t.available && (
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>Coming soon</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Keyboard Shortcuts</div>
        <Row k="Esc" v="Dismiss any overlay or modal" />
        <Row k="Click + on Tables" v="Create a new Round Table" />
        <Row k="Hold the Talk button" v="Walkie talkie push-to-talk" />
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          currentUrl={user?.avatar_url}
          onSelect={async (url) => {
            try {
              await updateMe({ avatar_url: url });
              toast.success(url ? "Avatar updated!" : "Switched to initials");
            } catch (err) { logger.error("Avatar update error:", err); toast.error("Could not update avatar"); }
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
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
