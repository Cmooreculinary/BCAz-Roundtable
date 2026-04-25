import React, { useMemo } from "react";
import { FileText, Image, Video, Music, Link2, StickyNote, Sheet, Presentation, HeartHandshake, Sparkles } from "lucide-react";
import { resolveScene, seatCountForTable } from "../../lib/scenes";
import UserAvatar from "../UserAvatar";

const ITEM_ICONS = {
  photo: <Image size={18} />,
  document: <FileText size={18} />,
  video: <Video size={18} />,
  audio: <Music size={18} />,
  link: <Link2 size={18} />,
  note: <StickyNote size={18} />,
  spreadsheet: <Sheet size={18} />,
  presentation: <Presentation size={18} />,
  prayer: <HeartHandshake size={18} />,
  intention: <Sparkles size={18} />,
};

const TYPE_COLOR = {
  photo: "#34C759", document: "#007AFF", video: "#FF3B30", audio: "#AF52DE",
  link: "#5AC8FA", note: "#FFCC00", spreadsheet: "#FF9500", presentation: "#FF2D55",
  prayer: "#AF52DE", intention: "#FFCC00",
};

/**
 * RoundTableViz — Iteration 18.
 * Renders a real Round Table inside its scene (room background, wood-grain table,
 * fixed seat slots for the table type). Members claim seats; empty seats are dashed.
 *
 * Props:
 *   table:          full table doc (with members[], items[], scene{})
 *   seats:          [{seat_index, user_id, claimed_at}]
 *   currentUserId:  string id of the viewer (used for highlight + claim/leave UX)
 *   onClaimSeat:    (seatIndex) => void   — claim a free seat
 *   onLeaveSeat:    () => void            — release my seat
 *   onMemberClick:  (member) => void
 */
export default function RoundTableViz({ table, seats = [], currentUserId, onClaimSeat, onLeaveSeat, onMemberClick }) {
  const scene = useMemo(() => resolveScene(table?.scene), [table?.scene]);
  const live = !!table?.active;
  const members = table?.members || [];
  const items = table?.items || [];
  const seatCount = seatCountForTable(scene.table.id);

  // Index members by id for quick lookup when rendering a claimed seat
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const seatByIndex = useMemo(() => Object.fromEntries(seats.map((s) => [s.seat_index, s])), [seats]);
  const myCurrentSeat = useMemo(() => seats.find((s) => s.user_id === currentUserId), [seats, currentUserId]);

  // Sizing: room ~600px wide, table sits at center
  const ROOM = 580;
  const TABLE = 260;
  const SEAT = 56;
  const SEAT_RADIUS = TABLE / 2 + 56; // outside table edge

  return (
    <div className="rt-room" data-testid="rt-room" style={{
      position: "relative",
      width: "100%", minHeight: ROOM,
      borderRadius: 18,
      overflow: "hidden",
      background: scene.room.gradient,
      boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
    }}>
      {/* Ambiance overlay — warm/jazz/etc */}
      <div style={{ position: "absolute", inset: 0, background: scene.ambiance.overlay, pointerEvents: "none" }} />

      {/* Top-left scene chips */}
      <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6, flexWrap: "wrap" }} data-testid="rt-scene-chips">
        <SceneChip label={scene.room.name} />
        <SceneChip label={scene.ambiance.name} dot={scene.ambiance.color} />
        <SceneChip label={scene.music.name} />
        {scene.food.id !== "none" && <SceneChip label={scene.food.name} />}
      </div>

      {/* Live/dormant badge top-right */}
      <div style={{ position: "absolute", top: 14, right: 14 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: live ? "rgba(52,199,89,0.18)" : "rgba(255,255,255,0.08)",
          color: live ? "#34C759" : "rgba(255,255,255,0.55)",
          border: `1px solid ${live ? "rgba(52,199,89,0.35)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(10px)",
        }}>
          {live && <span style={{ width: 6, height: 6, borderRadius: 3, background: "#34C759", boxShadow: "0 0 6px #34C759" }} />}
          {live ? "LIVE" : "DORMANT"}
        </div>
      </div>

      {/* Centered stage with table + seats */}
      <div style={{
        position: "relative", width: "100%", minHeight: ROOM,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ position: "relative", width: ROOM, height: ROOM, maxWidth: "100%" }}>
          {/* Soft ambient glow if live */}
          {live && (
            <div style={{
              position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
              width: TABLE + 120, height: TABLE + 120, borderRadius: "50%",
              background: `radial-gradient(circle, ${scene.ambiance.color}22 0%, transparent 70%)`,
              animation: "rt-pulse 3s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}

          {/* The wood-grain table */}
          <div data-testid="rt-table" style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
            width: TABLE, height: TABLE, borderRadius: "50%",
            background: scene.table.wood,
            boxShadow: "0 14px 40px rgba(0,0,0,0.55), inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -8px 20px rgba(0,0,0,0.35)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            color: scene.table.id === "luncheon" ? "#3a3a3c" : "rgba(255,255,255,0.9)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 6 }}>{scene.tabletop.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{table?.name}</div>
            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
              {scene.tabletop.name} · {seats.length}/{seatCount} seated
            </div>

            {/* Items on the table surface (max 6 to keep it tidy) */}
            {items.slice(0, 6).map((it, i) => {
              const angle = (i * (360 / Math.max(items.slice(0, 6).length, 3)) - 90) * (Math.PI / 180);
              const r = TABLE * 0.32;
              const x = TABLE / 2 + Math.cos(angle) * r;
              const y = TABLE / 2 + Math.sin(angle) * r;
              return (
                <div
                  key={it.id}
                  title={it.name}
                  data-testid={`rt-item-${it.id}`}
                  style={{
                    position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)",
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(255,255,255,0.92)", color: TYPE_COLOR[it.type] || "#007AFF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  {ITEM_ICONS[it.type] || <FileText size={18} />}
                </div>
              );
            })}
          </div>

          {/* Fixed seat slots — Anchor 2 */}
          {Array.from({ length: seatCount }).map((_, i) => {
            const angle = (i * (360 / seatCount) - 90) * (Math.PI / 180);
            const x = ROOM / 2 + Math.cos(angle) * SEAT_RADIUS - SEAT / 2;
            const y = ROOM / 2 + Math.sin(angle) * SEAT_RADIUS - SEAT / 2;
            const seat = seatByIndex[i];
            const occupant = seat ? memberById[seat.user_id] : null;
            const isMine = seat && seat.user_id === currentUserId;
            const isClaimable = !seat && !myCurrentSeat;
            const isMoveTarget = !seat && !!myCurrentSeat;

            const handleClick = () => {
              if (occupant) {
                if (isMine) onLeaveSeat?.();
                else onMemberClick?.(occupant);
              } else if (onClaimSeat) {
                onClaimSeat(i);
              }
            };

            return (
              <button
                key={i}
                onClick={handleClick}
                data-testid={`rt-seat-${i}`}
                title={
                  occupant ? (isMine ? "Click to leave this seat" : occupant.name)
                  : isClaimable ? `Claim seat ${i + 1}`
                  : isMoveTarget ? `Move to seat ${i + 1}`
                  : `Seat ${i + 1}`
                }
                style={{
                  position: "absolute", left: x, top: y,
                  width: SEAT, height: SEAT, borderRadius: "50%",
                  border: occupant
                    ? (isMine ? "3px solid #FFCC00" : `3px solid ${occupant.color || "#007AFF"}55`)
                    : "2px dashed rgba(255,255,255,0.32)",
                  background: occupant
                    ? "transparent"
                    : (isClaimable || isMoveTarget) ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  cursor: occupant ? (isMine ? "pointer" : "default") : (isClaimable || isMoveTarget ? "pointer" : "default"),
                  padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700,
                  transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s, background 0.2s",
                  transform: occupant ? "scale(1)" : "scale(0.92)",
                  boxShadow: occupant
                    ? (isMine ? "0 0 0 4px rgba(255,204,0,0.25), 0 6px 20px rgba(0,0,0,0.4)" : "0 6px 18px rgba(0,0,0,0.4)")
                    : "none",
                }}
              >
                {occupant ? (
                  <UserAvatar user={occupant} size={SEAT - 6} style={{ borderRadius: "50%" }} />
                ) : (
                  <span aria-hidden style={{ opacity: 0.5 }}>{i + 1}</span>
                )}
                {occupant && occupant.status === "online" && (
                  <span style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#34C759", border: "2px solid rgba(0,0,0,0.5)",
                  }} />
                )}
              </button>
            );
          })}

          {/* Member name labels under occupied seats */}
          {Array.from({ length: seatCount }).map((_, i) => {
            const seat = seatByIndex[i];
            const occupant = seat ? memberById[seat.user_id] : null;
            if (!occupant) return null;
            const angle = (i * (360 / seatCount) - 90) * (Math.PI / 180);
            const x = ROOM / 2 + Math.cos(angle) * SEAT_RADIUS;
            const y = ROOM / 2 + Math.sin(angle) * SEAT_RADIUS + SEAT / 2 + 6;
            return (
              <div
                key={`label-${i}`}
                style={{
                  position: "absolute", left: x, top: y,
                  transform: "translateX(-50%)",
                  fontSize: 10, fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {occupant.name.split(" ")[0]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom helper text */}
      {!myCurrentSeat && members.length > 0 && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          padding: "6px 14px", borderRadius: 20,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
          fontSize: 11, color: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}>
          Click a dashed seat to take your place at the table
        </div>
      )}

      <style>{`
        @keyframes rt-pulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%,-50%) scale(1); }
          50%      { opacity: 0.8; transform: translate(-50%,-50%) scale(1.04); }
        }
      `}</style>
    </div>
  );
}

function SceneChip({ label, dot }) {
  return (
    <div style={{
      padding: "5px 12px", borderRadius: 20, fontSize: 11,
      background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.08)",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />}
      {label}
    </div>
  );
}
