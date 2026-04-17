import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Phone, Video, Radio, Clock, Users, PhoneCall, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "../components/rt/EmptyState";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const now = new Date();
  const then = new Date(isoStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CallHistoryView({ onVideoCall }) {
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/calls/history");
      setCalls(data || []);
    } catch {
      toast.error("Could not load call history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const redial = (call) => {
    // Find the other person in the call
    const other = (call.participant_details || []).find((p) => p.id !== user?.id);
    if (other) {
      onVideoCall?.(other, call.type);
    } else {
      toast.error("Could not find call participant");
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading call history...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Call History</h1>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last 30 days</div>
      </div>

      {calls.length === 0 ? (
        <EmptyState
          icon={<PhoneCall size={32} />}
          title="No calls yet"
          subtitle="Your call history will appear here after you make or receive calls."
          testId="call-history-empty"
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {calls.map((call, idx) => {
            const isOutgoing = call.created_by === user?.id;
            const otherParticipants = (call.participant_details || []).filter((p) => p.id !== user?.id);
            const displayName = otherParticipants.length > 0
              ? otherParticipants.map((p) => p.name).join(", ")
              : call.target?.name || "Unknown";
            const displayInitials = otherParticipants.length > 0
              ? otherParticipants[0]?.initials
              : call.target?.initials || "?";
            const displayColor = otherParticipants.length > 0
              ? otherParticipants[0]?.color
              : call.target?.color || "#8E8E93";
            const isAudio = call.type === "audio";
            const isMissed = call.status === "active" && call.duration_seconds === 0;

            return (
              <div
                key={call.call_id || idx}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: idx < calls.length - 1 ? "1px solid var(--border-light)" : "none",
                  transition: "background 0.15s",
                  cursor: "pointer",
                }}
                onClick={() => redial(call)}
                data-testid={`call-history-item-${call.call_id}`}
              >
                {/* Avatar */}
                <div style={{ position: "relative" }}>
                  <div className="avatar" style={{
                    width: 44, height: 44, background: displayColor,
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {displayInitials}
                  </div>
                  <div style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: "50%",
                    background: isAudio ? "var(--mac-orange)" : "var(--mac-blue)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid var(--bg-primary)",
                  }}>
                    {isAudio ? <Radio size={9} color="#fff" /> : <Video size={9} color="#fff" />}
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: isMissed ? "var(--mac-red)" : "var(--text-primary)",
                    }}>
                      {displayName}
                    </span>
                    {otherParticipants.length > 1 && (
                      <span style={{
                        fontSize: 10, background: "var(--bg-tertiary)",
                        padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                      }}>
                        <Users size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                        {otherParticipants.length + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    {isOutgoing ? (
                      <ArrowUpRight size={11} color="var(--mac-green)" />
                    ) : (
                      <ArrowDownLeft size={11} color={isMissed ? "var(--mac-red)" : "var(--mac-blue)"} />
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {isMissed ? "Missed" : isOutgoing ? "Outgoing" : "Incoming"}
                      {!isMissed && call.duration_seconds > 0 && ` · ${formatDuration(call.duration_seconds)}`}
                    </span>
                  </div>
                </div>

                {/* Time + redial */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>
                    <div>{timeAgo(call.started_at)}</div>
                    {call.started_at && (
                      <div style={{ fontSize: 10, opacity: 0.7 }}>
                        {new Date(call.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={(e) => { e.stopPropagation(); redial(call); }}
                    data-testid={`call-redial-${call.call_id}`}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", padding: 0,
                      background: "var(--mac-green)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Phone size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
