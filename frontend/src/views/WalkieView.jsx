import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { Radio, Mic, MicOff, Video, PhoneOff, Users, Volume2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { useRTEvent } from "../lib/realtime";
import {
  startCall, joinCall, leaveCall, isInCall, getCallId,
  getLocalStream, getPeers, onCallStateChange,
  setAudioEnabled, sendTalkState,
} from "../lib/webrtc";
import HelpTip from "../components/rt/HelpTip";
import UserAvatar from "../components/UserAvatar";

function beep(freq = 880, dur = 0.12) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (f, start, d) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + d);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + d);
    };
    play(freq, 0, dur);
    play(freq * 1.25, dur + 0.05, dur);
  } catch { /* no-op */ }
}

export default function WalkieView({ onVideoCall }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [target, setTarget] = useState(null);
  const [talking, setTalking] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [talkers, setTalkers] = useState(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    api.get("/members").then((r) => setMembers(r.data || []));
    return () => { mountedRef.current = false; };
  }, []);

  // Listen for call state changes
  useEffect(() => {
    const off = onCallStateChange((event, data) => {
      if (!mountedRef.current) return;
      if (event === "peer_joined") {
        setRemoteParticipants(data.participants || []);
      }
      if (event === "peer_left") {
        setRemoteParticipants(data.participants || []);
      }
      if (event === "call_ended") {
        setInRoom(false);
        setRemoteParticipants([]);
      }
      if (event === "error") {
        toast.error(data?.error || "Walkie error");
        setInRoom(false);
      }
    });
    return off;
  }, []);

  // Listen for talk state broadcasts
  useRTEvent((evt) => {
    if (evt?.type === "walkie_talk_state") {
      setTalkers((prev) => {
        const next = new Set(prev);
        if (evt.talking) next.add(evt.from_user);
        else next.delete(evt.from_user);
        return next;
      });
    }
  }, []);

  const ping = async (m) => {
    try {
      await api.post("/walkie/ping", { to_user: m.id });
      beep(1100, 0.15);
      toast.success(`Pinged ${m.name}`);
    } catch {
      toast.error("Couldn't ping");
    }
  };

  const joinRoom = async () => {
    if (!target) return;
    try {
      await startCall({ targetUser: target.id, type: "audio" });
      setInRoom(true);
      // Start muted — push-to-talk
      setAudioEnabled(false);
      beep(660, 0.08);
      toast.success(`Walkie room with ${target.name} — hold to talk`);
    } catch (err) {
      toast.error(err.message || "Could not join walkie room");
    }
  };

  const exitRoom = () => {
    leaveCall();
    setInRoom(false);
    setTalking(false);
    setRemoteParticipants([]);
    beep(440, 0.15);
  };

  const startTalk = () => {
    if (!inRoom) return;
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

  const online = members.filter((m) => m.status === "online" && m.id !== user?.id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <HelpTip section="walkie" text="Push to talk. Like a real walkie talkie. Ping someone to get their attention." />
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.02em" }}>Walkie Talkie</h1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 14 }}>
        {/* Main talk panel */}
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            {inRoom ? `In room with ${target?.name}` : target ? `Selected: ${target.name}` : "Select a member to talk with"}
          </div>

          {target && (
            <div style={{ position: "relative", width: 140, height: 140, marginBottom: 24 }}>
              <div className="avatar" style={{ width: 140, height: 140, borderRadius: "50%", background: target.color, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {target.initials}
              </div>
              {talking && (
                <div style={{ position: "absolute", inset: -18, borderRadius: "50%", border: "3px solid var(--mac-red)", animation: "pulseTalk 1.4s ease-in-out infinite" }} />
              )}
              {inRoom && !talking && talkers.size > 0 && (
                <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "2px solid var(--mac-green)", animation: "pulseTalk 1.4s ease-in-out infinite" }} />
              )}
            </div>
          )}

          {/* Participants in room */}
          {inRoom && remoteParticipants.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
              {remoteParticipants.filter((id) => id !== user?.id).map((id) => {
                const m = members.find((mm) => mm.id === id);
                const isTalking = talkers.has(id);
                return (
                  <div key={id} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
                    borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: isTalking ? "var(--mac-green)" : "var(--bg-secondary)",
                    color: isTalking ? "#fff" : "var(--text-primary)",
                    transition: "all 0.2s",
                  }}>
                    {isTalking ? <Volume2 size={11} /> : <Users size={11} />}
                    {m?.name || id.slice(0, 8)}
                  </div>
                );
              })}
            </div>
          )}

          {!inRoom ? (
            <button
              className="btn btn-primary"
              onClick={joinRoom}
              disabled={!target}
              data-testid="walkie-join-room"
              style={{ opacity: target ? 1 : 0.5, padding: "12px 32px", fontSize: 14 }}
            >
              <Radio size={15} /> Join Walkie Room
            </button>
          ) : (
            <>
              <button
                className={`talk-btn ${talking ? "active" : ""}`}
                onMouseDown={startTalk} onMouseUp={endTalk} onMouseLeave={endTalk}
                onTouchStart={(e) => { e.preventDefault(); startTalk(); }}
                onTouchEnd={(e) => { e.preventDefault(); endTalk(); }}
                data-testid="walkie-talk-btn"
              >
                {talking ? <MicOff size={15} /> : <Mic size={15} />}
                {talking ? "Talking..." : "Hold to Talk"}
              </button>
              <button className="btn btn-secondary" onClick={exitRoom} style={{ marginTop: 12, color: "var(--mac-red)" }} data-testid="walkie-exit-room">
                <PhoneOff size={13} /> Leave Room
              </button>
            </>
          )}

          {target && !inRoom && (
            <button className="btn btn-secondary" onClick={() => onVideoCall?.(target)} style={{ marginTop: 16 }} data-testid="walkie-video-from-panel">
              <Video size={13} /> Video Call Instead
            </button>
          )}
        </div>

        {/* Online members panel */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Online Members</div>
          {online.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nobody's online. Ping later.</div>
          ) : online.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
              <UserAvatar user={m} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: "var(--mac-green)" }}>Online</div>
              </div>
              <button className="btn btn-secondary" onClick={() => { setTarget(m); if (inRoom) exitRoom(); }} data-testid={`walkie-select-${m.id}`}>Select</button>
              <button className="btn btn-secondary" onClick={() => ping(m)} data-testid={`walkie-pingnow-${m.id}`}><Radio size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
