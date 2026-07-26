import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Radio, Mic, MicOff, Video, Bell, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  startCall, leaveCall, isInCall,
  onCallStateChange, setAudioEnabled, sendTalkState,
} from "../lib/webrtc";
import UserAvatar from "../components/UserAvatar";
import logger from "../lib/logger";

function beep(freq = 880, dur = 0.12) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const play = (frequency, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    play(freq, 0, dur);
    play(freq * 1.25, dur + 0.05, dur);
    window.setTimeout(() => ctx.close().catch(() => {}), Math.ceil((dur * 2 + 0.2) * 1000));
  } catch (error) {
    logger.error("Beep error:", error);
  }
}

export default function WalkieView({ onVideoCall }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [target, setTarget] = useState(null);
  const [talking, setTalking] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [joining, setJoining] = useState(false);
  const mountedRef = useRef(true);
  const pressingRef = useRef(false);
  const joiningRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    api.get("/members")
      .then((response) => {
        if (mountedRef.current) setMembers(response.data || []);
      })
      .catch((error) => logger.error("Failed to load members:", error));

    return () => {
      mountedRef.current = false;
      pressingRef.current = false;
      sendTalkState(false);
      setAudioEnabled(false);
      if (isInCall()) leaveCall();
    };
  }, []);

  useEffect(() => {
    const off = onCallStateChange((event, data) => {
      if (!mountedRef.current) return;
      if (event === "call_ended") {
        pressingRef.current = false;
        setTalking(false);
        setInRoom(false);
      }
      if (event === "error") {
        pressingRef.current = false;
        setTalking(false);
        setInRoom(false);
        setAudioEnabled(false);
        sendTalkState(false);
        toast.error(data?.error || "Walkie error");
      }
    });
    return off;
  }, []);

  const online = useMemo(() => members.filter((member) => member.status === "online" && member.id !== user?.id), [members, user?.id]);

  const selectTarget = (member) => {
    setTarget(member);
    setShowPicker(false);
  };

  const ping = async (member) => {
    try {
      await api.post("/walkie/ping", { to_user: member.id });
      beep(1100, 0.15);
      toast.success(`Pinged ${member.name}`);
    } catch (error) {
      toast.error("Couldn't ping");
    }
  };

  const joinRoom = useCallback(async () => {
    if (!target || joiningRef.current) return false;
    joiningRef.current = true;
    setJoining(true);
    try {
      await startCall({ targetUser: target.id, type: "audio" });
      if (!mountedRef.current) return false;
      setInRoom(true);
      setAudioEnabled(false);
      beep(660, 0.08);
      return true;
    } catch (error) {
      if (mountedRef.current) toast.error(error.message || "Could not join walkie room");
      return false;
    } finally {
      joiningRef.current = false;
      if (mountedRef.current) setJoining(false);
    }
  }, [target]);

  const exitRoom = useCallback(() => {
    pressingRef.current = false;
    setTalking(false);
    setAudioEnabled(false);
    sendTalkState(false);
    if (isInCall()) leaveCall();
    setInRoom(false);
    beep(440, 0.15);
    setTarget(null);
    setShowPicker(true);
  }, []);

  const startTalk = useCallback(async () => {
    if (pressingRef.current || joiningRef.current) return;
    pressingRef.current = true;

    let ready = inRoom;
    if (!ready) ready = await joinRoom();
    if (!ready || !mountedRef.current || !pressingRef.current) return;

    setTalking(true);
    setAudioEnabled(true);
    sendTalkState(true);
    beep(660, 0.08);
  }, [inRoom, joinRoom]);

  const endTalk = useCallback(() => {
    pressingRef.current = false;
    setTalking(false);
    setAudioEnabled(false);
    sendTalkState(false);
  }, []);

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
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "30px 0" }}>Nobody&apos;s online right now</div>
            ) : online.map((member) => (
              <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-light)" }}>
                <button
                  type="button"
                  onClick={() => selectTarget(member)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "10px 8px",
                    border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer",
                    borderRadius: 8, font: "inherit",
                  }}
                  data-testid={`walkie-select-${member.id}`}
                >
                  <UserAvatar user={member} size={38} style={{ borderRadius: "50%" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                    <div style={{ fontSize: 11, color: "var(--mac-green)" }}>Online</div>
                  </div>
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => ping(member)} aria-label={`Ping ${member.name}`} style={{ padding: 4 }} data-testid={`walkie-ping-${member.id}`}>
                  <Radio size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 340, margin: "30px auto" }}>
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "12px 16px", background: "#2D2D2D", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
            <Radio size={16} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Walkie Talkie</span>
          </div>
          <button type="button" onClick={exitRoom} aria-label="Close walkie room" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }} data-testid="walkie-close">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "30px 20px 24px", textAlign: "center", background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <UserAvatar user={target} size={100} style={{ borderRadius: "50%" }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{target.name}</div>
          <div aria-live="polite" style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            {joining ? "Joining..." : talking ? "Talking..." : inRoom ? "In room — Hold to talk" : "Hold to talk"}
          </div>

          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            {(talking || inRoom) && (
              <div style={{ position: "absolute", inset: -16, borderRadius: "50%", background: talking ? "rgba(52,199,89,0.15)" : "rgba(52,199,89,0.08)", animation: "pulseTalk 1.5s ease-in-out infinite" }} />
            )}
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                startTalk();
              }}
              onPointerUp={endTalk}
              onPointerCancel={endTalk}
              onPointerLeave={(event) => { if (event.buttons) endTalk(); }}
              disabled={joining}
              aria-label={talking ? "Release to stop talking" : "Hold to talk"}
              aria-pressed={talking}
              data-testid="walkie-talk-btn"
              style={{
                position: "relative", zIndex: 1, width: 100, height: 100, borderRadius: "50%", border: "none",
                background: talking ? "#28a745" : "#2ECC71", color: "#fff", cursor: joining ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(46,204,113,0.4)",
                transition: "transform 0.1s, background 0.15s", transform: talking ? "scale(0.95)" : "scale(1)", opacity: joining ? 0.7 : 1,
                touchAction: "none",
              }}
            >
              {talking ? <MicOff size={36} /> : <Mic size={36} />}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
            <button type="button" onClick={() => onVideoCall?.(target)} aria-label={`Video call ${target.name}`} data-testid="walkie-video-btn" style={{ width: 50, height: 50, borderRadius: "50%", border: "none", background: "var(--mac-blue)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,122,255,0.3)" }}>
              <Video size={22} />
            </button>
            <button type="button" onClick={() => ping(target)} aria-label={`Ping ${target.name}`} data-testid="walkie-ping-btn" style={{ width: 50, height: 50, borderRadius: "50%", border: "none", background: "var(--mac-blue)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,122,255,0.3)" }}>
              <Bell size={22} />
            </button>
          </div>

          <button type="button" onClick={exitRoom} data-testid="walkie-choose-else" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mac-blue)", fontSize: 14, fontWeight: 500, textDecoration: "underline", padding: 4 }}>
            Choose someone else
          </button>
        </div>
      </div>
    </div>
  );
}
