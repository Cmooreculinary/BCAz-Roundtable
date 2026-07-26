import React, { useEffect } from "react";
import { Radio, Phone, X } from "lucide-react";

function beep(freq = 880, dur = 0.18) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (err) { /* audio context not available */ }
}

export default function PingToast({ ping, onAnswer, onDismiss }) {
  useEffect(() => {
    if (!ping) return;
    beep(1100, 0.18);
    const t1 = setTimeout(() => beep(1100, 0.18), 350);
    const t2 = setTimeout(() => onDismiss?.(), 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ping, onDismiss]);

  if (!ping) return null;

  return (
    <div className="ping-toast" data-testid="ping-toast">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="avatar" style={{
          width: 38, height: 38, background: ping.from_color || "#FF9500",
          fontSize: 13, position: "relative",
        }}>
          {ping.from_initials || "?"}
          <span style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: "2px solid var(--mac-orange)", animation: "avatarActiveGlow 1.5s ease-in-out infinite",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
            <Radio size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> Walkie ping
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{ping.from_name || "Someone"}</div>
        </div>
        <button onClick={onDismiss} className="btn btn-ghost" style={{ padding: 4 }} data-testid="ping-toast-dismiss">
          <X size={14} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button className="btn btn-secondary" onClick={onDismiss} style={{ flex: 1 }} data-testid="ping-toast-later">Later</button>
        <button className="btn btn-primary" onClick={onAnswer} style={{ flex: 1, background: "var(--mac-green)" }} data-testid="ping-toast-answer">
          <Phone size={12} /> Answer
        </button>
      </div>
    </div>
  );
}
