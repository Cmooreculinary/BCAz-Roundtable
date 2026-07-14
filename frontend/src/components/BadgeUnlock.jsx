import React, { useEffect, useState } from "react";
import { Trophy, X, Share2, Copy } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import logger from "../lib/logger";

const TIERS = [
  { count: 1, name: "Newcomer", color: "#5AC8FA" },
  { count: 3, name: "Host", color: "#34C759" },
  { count: 10, name: "Connector", color: "#FF9500" },
  { count: 25, name: "Community Builder", color: "#AF52DE" },
];

export default function BadgeUnlock({ unlock, onClose }) {
  const [sharing, setSharing] = useState(false);
  const [shareCode, setShareCode] = useState("");

  useEffect(() => {
    if (!unlock) { setShareCode(""); return; }
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [unlock, onClose]);

  if (!unlock) return null;
  const tier = TIERS.find((t) => t.count === unlock.tier_count) || TIERS[0];

  const shareText = `I just earned the "${tier.name}" badge on Roundtable_VO — where my people gather. Come join us!`;
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const generateShare = async () => {
    setSharing(true);
    try {
      // Use the user's first table for the share invite
      const { data: tables } = await api.get("/tables");
      if (!tables?.length) {
        toast.error("Create a table first");
        setSharing(false); return;
      }
      const { data: inv } = await api.post("/invites", { table_id: tables[0].id, max_uses: 50, expires_in_days: 30 });
      setShareCode(inv.code);
      const url = `${appOrigin}/join/${inv.code}`;
      const body = `${shareText} ${url}`;
      if (navigator.share) {
        try { await navigator.share({ title: "Roundtable_VO", text: shareText, url }); }
        catch (err) { logger.error("Share cancelled:", err); }
      } else {
        try { await navigator.clipboard.writeText(body); toast.success("Invite copied — paste it anywhere"); }
        catch (err) { logger.error("Clipboard error:", err); toast.success("Invite ready below"); }
      }
    } catch (err) {
      logger.error("Share link error:", err);
      toast.error("Couldn't create share link");
    } finally { setSharing(false); }
  };

  const copyLink = () => {
    const url = `${appOrigin}/join/${shareCode}`;
    navigator.clipboard.writeText(`${shareText} ${url}`).then(() => toast.success("Copied"));
  };

  return (
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      zIndex: 130, animation: "scaleIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }} data-testid="badge-unlock">
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        borderRadius: 20, padding: 28, width: 400, textAlign: "center",
        boxShadow: "var(--shadow-xl)",
        position: "relative",
      }}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }} data-testid="badge-unlock-close">
          <X size={16} />
        </button>
        <div style={{
          width: 84, height: 84, borderRadius: "50%",
          background: tier.color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
          boxShadow: `0 0 0 8px ${tier.color}33`,
          animation: "avatarActiveGlow 2s ease-in-out infinite",
        }}>
          <Trophy size={36} />
        </div>
        <div style={{ fontSize: 11, color: tier.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>
          Badge unlocked
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em" }}>{tier.name}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
          {unlock.invitee_name} just joined. You've now welcomed <b>{unlock.joined_total}</b> {unlock.joined_total === 1 ? "person" : "people"} to the table.
        </div>

        {!shareCode ? (
          <button className="btn btn-primary" onClick={generateShare} disabled={sharing} data-testid="badge-share-btn" style={{ width: "100%", marginTop: 18, padding: "10px 14px", fontSize: 14, background: tier.color }}>
            <Share2 size={14} /> {sharing ? "Preparing…" : "Share My Badge & Invite More"}
          </button>
        ) : (
          <div style={{ marginTop: 18, padding: 12, background: "var(--bg-tertiary)", borderRadius: 12, textAlign: "left" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Your share link</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <code style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appOrigin}/join/{shareCode}</code>
              <button className="btn btn-secondary" onClick={copyLink} data-testid="badge-copy-link" style={{ padding: "4px 8px" }}><Copy size={12} /></button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              Paste it into a text, email, or group chat. One tap to join — no signup friction.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
