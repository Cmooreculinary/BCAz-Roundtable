import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { Armchair, Users, Sparkles, Link2, Mail, MessageSquare, Check, Copy, Phone, Bell, Camera } from "lucide-react";
import { toast } from "sonner";
import { subscribeToPush, isPushSupported, getPushPermission } from "../lib/push";
import AvatarPicker from "../components/AvatarPicker";

const COLORS = [
  "#007AFF", "#34C759", "#FF9500", "#FF3B30",
  "#AF52DE", "#FF2D55", "#FFCC00", "#5AC8FA",
];

const TOTAL_STEPS = 6;

export default function Onboarding() {
  const { user, updateMe, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.color || "#007AFF");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [autoSms, setAutoSms] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tableName, setTableName] = useState("");
  const [tableColor, setTableColor] = useState("#34C759");
  const [tableActive, setTableActive] = useState(true);
  const [createdTable, setCreatedTable] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [smsConfigured, setSmsConfigured] = useState(false);

  useEffect(() => {
    setPushEnabled(getPushPermission() === "granted");
    api.get("/bridges/status").then((r) => setSmsConfigured(r.data?.sms_configured || false)).catch(() => {});
  }, []);

  const finish = async () => {
    // Save any pending profile updates
    const updates = { onboarded: true };
    if (name.trim().length >= 2) updates.name = name.trim();
    if (color) updates.color = color;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (phone.trim()) updates.phone = phone.trim();
    updates.auto_sms = autoSms;
    await updateMe(updates);
    await refresh();
    // Track what was completed for reminder banners
    const completed = {
      profile: name.trim().length >= 2,
      avatar: !!avatarUrl,
      phone: !!phone.trim(),
      push: pushEnabled,
      table: !!createdTable,
    };
    localStorage.setItem("rt-onboarded", "true");
    localStorage.setItem("rt-onboard-completed", JSON.stringify(completed));
    nav("/");
  };

  const skipAll = async () => {
    await updateMe({ onboarded: true });
    await refresh();
    localStorage.setItem("rt-onboarded", "true");
    localStorage.setItem("rt-onboard-completed", JSON.stringify({ profile: false, avatar: false, phone: false, push: false, table: false }));
    nav("/");
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await updateMe({ name: name.trim(), color, avatar_url: avatarUrl });
      setStep(3);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveConnectivity = async () => {
    setBusy(true);
    try {
      const updates = {};
      if (phone.trim()) updates.phone = phone.trim();
      updates.auto_sms = autoSms;
      if (Object.keys(updates).length) await updateMe(updates);
      setStep(4);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    const ok = await subscribeToPush();
    setPushEnabled(ok);
    if (ok) toast.success("Push notifications enabled!");
    else toast.error("Could not enable push — check browser permissions");
  };

  const createTable = async () => {
    if (!tableName.trim()) return toast.error("Give your table a name");
    setBusy(true);
    try {
      const { data } = await api.post("/tables", { name: tableName.trim(), color: tableColor, active: tableActive });
      setCreatedTable(data);
      setStep(5);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const generateInvite = async () => {
    if (!createdTable) return;
    setBusy(true);
    try {
      const { data } = await api.post("/invites", { table_id: createdTable.id, max_uses: 50, expires_in_days: 30 });
      setInviteCode(data.code);
      toast.success("Invite code ready");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => toast.success("Copied!"));
  };

  return (
    <div className="onboard-bg">
      <div className="onboard-card" data-testid="onboarding-card" style={{ maxWidth: 500 }}>
        <div className="onboard-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <span key={n} className={n <= step ? "done" : ""} />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div className="avatar" style={{ width: 52, height: 52, background: "var(--mac-blue)", borderRadius: 14 }}>
                <Armchair size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Welcome to MICRO</h1>
                <p className="text-mute" style={{ margin: 0, fontSize: 13 }}>Where your people gather.</p>
              </div>
            </div>
            <div style={{ padding: 18, background: "var(--bg-tertiary)", borderRadius: 12, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Families, teams, faith communities, neighborhoods — your people don't fit in a chat thread.
              They fit around a table. Let's get you set up in just a few steps.
            </div>
            <div style={footerRow}>
              <button className="btn btn-ghost" onClick={skipAll} data-testid="onboard-skip-btn" style={{ fontSize: 12 }}>Complete later</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} data-testid="onboard-get-started" style={{ padding: "10px 20px" }}>Get Started</button>
            </div>
          </div>
        )}

        {/* Step 2: Profile — Name, Color, Avatar */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 4px" }}>Your Look</h2>
            <p className="text-mute" style={{ fontSize: 12, marginBottom: 16 }}>How others will see you at the table.</p>

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowAvatarPicker(true)} data-testid="onboard-avatar-edit">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: 80, height: 80, borderRadius: 20, objectFit: "cover", border: "2px solid var(--border-light)" }} />
                ) : (
                  <div className="avatar" style={{ width: 80, height: 80, background: color, fontSize: 26, borderRadius: 20 }}>
                    {(name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <div style={{
                  position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: "50%",
                  background: "var(--mac-blue)", border: "2px solid var(--bg-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Camera size={12} color="#fff" />
                </div>
              </div>
            </div>

            <label style={lbl}>Display Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={50} data-testid="onboard-name-input" style={{ margin: "6px 0 14px" }} />

            <label style={lbl}>Seat Color</label>
            <div style={{ display: "flex", gap: 8, margin: "8px 0 16px", flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} data-testid={`onboard-color-${c.replace("#", "")}`}
                  style={{ width: 32, height: 32, borderRadius: 10, background: c, cursor: "pointer",
                    border: color === c ? "3px solid var(--text-primary)" : "1px solid var(--border-color)" }} />
              ))}
            </div>

            <div style={footerRow}>
              <button className="btn btn-ghost" onClick={() => { setStep(3); }} style={{ fontSize: 12 }}>Complete later</button>
              <button className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={saveProfile} data-testid="onboard-profile-next">
                {busy ? "Saving..." : "Next"}
              </button>
            </div>

            {showAvatarPicker && (
              <AvatarPicker
                currentUrl={avatarUrl}
                onSelect={(url) => setAvatarUrl(url)}
                onClose={() => setShowAvatarPicker(false)}
              />
            )}
          </div>
        )}

        {/* Step 3: Stay Connected — Phone, SMS, Push */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 4px" }}>Stay Connected</h2>
            <p className="text-mute" style={{ fontSize: 12, marginBottom: 16 }}>Never miss what matters, even when you're away.</p>

            {/* Phone + Auto-SMS */}
            <label style={lbl}><Phone size={10} /> Phone Number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" maxLength={20} data-testid="onboard-phone-input" style={{ margin: "6px 0 14px" }} />

            {smsConfigured && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10, marginBottom: 14,
                background: autoSms ? "rgba(52, 199, 89, 0.08)" : "var(--bg-tertiary)",
                border: `1px solid ${autoSms ? "rgba(52, 199, 89, 0.3)" : "var(--border-light)"}`,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Text me when I miss something</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>SMS for pings, messages, prayers & calls</div>
                </div>
                <button
                  className={`btn ${autoSms ? "btn-secondary" : "btn-primary"}`}
                  onClick={() => setAutoSms(!autoSms)}
                  disabled={!phone.trim()}
                  data-testid="onboard-auto-sms-toggle"
                  style={{ fontSize: 11, padding: "4px 12px", opacity: phone.trim() ? 1 : 0.5 }}
                >
                  {autoSms ? "On" : "Off"}
                </button>
              </div>
            )}

            {/* Push notifications */}
            {isPushSupported() && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10, marginBottom: 14,
                background: pushEnabled ? "rgba(52, 199, 89, 0.08)" : "var(--bg-tertiary)",
                border: `1px solid ${pushEnabled ? "rgba(52, 199, 89, 0.3)" : "var(--border-light)"}`,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    <Bell size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Browser push notifications
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Alerts even when the tab is closed</div>
                </div>
                <button
                  className={`btn ${pushEnabled ? "btn-secondary" : "btn-primary"}`}
                  onClick={enablePush}
                  data-testid="onboard-push-toggle"
                  style={{ fontSize: 11, padding: "4px 12px" }}
                >
                  {pushEnabled ? "Enabled" : "Enable"}
                </button>
              </div>
            )}

            <div style={footerRow}>
              <button className="btn btn-ghost" onClick={() => setStep(4)} style={{ fontSize: 12 }}>Complete later</button>
              <button className="btn btn-primary" onClick={saveConnectivity} data-testid="onboard-connect-next">
                {busy ? "Saving..." : "Next"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Create Table */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 4px" }}>Your First Table</h2>
            <p className="text-mute" style={{ fontSize: 12, marginBottom: 16 }}>
              A table is where your group gathers — your shared space.
            </p>

            <label style={lbl}>Table Name</label>
            <input className="input" placeholder="Family Circle, Study Group, Project Team..." value={tableName} onChange={(e) => setTableName(e.target.value)} maxLength={60} data-testid="onboard-table-name-input" style={{ margin: "6px 0 14px" }} />

            <label style={lbl}>Table Color</label>
            <div style={{ display: "flex", gap: 8, margin: "8px 0 14px", flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setTableColor(c)} data-testid={`onboard-table-color-${c.replace("#", "")}`}
                  style={{ width: 32, height: 32, borderRadius: 10, background: c, cursor: "pointer",
                    border: tableColor === c ? "3px solid var(--text-primary)" : "1px solid var(--border-color)" }} />
              ))}
            </div>

            <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", fontSize: 12, fontWeight: 400 }}>
              <input type="checkbox" checked={tableActive} onChange={(e) => setTableActive(e.target.checked)} data-testid="onboard-table-active" />
              Make this table live
            </label>

            {tableName.trim() && (
              <div style={{ marginTop: 14, padding: 14, background: "var(--bg-tertiary)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: tableColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Armchair size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tableName}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{tableActive ? "Live" : "Dormant"}</div>
                </div>
              </div>
            )}

            <div style={{ ...footerRow, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(6)} style={{ fontSize: 12 }}>Complete later</button>
              <button className="btn btn-primary" onClick={createTable} disabled={busy || !tableName.trim()} data-testid="onboard-create-table-btn">
                {busy ? "Creating..." : "Create Table"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Invite People */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 4px" }}>Bring Your People</h2>
            <p className="text-mute" style={{ fontSize: 12, marginBottom: 16 }}>No one collaborates alone.</p>

            {!inviteCode ? (
              <button className="btn btn-primary" onClick={generateInvite} disabled={busy} data-testid="onboard-generate-invite" style={{ width: "100%", padding: "12px 16px" }}>
                <Link2 size={16} /> {busy ? "Generating..." : "Generate Invite Code"}
              </button>
            ) : (
              <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-light)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Your Invite Code</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, fontFamily: "Menlo, monospace" }}>{inviteCode}</div>
                  <button className="btn btn-secondary" onClick={copyInvite} data-testid="onboard-copy-invite"><Copy size={14} /></button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>Share this code with your group.</div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => window.location.href = `sms:?body=Join my MICRO table with code ${inviteCode || "..."}`} disabled={!inviteCode}><MessageSquare size={14} /> Text</button>
              <button className="btn btn-secondary" onClick={() => window.location.href = `mailto:?subject=Join MICRO&body=Join with code: ${inviteCode || "..."}`} disabled={!inviteCode}><Mail size={14} /> Email</button>
            </div>

            <div style={{ ...footerRow, marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setStep(6)} data-testid="onboard-invite-skip" style={{ fontSize: 12 }}>Complete later</button>
              <button className="btn btn-primary" onClick={() => setStep(6)} data-testid="onboard-invite-next">Next</button>
            </div>
          </div>
        )}

        {/* Step 6: All Set */}
        {step === 6 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div className="avatar" style={{ width: 44, height: 44, background: "var(--mac-green)", borderRadius: 12 }}>
                <Sparkles size={22} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>You're all set!</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <StatusRow done={name.trim().length >= 2} label="Profile name" />
              <StatusRow done={!!avatarUrl} label="Avatar" />
              <StatusRow done={!!phone.trim()} label="Phone number" />
              <StatusRow done={pushEnabled} label="Push notifications" />
              <StatusRow done={!!createdTable} label="First table" />
            </div>

            {(!avatarUrl || !phone.trim() || !pushEnabled || !createdTable) && (
              <div style={{ padding: 12, background: "var(--bg-tertiary)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                No worries about skipped items — you'll see gentle reminders on your Portal to finish setting up whenever you're ready.
              </div>
            )}

            <button className="btn btn-primary" onClick={finish} data-testid="onboard-finish-btn" style={{ width: "100%", padding: "12px 16px", fontSize: 14 }}>
              Start Collaborating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ done, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: done ? "var(--mac-green)" : "var(--bg-tertiary)",
        border: done ? "none" : "1px solid var(--border-color)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {done && <Check size={12} color="#fff" />}
      </div>
      <span style={{ fontSize: 13, fontWeight: done ? 600 : 400, color: done ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 };
const footerRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
