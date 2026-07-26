import React, { useMemo } from "react";
import { portraitTraits } from "../../lib/avatars";
import "../../styles/figures.css";

/**
 * The people in a room.
 *
 * <SeatedFigure> is a guest in a chair at a table. <AudienceFigure> is a guest
 * in a house seat seen from the back of the room. Both are drawn from the same
 * portrait traits as the person's avatar, so the face in the roster is the
 * person in the chair.
 *
 * `pose` is the live gesture — the SVG holds the shape, figures.css holds the
 * motion, so a pose costs nothing until someone actually plays it.
 */

const FRONT_ARM = "M24 68 q11 -4 13 6 l3 29 q1 8 -6 9 q-7 1 -8 -7 l-4 -29 z";
const FRONT_HAND = { cx: 29.5, cy: 105, r: 5.4 };

export function SeatedFigure({
  seed,
  view = "front",
  pose = "idle",
  size = 84,
  highlight = false,
  title,
}) {
  const t = useMemo(() => portraitTraits(seed), [seed]);
  const cls = `rt-fig rt-fig--${pose}${highlight ? " is-me" : ""}`;

  return (
    <svg
      className={cls}
      viewBox="0 0 100 130"
      width={size}
      height={size * 1.3}
      role="img"
      aria-label={title || "Seated guest"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {/* Chair — behind a guest we face, in front of a guest we sit behind. */}
      {view === "front" && <ChairBack traits={t} />}

      <g className="rt-fig__body">
        <path d="M18 130 q1 -38 32 -46 q31 8 32 46 z" fill={t.suit.main} />
        <path d="M50 84 q-8 4 -11 12 q6 -2 11 -3 q5 1 11 3 q-3 -8 -11 -12 z" fill={t.shirt} opacity={view === "front" ? 1 : 0.15} />
        {view === "front" && t.tie && <path d="M50 92 l4 5 l-4 20 l-4 -20 z" fill={t.tie} />}
      </g>

      <Arm side="l" traits={t} />
      <Arm side="r" traits={t} />

      <g className="rt-fig__head">
        <path d="M43 74 h14 v11 q-7 5 -14 0 z" fill={t.skin.shade} />
        {view === "front" ? <FrontHead traits={t} /> : <BackHead traits={t} />}
      </g>

      {view === "back" && <ChairBack traits={t} front />}

      {/* Amber rim light — the key light of every roundtable room. */}
      <path d="M74 44 q9 14 4 32" stroke="#E3B778" strokeWidth="3" fill="none" opacity="0.32" strokeLinecap="round" />
      <path d="M80 96 q8 8 9 26" stroke="#E3B778" strokeWidth="3.4" fill="none" opacity="0.14" strokeLinecap="round" />
    </svg>
  );
}

function Arm({ side, traits }) {
  return (
    <g transform={side === "r" ? "translate(100,0) scale(-1,1)" : undefined}>
      <g className={`rt-fig__arm rt-fig__arm--${side}`}>
        <path d={FRONT_ARM} fill={traits.suit.light} />
        <circle cx={FRONT_HAND.cx} cy={FRONT_HAND.cy} r={FRONT_HAND.r} fill={traits.skin.base} />
      </g>
    </g>
  );
}

function ChairBack({ traits, front = false }) {
  if (front) {
    return (
      <path
        d="M16 130 q0 -30 34 -30 q34 0 34 30 z"
        fill="#120C07"
        stroke="#3B2A17"
        strokeWidth="1.4"
        opacity="0.94"
      />
    );
  }
  return (
    <path
      d="M24 128 q-2 -44 26 -44 q28 0 26 44 z"
      fill="#150E08"
      stroke={traits.suit.trim}
      strokeWidth="1.2"
      opacity="0.85"
    />
  );
}

function FrontHead({ traits: t }) {
  return (
    <>
      <path d="M50 30 c-11 0 -18 9 -18 21 c0 13 8 24 18 24 c10 0 18 -11 18 -24 c0 -12 -7 -21 -18 -21 z" fill={t.skin.base} />
      <ellipse cx="32.5" cy="53" rx="3" ry="4.3" fill={t.skin.shade} />
      <ellipse cx="67.5" cy="53" rx="3" ry="4.3" fill={t.skin.shade} />
      <path d="M32 52 q0 -22 18 -22 q18 0 18 22 q-4 -11 -18 -11 q-14 0 -18 11 z" fill={t.hair} />
      <circle cx="43.5" cy="52" r="1.6" fill="#33200F" />
      <circle cx="56.5" cy="52" r="1.6" fill="#33200F" />
      <path d="M45 64 q5 3 10 0" stroke={t.skin.line} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {t.facialHair === "beard" && (
        <path d="M34 56 q1 22 16 22 q15 0 16 -22 q-4 16 -16 16 q-12 0 -16 -16 z" fill={t.hair} opacity="0.88" />
      )}
    </>
  );
}

function BackHead({ traits: t }) {
  return (
    <>
      <ellipse cx="50" cy="52" rx="18" ry="22" fill={t.hair} />
      <ellipse cx="50" cy="46" rx="14" ry="15" fill="#FFFFFF" opacity="0.06" />
      <path d="M32 56 q0 18 18 18 q18 0 18 -18 q-4 12 -18 12 q-14 0 -18 -12 z" fill="#000" opacity="0.3" />
      <ellipse cx="32.6" cy="55" rx="2.8" ry="4" fill={t.skin.shade} />
      <ellipse cx="67.4" cy="55" rx="2.8" ry="4" fill={t.skin.shade} />
      <path d="M43 72 h14 v4 q-7 3 -14 0 z" fill={t.skin.shade} />
    </>
  );
}

/**
 * A house seat. Drawn from behind, because in a theatre the camera sits with
 * the audience — which also makes every gesture readable: arms leave the
 * silhouette, a standing guest breaks the row line, a head shake rocks.
 */
export function AudienceFigure({ seed, pose = "idle", size = 26, highlight = false, title }) {
  const t = useMemo(() => portraitTraits(seed), [seed]);
  return (
    <svg
      className={`rt-fig rt-aud rt-fig--${pose}${highlight ? " is-me" : ""}`}
      viewBox="0 0 60 92"
      width={size}
      height={size * 1.53}
      role="img"
      aria-label={title || "Audience member"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <g className="rt-fig__body">
        <path d="M6 92 q0 -30 24 -36 q24 6 24 36 z" fill={t.suit.main} />
        <path d="M6 92 q0 -30 24 -36 q6 1.5 10 4 q-16 8 -16 32 z" fill={t.suit.light} opacity="0.5" />
      </g>
      <g transform="translate(60,0) scale(-1,1)">
        <g className="rt-fig__arm rt-fig__arm--r">
          <path d="M8 58 q8 -3 10 5 l2 22 q1 6 -5 7 q-6 1 -6 -6 l-3 -22 z" fill={t.suit.light} />
          <circle cx="12" cy="84" r="4.2" fill={t.skin.base} />
        </g>
      </g>
      <g className="rt-fig__arm rt-fig__arm--l">
        <path d="M8 58 q8 -3 10 5 l2 22 q1 6 -5 7 q-6 1 -6 -6 l-3 -22 z" fill={t.suit.light} />
        <circle cx="12" cy="84" r="4.2" fill={t.skin.base} />
      </g>
      <g className="rt-fig__head">
        <path d="M25 48 h10 v8 q-5 4 -10 0 z" fill={t.skin.shade} />
        <ellipse cx="30" cy="33" rx="12.5" ry="14.5" fill={t.hair} />
        <path d="M18 37 q0 11 12 11 q12 0 12 -11 q-3 7 -12 7 q-9 0 -12 -7 z" fill="#000" opacity="0.34" />
        <path d="M37 24 q6 8 3 19" stroke="#E3B778" strokeWidth="2.4" fill="none" opacity="0.45" strokeLinecap="round" />
      </g>
      <path d="M4 92 q0 -16 26 -16 q26 0 26 16 z" fill="#0B0704" opacity="0.9" />
    </svg>
  );
}

export default SeatedFigure;
