import React, { useMemo } from "react";
import { FileText, Image, Video, Music, Link2, StickyNote, Sheet, Presentation, HeartHandshake, Sparkles } from "lucide-react";
import { resolveScene, seatCountForTable, seatPositions, tableGeometryFor } from "../../lib/scenes";
import { seedForUser } from "../../lib/avatars";
import { SeatedFigure } from "./Figure";
import useStageFit from "./useStageFit";
import "../../styles/venue.css";

const ITEM_ICONS = {
  photo: <Image size={16} />,
  document: <FileText size={16} />,
  video: <Video size={16} />,
  audio: <Music size={16} />,
  link: <Link2 size={16} />,
  note: <StickyNote size={16} />,
  spreadsheet: <Sheet size={16} />,
  presentation: <Presentation size={16} />,
  prayer: <HeartHandshake size={16} />,
  intention: <Sparkles size={16} />,
};

const TYPE_COLOR = {
  photo: "#34C759", document: "#007AFF", video: "#FF3B30", audio: "#AF52DE",
  link: "#5AC8FA", note: "#FFCC00", spreadsheet: "#FF9500", presentation: "#FF2D55",
  prayer: "#AF52DE", intention: "#FFCC00",
};

// The stage the whole room is composed inside. Everything — table, chairs,
// labels — is placed in these coordinates and then scaled to fit the card, so
// a chair can never drift away from the table it belongs to.
const STAGE_W = 900;
const STAGE_H = 560;
const TABLE_CY = STAGE_H * 0.56;

/**
 * RoundTableViz — the live room.
 *
 * Guests sit *in the chairs around the table*, drawn as full figures rather
 * than floating discs: far-side guests face the camera, near-side guests are
 * seen from behind, and both scale with depth. Seat geometry comes from
 * lib/scenes so a long table seats people down its edges and a round table
 * seats them on its ring.
 *
 * Props:
 *   table:          full table doc (with members[], items[], scene{})
 *   seats:          [{seat_index, user_id, claimed_at}]
 *   currentUserId:  string id of the viewer (used for highlight + claim/leave UX)
 *   onClaimSeat:    (seatIndex) => void   — claim a free seat
 *   onLeaveSeat:    () => void            — release my seat
 *   onMemberClick:  (member) => void
 *   gestures:       { [userId]: gestureId }
 */
export default function RoundTableViz({ table, seats = [], currentUserId, onClaimSeat, onLeaveSeat, onMemberClick, gestures = {} }) {
  const scene = useMemo(() => resolveScene(table?.scene), [table?.scene]);
  const live = !!table?.active;
  const members = useMemo(() => table?.members || [], [table?.members]);
  const items = table?.items || [];
  const seatCount = seatCountForTable(scene.table.id);
  const geo = tableGeometryFor(scene.table.id);
  const { ref: stageRef, scale: stageScale } = useStageFit(STAGE_W, STAGE_H);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const seatByIndex = useMemo(() => Object.fromEntries(seats.map((s) => [s.seat_index, s])), [seats]);
  const myCurrentSeat = useMemo(() => seats.find((s) => s.user_id === currentUserId), [seats, currentUserId]);
  const placements = useMemo(() => seatPositions(scene.table.id, seatCount), [scene.table.id, seatCount]);
  const freeSeatIndexes = useMemo(
    () => Array.from({ length: seatCount }, (_, index) => index).filter((index) => !seatByIndex[index]),
    [seatCount, seatByIndex],
  );

  // Far-side chairs are drawn first so the tabletop overlaps them; near-side
  // chairs are drawn last so they sit in front of it. That single ordering is
  // what makes the table read as a solid object.
  const behind = placements.map((p, i) => ({ ...p, i })).filter((p) => p.depth < 0.5);
  const infront = placements.map((p, i) => ({ ...p, i })).filter((p) => p.depth >= 0.5);

  const renderSeat = (placement) => {
    const i = placement.i;
    const seat = seatByIndex[i];
    const occupant = seat ? memberById[seat.user_id] : null;
    const isMine = !!seat && seat.user_id === currentUserId;
    const isClaimable = !seat && !myCurrentSeat;
    const isMoveTarget = !seat && !!myCurrentSeat;
    const interactive = !!occupant || isClaimable || isMoveTarget;

    // Depth scaling — the far side of the table sits further from the lens.
    const scale = 0.74 + placement.depth * 0.36;
    const figureSize = 74 * scale;

    const handleClick = () => {
      if (occupant) {
        if (isMine) onLeaveSeat?.();
        else onMemberClick?.(occupant);
      } else if (onClaimSeat) {
        onClaimSeat(i);
      }
    };

    let label = `Seat ${i + 1}`;
    if (occupant) label = isMine ? "Click to leave this seat" : occupant.name;
    else if (isClaimable) label = `Claim seat ${i + 1}`;
    else if (isMoveTarget) label = `Move to seat ${i + 1}`;

    return (
      <button
        key={`seat-${i}`}
        type="button"
        className={`rt-seat-slot${occupant ? " is-taken" : " is-open"}${isMine ? " is-mine" : ""}`}
        onClick={handleClick}
        disabled={!interactive}
        data-testid={`rt-seat-${i}`}
        title={label}
        aria-label={label}
        style={{
          left: STAGE_W / 2 + placement.x,
          top: TABLE_CY + placement.y,
          zIndex: 10 + Math.round(placement.depth * 20),
          "--seat-scale": scale,
        }}
      >
        {occupant ? (
          <>
            <SeatedFigure
              seed={seedForUser(occupant)}
              view={placement.depth >= 0.5 ? "back" : "front"}
              pose={gestures[occupant.id] || "idle"}
              size={figureSize}
              highlight={isMine}
              title={occupant.name}
            />
            <span className="rt-seat-slot__name">
              {occupant.name.split(" ")[0]}
              {occupant.status === "online" && <i className="rt-seat-slot__online" aria-hidden="true" />}
            </span>
          </>
        ) : (
          <EmptyChair number={i + 1} scale={scale} interactive={interactive} />
        )}
      </button>
    );
  };

  return (
    <div className="rt-venue rt-venue--table" data-testid="rt-room" style={{ "--venue-accent": scene.room.accent || "#E3B778" }}>
      <div className="rt-venue__backdrop" style={{ backgroundImage: `url("${scene.room.image}")` }} />
      <div className="rt-venue__vignette" />
      <div className="rt-venue__ambient" style={{ background: scene.ambiance.overlay }} />

      <div className="rt-venue__chips" data-testid="rt-scene-chips">
        <SceneChip label={scene.room.name} />
        <SceneChip label={scene.ambiance.name} dot={scene.ambiance.color} />
        <SceneChip label={scene.music.name} />
        {scene.food.id !== "none" && <SceneChip label={scene.food.name} />}
      </div>

      <div className={`rt-venue__live${live ? " is-live" : ""}`}>
        {live && <span className="rt-venue__live-dot" />}
        {live ? "LIVE" : "DORMANT"}
      </div>

      <div className="rt-venue__stage" ref={stageRef}>
        <div
          className="rt-venue__scaler"
          style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${stageScale})` }}
        >
          <div className="rt-floor" />
          {live && (
            <div
              className="rt-table-glow"
              style={{
                left: STAGE_W / 2, top: TABLE_CY,
                width: geo.width + 110, height: (geo.depth + 100) * 0.62,
                background: `radial-gradient(closest-side, transparent 52%, ${scene.ambiance.color}24 76%, transparent)`,
              }}
            />
          )}

          {behind.map(renderSeat)}

          <div
            className="rt-table"
            data-testid="rt-table"
            style={{ left: STAGE_W / 2, top: TABLE_CY, width: geo.width, height: geo.depth * 0.62 }}
          >
            <img className="rt-table__top" src={scene.table.image} alt="" />
            <div className="rt-table__sheen" />
            <div className="rt-table__plate">
              <span className="rt-table__setting" aria-hidden="true">{scene.tabletop.icon}</span>
              <strong>{table?.name}</strong>
              <small>{scene.tabletop.name} · {seats.length}/{seatCount} seated</small>
            </div>

            {items.slice(0, 6).map((it, index) => {
              const shown = Math.max(items.slice(0, 6).length, 3);
              const angle = (index * (360 / shown) - 90) * (Math.PI / 180);
              return (
                <div
                  key={it.id}
                  className="rt-table__item"
                  title={it.name}
                  data-testid={`rt-item-${it.id}`}
                  style={{
                    left: `${50 + Math.cos(angle) * 30}%`,
                    top: `${50 + Math.sin(angle) * 26}%`,
                    color: TYPE_COLOR[it.type] || "#007AFF",
                  }}
                >
                  {ITEM_ICONS[it.type] || <FileText size={16} />}
                </div>
              );
            })}
          </div>

          {infront.map(renderSeat)}

          {(table?.pending_invites || []).slice(0, freeSeatIndexes.length).map((invite, index) => {
            const seatIndex = freeSeatIndexes[index];
            if (seatIndex === undefined) return null;
            const placement = placements[seatIndex];
            return (
              <div
                key={invite.id}
                className="rt-seat-pending"
                data-testid={`rt-pending-${invite.id}`}
                title={`${invite.name} — invitation pending`}
                style={{
                  left: STAGE_W / 2 + placement.x,
                  top: TABLE_CY + placement.y,
                  zIndex: 10 + Math.round(placement.depth * 20),
                }}
              >
                <span>{invite.initials}</span>
                <small>{invite.name} · invited</small>
              </div>
            );
          })}
        </div>
      </div>

      {!myCurrentSeat && members.length > 0 && (
        <div className="rt-venue__hint">Choose an open chair to take your place at the table</div>
      )}
    </div>
  );
}

function EmptyChair({ number, scale, interactive }) {
  return (
    <span className="rt-chair" style={{ transform: `scale(${scale})` }}>
      <svg viewBox="0 0 100 120" width="72" height="86" aria-hidden="true" focusable="false">
        <path d="M24 118 q-3 -46 26 -46 q29 0 26 46 z" fill="rgba(20,14,8,0.72)" stroke="rgba(227,183,120,0.42)" strokeWidth="2" strokeDasharray="7 6" />
        <ellipse cx="50" cy="112" rx="30" ry="7" fill="rgba(0,0,0,0.45)" />
      </svg>
      <span className="rt-chair__number">{interactive ? "Sit" : number}</span>
    </span>
  );
}

function SceneChip({ label, dot }) {
  return (
    <span className="rt-chip">
      {dot && <i style={{ background: dot }} />}
      {label}
    </span>
  );
}
