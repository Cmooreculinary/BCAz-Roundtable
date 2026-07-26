// /app/frontend/src/lib/avatars.js
// Roundtable portraits — the cinematic avatar set.
//
// Every portrait is generated from a seed, so a person keeps the same face
// everywhere without a single network request or image asset. The palette is
// the warm-obsidian key of the roundtable rooms: dark tailoring, low fill, an
// amber rim light off the right shoulder.
//
// Two shapes are produced from the same traits:
//   • portraitDataUri() — a head-and-shoulders bust for pickers and rosters.
//   • the traits themselves — consumed by <SeatedFigure>/<AudienceFigure>,
//     which draw whole bodies that can hold a pose.

export const PORTRAIT_PREFIX = "rtp:v1:";

const SKINS = [
  { base: "#F0D3B8", shade: "#D9AF8E", line: "#8A5F42" },
  { base: "#E6BC96", shade: "#C9986F", line: "#7C5237" },
  { base: "#D2A177", shade: "#B07E55", line: "#6A422A" },
  { base: "#B57C4F", shade: "#8E5C36", line: "#4F2E1B" },
  { base: "#8C5A34", shade: "#6B4023", line: "#3A2013" },
  { base: "#5D3620", shade: "#442513", line: "#26140B" },
];

// Weighted: dark hair repeats, so grey and blond stay occasional rather than
// dominating a crowd of small silhouettes.
const HAIRS = [
  "#15100C", "#2B1D14", "#452B1A", "#6E4A2A",
  "#15100C", "#2B1D14", "#452B1A", "#241812",
  "#1E1712", "#33241A", "#5A3A22", "#8E7462",
  "#B9AB98",
];

const SUITS = [
  { main: "#191920", light: "#26262F", trim: "#0F0F14" },
  { main: "#141C2B", light: "#213048", trim: "#0C1220" },
  { main: "#26262B", light: "#35353D", trim: "#171719" },
  { main: "#241A14", light: "#33261C", trim: "#160F0A" },
  { main: "#1D242A", light: "#2B343C", trim: "#111619" },
];

const SHIRTS = ["#EFE7D8", "#FBF7EF", "#C6D5E6", "#1B1B20"];
const TIES = ["#C9954E", "#7A2230", "#1E3A5F", "#3A3A42", null];

const HAIR_STYLES = ["crop", "part", "buzz", "curls", "bun", "long", "waves", "receding"];
const FACIAL_HAIR = ["none", "none", "none", "stubble", "beard", "moustache"];

/** Small deterministic string hash — same seed always yields the same face. */
function hashSeed(seed) {
  const text = String(seed ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Pull a stable pseudo-random index out of the seed hash, one axis at a time.
 * Each axis is re-mixed rather than sliced off the same number, so hair colour
 * and suit colour don't move together across a crowd.
 */
function pick(hash, axis, list) {
  let x = (hash ^ Math.imul(axis + 1, 0x9e3779b9)) >>> 0;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  return list[x % list.length];
}

export function portraitTraits(seed) {
  const hash = hashSeed(seed);
  const style = pick(hash, 3, HAIR_STYLES);
  return {
    seed: String(seed ?? ""),
    skin: pick(hash, 0, SKINS),
    hair: pick(hash, 1, HAIRS),
    suit: pick(hash, 2, SUITS),
    hairStyle: style,
    shirt: pick(hash, 4, SHIRTS),
    tie: pick(hash, 5, TIES),
    facialHair: style === "bun" || style === "long" ? "none" : pick(hash, 6, FACIAL_HAIR),
    glasses: hash % 5 === 0,
    // Slight head tilt keeps a crowd from looking like a row of clones.
    tilt: ((hash >> 3) % 7) - 3,
  };
}

// ── Portrait bust (string SVG, used as a data URI) ──────────────────

function hairPath(style, hair) {
  switch (style) {
    case "buzz":
      return `<path d="M38 52 q0 -25 22 -25 q22 0 22 25 q-5 -9 -22 -9 q-17 0 -22 9 z" fill="${hair}" opacity="0.92"/>`;
    case "part":
      return `<path d="M37 54 q-1 -28 23 -28 q23 0 22 26 q-7 -16 -26 -13 q-11 2 -19 15 z" fill="${hair}"/>`;
    case "curls":
      return `<g fill="${hair}"><circle cx="45" cy="35" r="9"/><circle cx="58" cy="29" r="10"/><circle cx="71" cy="35" r="9"/><circle cx="39" cy="45" r="7"/><circle cx="80" cy="45" r="7"/></g>`;
    case "bun":
      return `<g fill="${hair}"><circle cx="60" cy="19" r="9"/><path d="M37 52 q0 -27 23 -27 q23 0 23 27 q-6 -13 -23 -13 q-17 0 -23 13 z"/></g>`;
    case "long":
      return `<g fill="${hair}"><path d="M35 90 q-2 -40 25 -40 q27 0 25 40 q-8 4 -12 0 q4 -26 -13 -30 q-17 4 -13 30 q-4 4 -12 0 z"/><path d="M37 52 q0 -27 23 -27 q23 0 23 27 q-6 -14 -23 -14 q-17 0 -23 14 z"/></g>`;
    case "waves":
      return `<g fill="${hair}"><path d="M36 78 q-3 -34 24 -34 q27 0 24 34 q-6 -6 -9 -1 q3 -22 -15 -24 q-18 2 -15 24 q-3 -5 -9 1 z"/><path d="M37 52 q1 -27 23 -27 q22 0 23 26 q-8 -13 -23 -13 q-15 0 -23 14 z"/></g>`;
    case "receding":
      return `<path d="M38 56 q0 -14 7 -20 q-2 9 -1 15 q-3 2 -6 5 z M82 56 q0 -14 -7 -20 q2 9 1 15 q3 2 6 5 z" fill="${hair}"/>`;
    default:
      return `<path d="M38 53 q0 -27 22 -27 q22 0 22 27 q-5 -13 -22 -13 q-17 0 -22 13 z" fill="${hair}"/>`;
  }
}

function facialHairPath(kind, hair, skin) {
  if (kind === "stubble") return `<path d="M42 60 q0 24 18 24 q18 0 18 -24 q-3 18 -18 18 q-15 0 -18 -18 z" fill="${hair}" opacity="0.22"/>`;
  if (kind === "beard") return `<path d="M41 56 q1 30 19 30 q18 0 19 -30 q-4 22 -19 22 q-15 0 -19 -22 z" fill="${hair}" opacity="0.9"/><path d="M53 71 q7 4 14 0 q-2 6 -7 6 q-5 0 -7 -6 z" fill="${skin.line}" opacity="0.5"/>`;
  if (kind === "moustache") return `<path d="M52 68 q8 -4 16 0 q-3 4 -8 4 q-5 0 -8 -4 z" fill="${hair}" opacity="0.9"/>`;
  return "";
}

/** The bust markup, shared by the data URI builder. */
function bustMarkup(t, id) {
  const { skin, suit } = t;
  const tie = t.tie
    ? `<path d="M60 96 l5 6 l-5 22 l-5 -22 z" fill="${t.tie}"/><path d="M60 92 l5 4 l-5 4 l-5 -4 z" fill="${t.tie}" opacity="0.85"/>`
    : "";
  const glasses = t.glasses
    ? `<g fill="none" stroke="#D8C7A8" stroke-width="1.6" opacity="0.85"><rect x="45" y="48" width="13" height="10" rx="4"/><rect x="62" y="48" width="13" height="10" rx="4"/><path d="M58 52 h4"/></g>`
    : "";

  return `
    <defs>
      <radialGradient id="bg${id}" cx="50%" cy="34%" r="72%">
        <stop offset="0%" stop-color="#2A1E12"/>
        <stop offset="60%" stop-color="#140E08"/>
        <stop offset="100%" stop-color="#0A0705"/>
      </radialGradient>
      <linearGradient id="sk${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${skin.base}"/>
        <stop offset="100%" stop-color="${skin.shade}"/>
      </linearGradient>
      <linearGradient id="st${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${suit.light}"/>
        <stop offset="100%" stop-color="${suit.trim}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" fill="url(#bg${id})"/>
    <ellipse cx="60" cy="118" rx="52" ry="26" fill="#E3B778" opacity="0.05"/>
    <g transform="rotate(${t.tilt} 60 60)">
      <path d="M8 120 q1 -24 21 -31 l19 -7 l12 13 l12 -13 l19 7 q20 7 21 31 z" fill="url(#st${id})"/>
      <path d="M48 82 q12 7 24 0 l3 5 q-15 9 -30 0 z" fill="${t.shirt}"/>
      <path d="M47 83 L60 99 L53 120 L30 120 q0 -23 17 -37 z" fill="${suit.main}"/>
      <path d="M73 83 L60 99 L67 120 L90 120 q0 -23 -17 -37 z" fill="${suit.main}"/>
      ${tie}
      <path d="M52 72 h16 v14 q-8 6 -16 0 z" fill="${skin.shade}"/>
      <path d="M52 72 h16 v6 q-8 5 -16 0 z" fill="${skin.line}" opacity="0.35"/>
      <path d="M60 26 c-13 0 -22 11 -22 25 c0 16 10 29 22 29 c12 0 22 -13 22 -29 c0 -14 -9 -25 -22 -25 z" fill="url(#sk${id})"/>
      <ellipse cx="38" cy="56" rx="3.6" ry="5.2" fill="${skin.shade}"/>
      <ellipse cx="82" cy="56" rx="3.6" ry="5.2" fill="${skin.shade}"/>
      ${hairPath(t.hairStyle, t.hair)}
      <path d="M47 47 q6 -3 11 0" stroke="${t.hair}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"/>
      <path d="M62 47 q5 -3 11 0" stroke="${t.hair}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"/>
      <ellipse cx="52" cy="54" rx="3.4" ry="2.4" fill="#FBF4E8" opacity="0.9"/>
      <ellipse cx="68" cy="54" rx="3.4" ry="2.4" fill="#FBF4E8" opacity="0.9"/>
      <circle cx="52.6" cy="54.2" r="1.7" fill="#33200F"/>
      <circle cx="68.6" cy="54.2" r="1.7" fill="#33200F"/>
      <path d="M60 55 l-2.6 8 q2.6 1.8 5.2 0" stroke="${skin.line}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.65"/>
      <path d="M54 69 q6 3.6 12 0" stroke="${skin.line}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      ${facialHairPath(t.facialHair, t.hair, skin)}
      ${glasses}
      <path d="M80 38 q9 16 3 36" stroke="#E3B778" stroke-width="3.4" fill="none" opacity="0.34" stroke-linecap="round"/>
      <path d="M86 92 q10 8 12 28" stroke="#E3B778" stroke-width="4" fill="none" opacity="0.16" stroke-linecap="round"/>
    </g>`;
}

/** A finished portrait as an inline SVG data URI. */
export function portraitDataUri(seed) {
  const traits = portraitTraits(seed);
  const id = (hashSeed(seed) % 9973).toString(36);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${bustMarkup(traits, id)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

// ── Stored reference ────────────────────────────────────────────────
// A portrait is persisted as "rtp:v1:<seed>" rather than a multi-kilobyte data
// URI, so the profile record stays small and the art stays vector-sharp.

export function portraitRef(seed) {
  return `${PORTRAIT_PREFIX}${seed}`;
}

export function isPortraitRef(url) {
  return typeof url === "string" && url.startsWith(PORTRAIT_PREFIX);
}

export function seedFromRef(url) {
  return isPortraitRef(url) ? url.slice(PORTRAIT_PREFIX.length) : null;
}

/** Resolve any stored avatar value to something an <img> can display. */
export function avatarSrc(url) {
  if (isPortraitRef(url)) return portraitDataUri(seedFromRef(url));
  return url || null;
}

/**
 * The curated cast offered in the picker. Names are seeds, not labels — they
 * only need to be stable and varied.
 */
export const PORTRAIT_SEEDS = [
  "Harrison", "Adaeze", "Beatriz", "Callum", "Naomi", "Elias",
  "Priya", "Marcus", "Yuki", "Sofia", "Omar", "Grace",
  "Dominic", "Amara", "Theo", "Lena", "Jonah", "Ifeoma",
  "Rafael", "Hana", "Everett", "Simone", "Kwame", "Rosalind",
];

/**
 * Seat-filler portrait for a member who has not picked one. Derived from the
 * member's own id so an unclaimed face is still consistent between renders.
 */
export function seedForUser(user) {
  const stored = seedFromRef(user?.avatar_url);
  return stored || user?.id || user?.name || "guest";
}
