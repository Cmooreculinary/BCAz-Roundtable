import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Armchair, Users, ArrowRight, Heart, BookOpen, Home, Briefcase, Sparkles } from "lucide-react";
import { toast } from "sonner";

const PURPOSE_META = {
  family: { label: "Family", icon: <Home size={14} />, color: "#FF9500" },
  bible_study: { label: "Bible Study", icon: <BookOpen size={14} />, color: "#AF52DE" },
  community: { label: "Community", icon: <Heart size={14} />, color: "#34C759" },
  friends: { label: "Friends", icon: <Sparkles size={14} />, color: "#5AC8FA" },
  work: { label: "Work", icon: <Briefcase size={14} />, color: "#007AFF" },
  other: { label: "Gathering", icon: <Armchair size={14} />, color: "#8E8E93" },
};

export default function JoinByCode() {
  const { code } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    api.get(`/invites/preview/${code}`)
      .then((r) => setPreview(r.data))
      .catch((e) => setError(formatApiErrorDetail(e.response?.data?.detail) || "Invite not valid"));
  }, [code]);

  const joinNow = async () => {
    if (!user || user === false) {
      // Stash code and route to login
      sessionStorage.setItem("rt-pending-code", code);
      nav("/register");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/invites/join", { code });
      toast.success("You're in!");
      nav(`/table/${data.table_id}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  const meta = preview?.table ? (PURPOSE_META[preview.table.purpose] || PURPOSE_META.other) : PURPOSE_META.other;

  return (
    <div className="onboard-bg">
      <div className="onboard-card" data-testid="join-by-code" style={{ maxWidth: 460 }}>
        {error ? (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invite not valid</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>{error}</div>
            <Link to="/login" className="btn btn-primary" data-testid="join-go-login">Go to Sign In</Link>
          </div>
        ) : !preview ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-secondary)", fontSize: 13 }}>Looking up the invite…</div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: preview.table.color, color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 26, margin: "0 auto 12px",
                boxShadow: "var(--shadow-lg)",
                position: "relative",
              }}>
                <Armchair size={28} />
                {preview.table.active && (
                  <span style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid var(--mac-green)", animation: "glowRingPulse 2.5s ease-in-out infinite" }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {meta.icon} {meta.label}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: "4px 0 6px", letterSpacing: "-0.02em" }}>{preview.table.name}</h1>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <b>{preview.inviter.name}</b> invited you to their Roundtable_VO table
              </div>
            </div>

            <div style={{ padding: 14, background: "var(--bg-tertiary)", borderRadius: 12, display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
              <div className="avatar" style={{ width: 40, height: 40, background: preview.inviter.color, fontSize: 13 }}>{preview.inviter.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Hosted by {preview.inviter.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Users size={11} /> {preview.table.member_count} member{preview.table.member_count !== 1 ? "s" : ""} already at the table
                </div>
              </div>
            </div>

            {user && user !== false ? (
              <button className="btn btn-primary" onClick={joinNow} disabled={busy} style={{ width: "100%", padding: "12px 16px", fontSize: 14 }} data-testid="join-accept-btn">
                {busy ? "Joining…" : <>Take My Seat <ArrowRight size={14} /></>}
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={joinNow} style={{ width: "100%", padding: "12px 16px", fontSize: 14 }} data-testid="join-signup-btn">
                  Create Account & Join
                </button>
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                  Already have a seat?{" "}
                  <button onClick={() => { sessionStorage.setItem("rt-pending-code", code); nav("/login"); }} style={{ background: "transparent", border: "none", color: "var(--mac-blue)", fontWeight: 600, cursor: "pointer", padding: 0 }} data-testid="join-signin-link">
                    Sign in
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
