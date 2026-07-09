// /app/frontend/src/lib/scenes.js
// Shared scene catalog — used by both standalone /gather demo and real /table/:id pages.
// Backend stores only the IDs; this file resolves IDs to visuals.
// Iteration 18 — single source of truth.

export const ROOMS = [
  { id: "skyline", name: "Skyline Executive Room", gradient: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #2d5a7b 100%)", accent: "#5AC8FA" },
  { id: "dining", name: "Warm Private Dining", gradient: "linear-gradient(135deg, #3d1c02 0%, #6b3a1f 50%, #8b5e3c 100%)", accent: "#FF9500" },
  { id: "studio", name: "Creative Studio", gradient: "linear-gradient(135deg, #1a1a2e 0%, #2d2d44 50%, #4a4a6a 100%)", accent: "#AF52DE" },
  { id: "library", name: "Fireside Library", gradient: "linear-gradient(135deg, #2a1810 0%, #4a2c1a 50%, #6b4226 100%)", accent: "#FFCC00" },
  { id: "church", name: "Church / Community", gradient: "linear-gradient(135deg, #1a0a2e 0%, #2d1a4a 50%, #4a2d6b 100%)", accent: "#FF2D55" },
  { id: "terrace", name: "Outdoor Terrace", gradient: "linear-gradient(135deg, #0a2a1a 0%, #1a4a2d 50%, #2d6b4a 100%)", accent: "#34C759" },
];

export const TABLES = [
  { id: "mahogany", name: "Mahogany Table", color: "#6b3a1f", wood: "linear-gradient(135deg, #8b5e3c 0%, #6b3a1f 50%, #4a2510 100%)" },
  { id: "executive", name: "Executive Board Table", color: "#2c2c2e", wood: "linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 50%, #1c1c1e 100%)" },
  { id: "family", name: "Family Dinner Table", color: "#a47a4c", wood: "linear-gradient(135deg, #c9a274 0%, #a47a4c 50%, #7a4f2b 100%)" },
  { id: "drafting", name: "Drafting / Planning", color: "#4a6741", wood: "linear-gradient(135deg, #5a7a51 0%, #4a6741 50%, #3a5431 100%)" },
  { id: "luncheon", name: "Luncheon Table", color: "#f5f0e8", wood: "linear-gradient(135deg, #fff 0%, #f5f0e8 50%, #e8e0d0 100%)" },
  { id: "strategy", name: "Strategy War Table", color: "#1c3a5c", wood: "linear-gradient(135deg, #2d5a7b 0%, #1c3a5c 50%, #0a1a3c 100%)" },
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

// Avatar tiers — only `stylized` is implemented this iteration. Others reserve namespace per Anchor 3.
export const AVATAR_TIERS = [
  { id: "preset", label: "Preset", available: true, hint: "Initials & color" },
  { id: "stylized", label: "Stylized", available: true, hint: "DiceBear illustrated portraits" },
  { id: "premium_illustrated", label: "Premium Illustrated", available: false, hint: "Coming Iteration 20" },
  { id: "photoreal", label: "Photoreal", available: false, hint: "Coming Iteration 21" },
];

// ── Lookup helpers ──────────────────────────────────
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const ROOMS_BY_ID = byId(ROOMS);
const TABLES_BY_ID = byId(TABLES);
const TABLETOPS_BY_ID = byId(TABLETOPS);
const FOODS_BY_ID = byId(FOODS);
const AMBIANCES_BY_ID = byId(AMBIANCES);
const MUSICS_BY_ID = byId(MUSICS);

export function resolveScene(scene) {
  const s = scene || DEFAULT_SCENE;
  return {
    room: ROOMS_BY_ID[s.room] || ROOMS_BY_ID[DEFAULT_SCENE.room],
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
