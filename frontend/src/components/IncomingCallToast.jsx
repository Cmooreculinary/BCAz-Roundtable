import React, { useEffect } from "react";
import { Phone, PhoneOff, Video, Radio } from "lucide-react";

function ringTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.2);
    play(880, 0.3, 0.2);
    play(1100, 0.6, 0.3);
  } catch { /* no-op */ }
}

export default function IncomingCallToast({ call, onAnswer, onDecline }) {
  useEffect(() => {
    if (!call) return;
    ringTone();
    const t = setTimeout(() => onDecline?.(), 30000);
    return () => clearTimeout(t);
  }, [call, onDecline]);

  if (!call) return null;

  const isAudio = call.call_type === "audio";

  return (
    <div className="ping-toast" style={{ borderLeft: `4px solid ${isAudio ? "var(--mac-orange)" : "var(--mac-green)"}` }} data-testid="incoming-call-toast">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="avatar" style={{
          width: 42, height: 42, background: call.caller?.color || "#007AFF",
          fontSize: 14, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {call.caller?.initials || "?"}
          <span style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: `2px solid ${isAudio ? "var(--mac-orange)" : "var(--mac-green)"}`,
            animation: "avatarActiveGlow 1.5s ease-in-out infinite",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
            {isAudio ? <><Radio size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> Walkie Call</> : <><Video size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> Video Call</>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{call.caller?.name || "Someone"}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button className="btn btn-secondary" onClick={onDecline} style={{ flex: 1, color: "var(--mac-red)" }} data-testid="incoming-call-decline">
          <PhoneOff size={13} /> Decline
        </button>
        <button className="btn btn-primary" onClick={onAnswer} style={{ flex: 1, background: "var(--mac-green)" }} data-testid="incoming-call-answer">
          <Phone size={13} /> Answer
        </button>
      </div>
    </div>
  );
}
