import React, { useMemo } from "react";
import { resolveScene, stageLayoutFor, AUDIENCE_ACTIONS } from "../../lib/scenes";
import { seedForUser } from "../../lib/avatars";
import { AudienceFigure, SeatedFigure } from "./Figure";
import useStageFit from "./useStageFit";
import "../../styles/venue.css";

const STAGE_W = 900;
const STAGE_H = 560;
const SCREEN_Y = 128;
const DECK_Y = 268;
const HOUSE_Y = 330;

/**
 * StageViz — the guest speaker theatre, the amphitheatre, and the arena.
 *
 * The room never changes shape: a lit deck and a screen at the back, the house
 * curving toward the camera. What changes is the audience, and every audience
 * member is a real figure that the person sitting in that seat controls — clap,
 * stand, raise a fist, or fold their arms and shake their head.
 *
 * Props:
 *   table:          full table doc (members[], scene{}, name)
 *   currentUserId:  the viewer
 *   gestures:       { [userId]: actionId } — live actions, keyed by member
 *   onAction:       (actionId) => void — plays an action for the viewer
 *   onMemberClick:  (member) => void
 */
export default function StageViz({ table, currentUserId, gestures = {}, onAction, onMemberClick }) {
  const scene = useMemo(() => resolveScene(table?.scene), [table?.scene]);
  const layout = useMemo(() => stageLayoutFor(scene.room.id), [scene.room.id]);
  const live = !!table?.active;
  const members = useMemo(() => table?.members || [], [table?.members]);
  const { ref: stageRef, scale: stageScale } = useStageFit(STAGE_W, STAGE_H);

  // The presenter holds the stage; everyone else is in the house.
  const presenter = useMemo(
    () => members.find((m) => m.id === table?.created_by) || members[0] || null,
    [members, table?.created_by],
  );
  const audienceMembers = useMemo(
    () => members.filter((m) => m.id !== presenter?.id),
    [members, presenter?.id],
  );

  const houseSeats = useMemo(() => buildHouse(layout), [layout]);

  // A house this size is never empty: real members take the seats nearest the
  // stage, and the rest of the room is filled with a generated crowd.
  const seating = useMemo(() => {
    return houseSeats.map((seat, index) => {
      const member = audienceMembers[index] || null;
      return { ...seat, member, seed: member ? seedForUser(member) : `house-${scene.room.id}-${index}` };
    });
  }, [houseSeats, audienceMembers, scene.room.id]);

  const myAction = gestures[currentUserId] || null;

  // When most of the named room is doing the same thing, the crowd joins in.
  const houseMood = useMemo(() => crowdMood(audienceMembers, gestures), [audienceMembers, gestures]);

  return (
    <div className="rt-venue rt-venue--stage" data-testid="rt-stage" style={{ "--venue-accent": scene.room.accent || "#E3B778" }}>
      <div className="rt-venue__backdrop" style={{ backgroundImage: `url("${scene.room.image}")` }} />
      <div className="rt-venue__vignette" />
      <div className="rt-venue__ambient" style={{ background: scene.ambiance.overlay }} />

      <div className="rt-venue__chips" data-testid="rt-scene-chips">
        <span className="rt-chip">{scene.room.name}</span>
        <span className="rt-chip"><i style={{ background: scene.ambiance.color }} />{scene.ambiance.name}</span>
        <span className="rt-chip">{scene.music.name}</span>
        <span className="rt-chip">{layout.label}</span>
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
          <div
            className="rt-stage-screen"
            style={{ left: STAGE_W / 2, top: SCREEN_Y, width: STAGE_W * layout.stageWidth }}
          >
            <span className="rt-stage-screen__eyebrow">BCA</span>
            <span className="rt-stage-screen__title">ROUND TABLE</span>
            <span className="rt-stage-screen__sub">{table?.name || "Perspectives that shape what's next."}</span>
          </div>

          <div
            className="rt-stage-beam"
            style={{ left: STAGE_W / 2 - 190, top: SCREEN_Y + 40, width: 380, height: DECK_Y - SCREEN_Y + 60 }}
          />

          <div
            className="rt-stage-deck"
            style={{ left: STAGE_W / 2, top: DECK_Y + 28, width: STAGE_W * 0.42, height: 86 }}
          />

          {presenter && (
            <button
              type="button"
              className="rt-presenter"
              style={{ left: STAGE_W / 2, top: DECK_Y + 30 }}
              onClick={() => onMemberClick?.(presenter)}
              title={`${presenter.name} — on stage`}
            >
              <SeatedFigure
                seed={seedForUser(presenter)}
                view="front"
                pose={gestures[presenter.id] || "stand"}
                size={104}
                highlight={presenter.id === currentUserId}
                title={presenter.name}
              />
              <span className="rt-presenter__name">{presenter.name} · on stage</span>
            </button>
          )}

          {seating.map((seat, index) => {
            const isMine = seat.member?.id === currentUserId;
            const pose = seat.member ? gestures[seat.member.id] || "idle" : houseMood.pose(index);
            const label = seat.member ? seat.member.name : "Guest";
            return (
              <button
                key={`house-${index}`}
                type="button"
                className={`rt-house-seat${isMine ? " is-me" : ""}`}
                style={{ left: seat.x, top: seat.y, zIndex: 20 + seat.row }}
                disabled={!seat.member}
                onClick={() => seat.member && onMemberClick?.(seat.member)}
                title={label}
                data-testid={seat.member ? `rt-house-${seat.member.id}` : undefined}
              >
                <AudienceFigure
                  seed={seat.seed}
                  pose={pose}
                  size={seat.size}
                  highlight={isMine}
                  title={label}
                />
                {isMine && <span className="rt-house-seat__ring" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rt-venue__count">
        <strong>{members.length}</strong> in the room · house of {layout.capacity}
      </div>

      {onAction && (
        <div className="rt-action-bar" data-testid="stage-action-bar" role="group" aria-label="Audience actions">
          {AUDIENCE_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`rt-action${myAction === action.id ? " is-active" : ""}`}
              onClick={() => onAction(action.id)}
              title={action.hint}
              aria-pressed={myAction === action.id}
              data-testid={`audience-${action.id}`}
            >
              <span aria-hidden="true">{action.mark}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lay the house out row by row, nearest the stage first. Rows bow around the
 * stage — the ends of a row sit closer to the camera than its middle — and each
 * row forward is wider, lower, and larger, which is what sells the depth.
 */
function buildHouse(layout) {
  const seats = [];
  const rowCount = layout.rows.length;

  layout.rows.forEach((count, row) => {
    const t = rowCount === 1 ? 0 : row / (rowCount - 1);
    const rowY = HOUSE_Y + row * layout.rowGap + t * t * 90;
    const rowWidth = STAGE_W * (0.42 + t * 0.62);
    const size = (18 + t * 16) * layout.figureScale;

    for (let i = 0; i < count; i += 1) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const offset = u - 0.5;
      seats.push({
        row,
        // Order within a row runs centre-out so the best seats fill first.
        rank: Math.abs(offset),
        x: STAGE_W / 2 + offset * rowWidth,
        y: rowY + Math.pow(Math.abs(offset) * 2, 2) * layout.curve * 72,
        size,
      });
    }
  });

  return seats.sort((a, b) => a.row - b.row || a.rank - b.rank);
}

/**
 * The generated crowd is not a still image — when the named guests in the room
 * mostly do one thing, the house follows, staggered so it ripples rather than
 * snapping in unison.
 */
function crowdMood(audienceMembers, gestures) {
  const played = audienceMembers.map((m) => gestures[m.id]).filter(Boolean);
  if (!played.length || played.length * 2 < audienceMembers.length) {
    return { pose: () => "idle" };
  }
  const tally = played.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  const [top] = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const winner = top?.[0] || "idle";
  return { pose: (index) => (index % 5 === 4 ? "idle" : winner) };
}
