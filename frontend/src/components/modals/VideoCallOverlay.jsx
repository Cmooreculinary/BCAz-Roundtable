import React, { useEffect, useState, useRef, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Maximize2, Minimize2 } from "lucide-react";
import { useRTEvent } from "../../lib/realtime";
import {
  startCall, joinCall, leaveCall, isInCall, getCallId,
  getLocalStream, getPeers, onCallStateChange,
  toggleMute, toggleCamera, getCallType,
} from "../../lib/webrtc";
import { toast } from "sonner";

export default function VideoCallOverlay({ target, incomingCallId, callType: propCallType, onClose }) {
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [peerStreams, setPeerStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const localVideoRef = useRef(null);
  const mountedRef = useRef(true);
  const initRef = useRef(false);

  // Initialize call
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    mountedRef.current = true;

    const init = async () => {
      try {
        const type = propCallType || "video";
        if (incomingCallId) {
          await joinCall(incomingCallId, type);
        } else {
          await startCall({
            targetUser: target?.id,
            type,
          });
        }
        if (!mountedRef.current) return;
        setConnecting(false);
        // Set local video
        const ls = getLocalStream();
        if (localVideoRef.current && ls) {
          localVideoRef.current.srcObject = ls;
        }
      } catch (err) {
        if (!mountedRef.current) return;
        toast.error(err.message || "Could not start call");
        onClose?.();
      }
    };
    init();

    return () => {
      mountedRef.current = false;
    };
  }, [target, incomingCallId, propCallType, onClose]);

  // Listen for call state changes
  useEffect(() => {
    const off = onCallStateChange((event, data) => {
      if (!mountedRef.current) return;
      if (event === "track") {
        setPeerStreams(new Map(
          Array.from(getPeers().entries()).map(([id, { streams }]) => [id, streams[0] || null])
        ));
      }
      if (event === "peer_joined" || event === "peer_left") {
        setParticipants(data.participants || []);
        setPeerStreams(new Map(
          Array.from(getPeers().entries()).map(([id, { streams }]) => [id, streams[0] || null])
        ));
      }
      if (event === "call_ended" || event === "error") {
        if (event === "error") toast.error(data?.error || "Call error");
      }
    });
    return off;
  }, []);

  // Set local video when stream becomes available
  useEffect(() => {
    if (!connecting && localVideoRef.current) {
      const ls = getLocalStream();
      if (ls) localVideoRef.current.srcObject = ls;
    }
  }, [connecting]);

  const handleEnd = useCallback(() => {
    leaveCall();
    onClose?.();
  }, [onClose]);

  const handleMute = () => {
    const isMuted = toggleMute();
    setMuted(isMuted);
  };

  const handleCam = () => {
    const isOff = toggleCamera();
    setCamOff(isOff);
  };

  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleEnd(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleEnd]);

  const callTypeLabel = getCallType() || propCallType || "video";
  const isAudioOnly = callTypeLabel === "audio";
  const peerEntries = Array.from(peerStreams.entries());

  // Grid layout: 1 peer = 1col, 2 = 2col, 3-4 = 2x2, 5-6 = 3x2
  const gridCols = peerEntries.length <= 1 ? 1 : peerEntries.length <= 4 ? 2 : 3;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      background: "#000",
      display: "flex", flexDirection: "column",
    }} data-testid="video-call-overlay">
      {/* Header */}
      <div style={{
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff" }}>
          <Users size={16} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {target?.name || "Group Call"} — {isAudioOnly ? "Audio" : "Video"} Call
          </span>
          {connecting && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Connecting...</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setExpanded((v) => !v)} style={headerBtn} data-testid="videocall-expand">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: 4, padding: 4, overflow: "hidden",
      }}>
        {peerEntries.length === 0 && !connecting && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", color: "rgba(255,255,255,0.6)", gap: 12,
          }}>
            <div className="avatar" style={{
              width: 100, height: 100, borderRadius: "50%",
              background: target?.color || "#007AFF", color: "#fff",
              fontSize: 36, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {target?.initials || "?"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{target?.name || "Waiting..."}</div>
            <div style={{ fontSize: 13 }}>Waiting for others to join...</div>
          </div>
        )}
        {peerEntries.map(([peerId, stream]) => (
          <PeerVideo key={peerId} peerId={peerId} stream={stream} isAudioOnly={isAudioOnly} />
        ))}
      </div>

      {/* Local video PiP */}
      {!isAudioOnly && (
        <div style={{
          position: "absolute", bottom: 100, right: 20,
          width: 180, height: 135, borderRadius: 12,
          overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)",
          background: "#111",
        }} data-testid="local-video-pip">
          <video
            ref={localVideoRef}
            autoPlay muted playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
          {camOff && (
            <div style={{
              position: "absolute", inset: 0, background: "#222",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.5)", fontSize: 12,
            }}>Camera Off</div>
          )}
          <div style={{
            position: "absolute", bottom: 4, left: 4,
            fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.6)",
            padding: "2px 6px", borderRadius: 4,
          }}>You</div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        padding: "16px 0", display: "flex", justifyContent: "center", gap: 16,
        background: "rgba(255,255,255,0.05)", borderTop: "1px solid rgba(255,255,255,0.1)",
      }}>
        <button onClick={handleMute} data-testid="videocall-mic"
          style={ctrlBtn(muted ? "#FF3B30" : "rgba(255,255,255,0.15)")}>
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        {!isAudioOnly && (
          <button onClick={handleCam} data-testid="videocall-cam"
            style={ctrlBtn(camOff ? "#FF3B30" : "rgba(255,255,255,0.15)")}>
            {camOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}
        <button onClick={handleEnd} data-testid="videocall-end"
          style={{ ...ctrlBtn("#FF3B30"), width: 72 }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

// Individual peer video element
function PeerVideo({ peerId, stream, isAudioOnly }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (isAudioOnly) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#1a1a1a", borderRadius: 8, minHeight: 200,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "#333", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 24, fontWeight: 700,
        }}>
          <Mic size={28} />
        </div>
        {/* Hidden audio element */}
        <audio ref={videoRef} autoPlay playsInline style={{ display: "none" }} />
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", background: "#111", borderRadius: 8, overflow: "hidden", minHeight: 200,
    }}>
      <video
        ref={videoRef}
        autoPlay playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

const ctrlBtn = (bg) => ({
  width: 56, height: 56, borderRadius: "50%", border: "none",
  background: bg, color: "#fff", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "background 0.2s",
});

const headerBtn = {
  width: 32, height: 32, borderRadius: 8, border: "none",
  background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
