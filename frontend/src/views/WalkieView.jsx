import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { api } from "../lib/api";
import { Radio, Mic, MicOff, Video, Bell, X, Volume2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { useRTEvent } from "../lib/realtime";
import {
  startCall, joinCall, leaveCall, isInCall,
  onCallStateChange, setAudioEnabled, sendTalkState,
} from "../lib/webrtc";
import UserAvatar from "../components/UserAvatar";

function beep(freq = 880, dur = 0.12) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (f, start, d) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = f;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + d);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + d);
    };
    play(freq, 0, dur); play(freq * 1.25, dur + 0.05, dur);
  } catch (err) { console.error("Beep error:", err); }
}

export default function WalkieView({ onVideoCall }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [target, setTarget] = useState(null);
  const [talking, setTalking] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    api.get("/members").then((r) => setMembers(r.data || [])).catch((err) => console.error("Failed to load members:", err));
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const off = onCallStateChange((event, data) => {
      if (!mountedRef.current) return;
      if (event === "call_ended") { setInRoom(false); }
      if (event === "error") { toast.error(data?.error || "Walkie error"); setInRoom(false); }
    });
    return off;
  }, []);

  const online = useMemo(() => members.filter((m) => m.status === "online" && m.id !== user?.id), [members, user?.id]);

  const selectTarget = (m) => {
    setTarget(m);
    setShowPicker(false);
  };

  const ping = async (m) => {
    try {
      await api.post("/walkie/ping", { to_user: m.id });
      beep(1100, 0.15);
      toast.success(`Pinged ${m.name}`);
    } catch (err) {
      toast.error("Couldn't ping");
    }
  };

  const joinRoom = async () => {
    if (!target) return;
    try {
      await startCall({ targetUser: target.id, type: "audio" });
      setInRoom(true);
      setAudioEnabled(false);
      beep(660, 0.08);
    } catch (err) {
      toast.error(err.message || "Could not join walkie room");
    }
  };

  const exitRoom = () => {
    leaveCall();
    setInRoom(false);
    setTalking(false);
    beep(440, 0.15);
    setShowPicker(true);
  };

  const startTalk = () => {
    if (!inRoom) { joinRoom().then(() => { setTalking(true); setAudioEnabled(true); sendTalkState(true); beep(660, 0.08); }); return; }
    setTalking(true);
    setAudioEnabled(true);
    sendTalkState(true);
    beep(660, 0.08);
  };

  const endTalk = () => {
    if (!talking) return;
    setTalking(false);
    setAudioEnabled(false);
    sendTalkState(false);
  };

  // If no target selected or showPicker, show member picker
  if (!target || showPicker) {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto" }}>
        <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}>
            <Radio size={16} color="var(--mac-green)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Walkie Talkie</span>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Choose someone to talk to:</div>
            {online.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "30px 0" }}>Nobody's online right now</div>
            ) : online.map((m) => (
              <div key={m.id} onClick={() => selectTarget(m)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 8px",
                borderBottom: "1px solid var(--border-light)", cursor: "pointer",
                borderRadius: 8, transition: "background 0.1s",
              }} data-testid={`walkie-select-${m.id}`}>
                <UserAvatar user={m} size={38} style={{ borderRadius: "50%" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--mac-green)" }}>Online</div>
                </div>
                <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); ping(m); }} style={{ padding: 4 }} data-testid={`walkie-ping-${m.id}`}>
                  <Radio size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Walkie overlay for selected target
  return (
    <div style={{ maxWidth: 340, margin: "30px auto" }}>
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        {/* Dark header */}
        <div style={{
          padding: "12px 16px", background: "#2D2D2D",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
            <Radio size={16} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Walkie Talkie</span>
          </div>
          <button onClick={exitRoom || (() => { setTarget(null); setShowPicker(true); })} style={{
            background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4,
          }} data-testid="walkie-close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "30px 20px 24px", textAlign: "center", background: "var(--bg-elevated)" }}>
          {/* Large avatar */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <UserAvatar user={target} size={100} style={{ borderRadius: "50%" }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{target.name}</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            {talking ? "Talking..." : inRoom ? "In room — Hold to talk" : "Hold to talk"}
          </div>

          {/* Large mic button with pulse */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            {(talking || inRoom) && (
              <div style={{
                position: "absolute", inset: -16, borderRadius: "50%",
                background: talking ? "rgba(52,199,89,0.15)" : "rgba(52,199,89,0.08)",
                animation: "pulseTalk 1.5s ease-in-out infinite",
              }} />
            )}
            <button
              onMouseDown={startTalk} onMouseUp={endTalk} onMouseLeave={endTalk}
              onTouchStart={(e) => { e.preventDefault(); startTalk(); }}
              onTouchEnd={(e) => { e.preventDefault(); endTalk(); }}
              data-testid="walkie-talk-btn"
              style={{
                position: "relative", zIndex: 1,
                width: 100, height: 100, borderRadius: "50%", border: "none",
                background: talking ? "#28a745" : "#2ECC71",
                color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 20px rgba(46,204,113,0.4)",
                transition: "transform 0.1s, background 0.15s",
                transform: talking ? "scale(0.95)" : "scale(1)",
              }}
            >
              {talking ? <MicOff size={36} /> : <Mic size={36} />}
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
            <button
              onClick={() => onVideoCall?.(target)}
              data-testid="walkie-video-btn"
              style={{
                width: 50, height: 50, borderRadius: "50%", border: "none",
                background: "var(--mac-blue)", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 10px rgba(0,122,255,0.3)",
              }}
            >
              <Video size={22} />
            </button>
            <button
              onClick={() => ping(target)}
              data-testid="walkie-ping-btn"
              style={{
                width: 50, height: 50, borderRadius: "50%", border: "none",
                background: "var(--mac-blue)", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 10px rgba(0,122,255,0.3)",
              }}
            >
              <Bell size={22} />
            </button>
          </div>

          {/* Choose someone else */}
          <button
            onClick={() => { if (inRoom) exitRoom(); setTarget(null); setShowPicker(true); }}
            data-testid="walkie-choose-else"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--mac-blue)", fontSize: 14, fontWeight: 500,
              textDecoration: "underline", padding: 4,
            }}
          >
            Choose someone else
          </button>
        </div>
      </div>
    </div>
  );
}
