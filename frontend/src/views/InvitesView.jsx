import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { Copy, Plus, Users, Trophy, Phone, X, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import HelpTip from "../components/rt/HelpTip";
import logger from "../lib/logger";

export default function InvitesView({ tables, onOpenInvite }) {
  const [invites, setInvites] = useState([]);
  const [referrals, setReferrals] = useState({ invited: 0, joined: 0, uses: 0, badge: "No badge yet" });
  const [leaderboard, setLeaderboard] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [smsTarget, setSmsTarget] = useState(null); // { code, tableName }
  const [smsPhone, setSmsPhone] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/invites").then((r) => setInvites(r.data || [])).catch((err) => logger.error("Failed to load invites:", err));
    api.get("/referrals").then((r) => setReferrals(r.data || {})).catch((err) => logger.error("Failed to load referrals:", err));
    api.get("/referrals/leaderboard").then((r) => setLeaderboard(r.data || [])).catch((err) => logger.error("Failed to load leaderboard:", err));
  }, []);

  useEffect(() => {
    load();
    api.get("/bridges/status").then((r) => setSmsConfigured(r.data?.sms_configured || false)).catch(() => {});
  }, [load]);

  const copy = (code) => navigator.clipboard.writeText(code).then(() => toast.success("Copied"));

  const join = async () => {
    if (!joinCode.trim()) return;
    try {
      await api.post("/invites/join", { code: joinCode.trim() });
      toast.success("Joined the table");
      setJoinCode("");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const sendSmsInvite = async () => {
    if (!smsPhone.trim() || !smsTarget) return;
    setSmsBusy(true);
    try {
      await api.post("/bridges/sms", {
        phone: smsPhone.trim(),
        message: `You're invited to join "${smsTarget.tableName}" on Roundtable_VO! Use code: ${smsTarget.code}`,
      });
      toast.success(`Invite sent via SMS to ${smsPhone}`);
      setSmsTarget(null);
      setSmsPhone("");
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed to send SMS";
      toast.error(detail);
    } finally {
      setSmsBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <HelpTip section="invite" text="Generate unique invite codes. Share them anywhere. Track usage." />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Invites & Referrals</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={async () => { if (window.confirm("Move all invites to trash?")) { await api.delete("/invites/clear-all"); toast.success("All invites trashed"); load(); }}} data-testid="invites-clear-all" style={{ color: "var(--mac-red)" }}><Trash2 size={14} /> Clear All</button>
          <button className="btn btn-primary" onClick={onOpenInvite} data-testid="invites-new-btn"><Plus size={14} /> New Invite</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Join a Table</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Enter invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} data-testid="invites-join-input" />
              <button className="btn btn-primary" onClick={join} data-testid="invites-join-btn">Join</button>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Your Active Invites</div>

            {/* SMS compose inline */}
            {smsTarget && (
              <div style={{ padding: 12, marginBottom: 10, borderRadius: 10, borderLeft: "4px solid var(--mac-green)", background: "var(--bg-tertiary)" }} data-testid="invite-sms-compose">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    <Phone size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Text invite for {smsTarget.tableName} ({smsTarget.code})
                  </div>
                  <button className="btn btn-ghost" onClick={() => setSmsTarget(null)} style={{ padding: 2 }}><X size={14} /></button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendSmsInvite()} placeholder="+1 (555) 123-4567" maxLength={20} data-testid="invite-sms-phone" style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={sendSmsInvite} disabled={smsBusy || !smsPhone.trim()} data-testid="invite-sms-send">
                    {smsBusy ? "Sending..." : <><Send size={12} /> Send</>}
                  </button>
                </div>
              </div>
            )}

            {invites.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "10px 0" }}>No invites created yet. Generate one to start.</div>
            ) : invites.map((inv) => {
              const table = tables.find((t) => t.id === inv.table_id);
              return (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }} data-testid={`invite-row-${inv.id}`}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: table?.color || "#8E8E93", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                    {(table?.name?.[0] || "?").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{table?.name || "Unknown table"}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{inv.uses} / {inv.max_uses} uses · expires {(inv.expires_at || "").slice(0, 10)}</div>
                  </div>
                  <code style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, background: "var(--bg-tertiary)", padding: "4px 8px", borderRadius: 6 }}>{inv.code}</code>
                  {smsConfigured && (
                    <button className="btn btn-secondary" onClick={() => { setSmsTarget({ code: inv.code, tableName: table?.name || "Roundtable_VO" }); setSmsPhone(""); }} data-testid={`invite-sms-${inv.id}`} title="Send via SMS">
                      <Phone size={12} />
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => copy(inv.code)} data-testid={`invite-copy-${inv.id}`}><Copy size={12} /></button>
                  <button className="btn btn-ghost" onClick={async () => { await api.delete(`/invites/${inv.id}`); toast.success("Invite trashed"); load(); }} data-testid={`invite-delete-${inv.id}`} style={{ color: "var(--mac-red)", padding: 4 }}><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Your Referrals</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Stat label="Invited" value={referrals.invited} />
              <Stat label="Joined" value={referrals.joined} />
              <Stat label="Uses" value={referrals.uses} />
            </div>
            <div style={{ marginTop: 12, padding: 10, background: "var(--bg-tertiary)", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={14} color="var(--mac-orange)" />
              Badge: <b>{referrals.badge}</b>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={13} /> Top Inviters
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No referrals yet.</div>
            ) : leaderboard.slice(0, 5).map((row, i) => (
              <div key={row.user.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                <span style={{ width: 22, color: i < 3 ? "var(--mac-orange)" : "var(--text-tertiary)", fontWeight: 700 }}>#{i + 1}</span>
                <div className="avatar" style={{ width: 26, height: 26, background: row.user.color, fontSize: 10 }}>{row.user.initials}</div>
                <span style={{ flex: 1 }}>{row.user.name}</span>
                <span style={{ fontWeight: 700, color: "var(--mac-orange)" }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value || 0}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
