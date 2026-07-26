// /app/frontend/src/lib/scenes.js
// Shared scene catalog — used by both standalone /gather demo and real /table/:id pages.
// Backend stores only the IDs; this file resolves IDs to visuals.
// Iteration 18 — single source of truth.
// Iteration 19 — venues gained a `kind`: table rooms seat people around a table,
// stage venues (theatre, amphitheatre, arena) seat an audience facing a speaker.

import { stageVenueArt } from "./venueArt";

export const ROOMS = [
  { id: "skyline", kind: "table", name: "Skyline Suite", image: "/scenes/skyline-suite.webp", gradient: "#111820", accent: "#76A9FF", description: "A private high-rise room above the city at blue hour." },
  { id: "dining", kind: "table", name: "Family Garden Room", image: "/scenes/family-dining.webp", gradient: "#8A684D", accent: "#E7B76A", description: "A warm contemporary home opening onto a landscaped garden." },
  { id: "studio", kind: "table", name: "Coastal Bay Room", image: "/scenes/coastal-bay.webp", gradient: "#8CA7B5", accent: "#83C7E8", description: "A bright, refined room overlooking open water." },
  { id: "library", kind: "table", name: "Fireside Library", image: "/scenes/fireside-library.webp", gradient: "#2A160D", accent: "#D9A34A", description: "Dark walnut, leather, firelight, and quiet conversation." },
  { id: "church", kind: "table", name: "Mountain Lodge", image: "/scenes/mountain-lodge.webp", gradient: "#2B211C", accent: "#E8A95C", description: "A timber lodge above snow-covered mountain country." },
  { id: "terrace", kind: "table", name: "Garden Terrace", image: "/scenes/garden-terrace.webp", gradient: "#243222", accent: "#E9AD54", description: "An open-air gathering lawn under mature trees and warm lights." },
];

// Stage venues — one speaker on a stage, everyone else in the audience.
// Artwork is generated, not shipped as binaries, so these venues work offline.
export const STAGE_VENUES = [
  {
    id: "theatre",
    kind: "stage",
    name: "Guest Speaker Theatre",
    image: stageVenueArt("theatre"),
    gradient: "#0C0805",
    accent: "#E3B778",
    description: "Intimate roundtable theatre with premium finishes and focused engagement.",
  },
  {
    id: "redrocks",
    kind: "stage",
    name: "Red Rocks Concert",
    image: stageVenueArt("redrocks"),
    gradient: "#140B07",
    accent: "#E8894A",
    description: "Open-air amphitheatre carved between monoliths under a night sky.",
  },
  {
    id: "arena",
    kind: "stage",
    name: "Large Arena",
    image: stageVenueArt("arena"),
    gradient: "#070A10",
    accent: "#8FB6F0",
    description: "Full-bowl arena with a centre stage, big screens, and a stadium crowd.",
  },
];

// Everything selectable in the venue picker, table rooms first.
export const VENUES = [...ROOMS, ...STAGE_VENUES];

// Stage geometry — rows curve around the stage, deeper rows hold more people.
export const STAGE_LAYOUTS = {
  theatre: {
    label: "Theatre",
    capacity: 220,
    rows: [10, 14, 18, 22, 26],
    curve: 0.34,
    rowGap: 34,
    figureScale: 1,
    stageWidth: 0.46,
    houseLight: "#E3B778",
  },
  redrocks: {
    label: "Amphitheatre",
    capacity: 320,
    rows: [12, 16, 20, 24, 28],
    curve: 0.28,
    rowGap: 30,
    figureScale: 0.92,
    stageWidth: 0.4,
    houseLight: "#E8894A",
  },
  arena: {
    label: "Arena bowl",
    capacity: 480,
    rows: [16, 22, 28, 34, 40],
    curve: 0.22,
    rowGap: 26,
    figureScale: 0.82,
    stageWidth: 0.34,
    houseLight: "#8FB6F0",
  },
};

export const TABLES = [
  { id: "mahogany", name: "Heritage Mahogany Round", image: "/tables/mahogany-round.png", color: "#6b2f17", wood: "#6b2f17" },
  { id: "executive", name: "Walnut Executive Board", image: "/tables/executive-board.png", color: "#3b1f14", wood: "#3b1f14" },
  { id: "family", name: "Black Oak Round", image: "/tables/black-round.png", color: "#151515", wood: "#151515" },
  { id: "drafting", name: "Pale Oak Farm Table", image: "/tables/farmhouse-long.png", color: "#c79a62", wood: "#c79a62" },
  { id: "luncheon", name: "Formal Linen Oval", image: "/tables/formal-oval.png", color: "#f1eadc", wood: "#f1eadc" },
  { id: "strategy", name: "Charcoal Strategy Round", image: "/tables/strategy-round.png", color: "#232323", wood: "#232323" },
];

// Anchor 2 — fixed seat counts per table type
export const SEAT_COUNTS = {
  mahogany: 8,
  executive: 10,
  family: 6,
  drafting: 8,
  luncheon: 6,
  strategy: 12,
};

/**
 * Physical footprint of each table, in scene units (the unit is one pixel at
 * 100% zoom). `shape` decides how seats distribute: round and oval tables seat
 * people on an ellipse, rect tables seat them along the long edges first.
 */
export const TABLE_GEOMETRY = {
  mahogany: { shape: "round", width: 320, depth: 320 },
  family: { shape: "round", width: 296, depth: 296 },
  strategy: { shape: "round", width: 356, depth: 356 },
  executive: { shape: "rect", width: 430, depth: 210 },
  drafting: { shape: "rect", width: 416, depth: 200 },
  luncheon: { shape: "oval", width: 386, depth: 248 },
};

export const TABLETOPS = [
  { id: "meeting", name: "Meeting Set", desc: "Notebooks, pens, water glasses", icon: "📓" },
  { id: "coffee", name: "Coffee & Snacks", desc: "Mugs, pastries, napkins", icon: "☕" },
  { id: "luncheon", name: "Luncheon Set", desc: "Plates, salads, breadbaskets", icon: "🥗" },
  { id: "formal", name: "Formal Dinner", desc: "Fine china, candles, wine glasses", icon: "🍷" },
  { id: "planning", name: "Planning Set", desc: "Documents, blueprints, tablets", icon: "📋" },
  { id: "chef", name: "Premium Chef Table", desc: "Tasting plates, chef tools, wine pairing", icon: "👨‍🍳" },
];

export const FOODS = [
  { id: "none", name: "None" },
  { id: "coffee", name: "Coffee / Tea / Water" },
  { id: "snacks", name: "Snacks" },
  { id: "hors", name: "Hors d'oeuvres" },
  { id: "lunch", name: "Luncheon" },
  { id: "dinner", name: "Dinner" },
  { id: "chef", name: "Ultra High-End Chef" },
];

export const AMBIANCES = [
  { id: "bright", name: "Business Bright", color: "#f0f0f0", overlay: "rgba(255,255,255,0.05)" },
  { id: "warm", name: "Warm Dinner", color: "#ff9500", overlay: "rgba(255,150,0,0.08)" },
  { id: "fireside", name: "Fireside Calm", color: "#ffcc00", overlay: "rgba(255,200,0,0.06)" },
  { id: "jazz", name: "Evening Jazz", color: "#af52de", overlay: "rgba(175,82,222,0.06)" },
  { id: "focus", name: "Focus Mode", color: "#007aff", overlay: "rgba(0,122,255,0.04)" },
  { id: "celebrate", name: "Celebration", color: "#ff2d55", overlay: "rgba(255,45,85,0.06)" },
];

export const MUSICS = [
  { id: "off", name: "Off" },
  { id: "jazz", name: "Soft Jazz" },
  { id: "acoustic", name: "Acoustic" },
  { id: "ambient", name: "Ambient Focus" },
  { id: "worship", name: "Worship / Reflection" },
  { id: "event", name: "Private Event Mix" },
];

// Anchor 1 — default scene applied to new tables and old tables without a scene doc
export const DEFAULT_SCENE = {
  room: "library",
  table: "mahogany",
  tabletop: "meeting",
  food: "none",
  ambiance: "warm",
  music: "off",
};

/**
 * Gestures a seated guest can play at a table.
 * `mark` is the roster glyph; `pose` names the CSS pose class the figure adopts.
 */
export const TABLE_GESTURES = [
  { id: "clap", label: "Clap", mark: "👏", pose: "clap" },
  { id: "arms_folded", label: "Fold arms", mark: "🙅", pose: "arms_folded" },
  { id: "hands_up", label: "Hands in the air", mark: "🙌", pose: "hands_up" },
  { id: "fist_raised", label: "Raise one fist", mark: "✊", pose: "fist_raised" },
  { id: "head_down", label: "Head on the table", mark: "😴", pose: "head_down" },
];

/**
 * What an audience member can do from their seat in a stage venue. These are the
 * four the house reads from the stage: applause, a standing ovation, a raised
 * fist, and folded arms with a slow head shake.
 */
export const AUDIENCE_ACTIONS = [
  { id: "clap", label: "Clap", mark: "👏", pose: "clap", hint: "Applaud from your seat" },
  { id: "stand", label: "Stand", mark: "🧍", pose: "stand", hint: "Rise for a standing ovation" },
  { id: "fist_raised", label: "Fist in the air", mark: "✊", pose: "fist_raised", hint: "Throw a fist up" },
  { id: "arms_folded", label: "Fold arms", mark: "🙅", pose: "arms_folded", hint: "Fold your arms and shake your head" },
];

// Avatar tiers — `premium_illustrated` is the generated cinematic portrait set.
export const AVATAR_TIERS = [
  { id: "preset", label: "Preset", available: true, hint: "Initials & color" },
  { id: "stylized", label: "Stylized", available: true, hint: "DiceBear illustrated portraits" },
  { id: "premium_illustrated", label: "Premium Illustrated", available: true, hint: "Cinematic roundtable portraits" },
  { id: "photoreal", label: "Photoreal", available: false, hint: "Coming Iteration 21" },
];

// ── Lookup helpers ──────────────────────────────────
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const VENUES_BY_ID = byId(VENUES);
const TABLES_BY_ID = byId(TABLES);
const TABLETOPS_BY_ID = byId(TABLETOPS);
const FOODS_BY_ID = byId(FOODS);
const AMBIANCES_BY_ID = byId(AMBIANCES);
const MUSICS_BY_ID = byId(MUSICS);

export function resolveScene(scene) {
  const s = scene || DEFAULT_SCENE;
  return {
    room: VENUES_BY_ID[s.room] || VENUES_BY_ID[DEFAULT_SCENE.room],
    table: TABLES_BY_ID[s.table] || TABLES_BY_ID[DEFAULT_SCENE.table],
    tabletop: TABLETOPS_BY_ID[s.tabletop] || TABLETOPS_BY_ID[DEFAULT_SCENE.tabletop],
    food: FOODS_BY_ID[s.food] || FOODS_BY_ID[DEFAULT_SCENE.food],
    ambiance: AMBIANCES_BY_ID[s.ambiance] || AMBIANCES_BY_ID[DEFAULT_SCENE.ambiance],
    music: MUSICS_BY_ID[s.music] || MUSICS_BY_ID[DEFAULT_SCENE.music],
  };
}

export function seatCountForTable(tableId) {
  return SEAT_COUNTS[tableId] || 8;
}

/** True when the venue seats an audience facing a stage rather than a table. */
export function isStageVenue(roomId) {
  return (VENUES_BY_ID[roomId]?.kind || "table") === "stage";
}

export function stageLayoutFor(roomId) {
  return STAGE_LAYOUTS[roomId] || STAGE_LAYOUTS.theatre;
}

export function tableGeometryFor(tableId) {
  return TABLE_GEOMETRY[tableId] || TABLE_GEOMETRY.mahogany;
}

/**
 * Seat placement for a table, in scene units relative to the table centre.
 *
 * Everything that draws a table — the live room, the editor preview, the
 * seating tab — reads seats from here, so a chair is never in a different place
 * than the table it belongs to. `tilt` compresses the Y axis to sell the
 * camera's downward angle; `depth` runs 0 (far side of the table) to 1 (nearest
 * the camera) so callers can scale figures and stack them in the right order.
 */
export function seatPositions(tableId, seatCount, { pad = 86, tilt = 0.62 } = {}) {
  const geo = tableGeometryFor(tableId);
  const count = Math.max(1, seatCount);

  if (geo.shape === "rect") return rectSeats(geo, count, pad, tilt);

  const rx = geo.width / 2 + pad;
  const ry = (geo.depth / 2 + pad) * tilt;
  return Array.from({ length: count }, (_, index) => {
    // Seat 1 sits at the head of the table, farthest from camera; walk clockwise.
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return { x, y, angle, depth: (Math.sin(angle) + 1) / 2, facing: angle + Math.PI };
  });
}

/**
 * Long tables seat people down the two long edges before the ends — the way a
 * real board table is laid out. Odd remainders go to the far edge so the near
 * edge never blocks the tabletop.
 */
function rectSeats(geo, count, pad, tilt) {
  const halfW = geo.width / 2;
  const halfD = (geo.depth / 2 + pad) * tilt;
  const endX = halfW + pad * 0.8;

  const ends = count >= 6 ? 2 : 0;
  const perEdge = count - ends;
  const nearEdge = Math.floor(perEdge / 2);
  const farEdge = perEdge - nearEdge;

  const seats = [];
  const spread = (n, i) => (n === 1 ? 0 : (i / (n - 1) - 0.5) * (geo.width * 0.86));

  for (let i = 0; i < farEdge; i += 1) {
    seats.push({ x: spread(farEdge, i), y: -halfD, angle: -Math.PI / 2, depth: 0.08, facing: Math.PI / 2 });
  }
  if (ends) seats.push({ x: -endX, y: 0, angle: Math.PI, depth: 0.5, facing: 0 });
  if (ends) seats.push({ x: endX, y: 0, angle: 0, depth: 0.5, facing: Math.PI });
  for (let i = 0; i < nearEdge; i += 1) {
    seats.push({ x: spread(nearEdge, nearEdge - 1 - i), y: halfD, angle: Math.PI / 2, depth: 0.95, facing: -Math.PI / 2 });
  }
  return seats;
}
