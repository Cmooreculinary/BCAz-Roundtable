// /app/frontend/src/lib/venueArt.js
// Generated artwork for the stage venues.
//
// The table rooms ship as photographs in /public/scenes. The stage venues are
// drawn instead of photographed: the SVG below is inlined as a data URI, so a
// theatre, an amphitheatre, and an arena render with no network request, no
// binary assets in the repo, and no licensing question. Same warm-obsidian
// palette as the rest of the roundtable surfaces.

const PALETTE = {
  theatre: { sky: "#0B0805", wall: "#1E1309", trim: "#C9954E", glow: "#E3B778", floor: "#170F08" },
  redrocks: { sky: "#0A0912", wall: "#2A140C", trim: "#E8894A", glow: "#F0A560", floor: "#140B07" },
  arena: { sky: "#04060C", wall: "#0E1522", trim: "#8FB6F0", glow: "#CFE0FF", floor: "#080C14" },
};

const W = 800;
const H = 500;

function theatreScene(p) {
  return `
    <rect width="${W}" height="${H}" fill="${p.sky}"/>
    <ellipse cx="${W / 2}" cy="${H * 0.02}" rx="${W * 0.66}" ry="${H * 0.4}" fill="${p.wall}"/>
    <g opacity="0.9">
      <ellipse cx="${W / 2}" cy="46" rx="270" ry="34" fill="none" stroke="${p.trim}" stroke-width="4" opacity="0.62"/>
      <ellipse cx="${W / 2}" cy="66" rx="198" ry="25" fill="none" stroke="${p.trim}" stroke-width="3" opacity="0.46"/>
      <ellipse cx="${W / 2}" cy="84" rx="128" ry="17" fill="none" stroke="${p.trim}" stroke-width="2.5" opacity="0.34"/>
    </g>
    <rect x="0" y="${H * 0.16}" width="${W}" height="${H * 0.56}" fill="${p.wall}" opacity="0.9"/>
    <g opacity="0.5" stroke="${p.trim}" stroke-width="1.5">
      ${Array.from({ length: 15 }, (_, i) => `<line x1="${i * 57}" y1="${H * 0.16}" x2="${i * 57}" y2="${H * 0.72}"/>`).join("")}
    </g>
    <g fill="${p.glow}" opacity="0.5">
      ${Array.from({ length: 8 }, (_, i) => `<ellipse cx="${44 + i * 102}" cy="${H * 0.42}" rx="5" ry="16"/>`).join("")}
    </g>
    <g fill="${p.wall}" opacity="0.85">
      <rect x="16" y="${H * 0.3}" width="46" height="${H * 0.42}" rx="10"/>
      <rect x="${W - 62}" y="${H * 0.3}" width="46" height="${H * 0.42}" rx="10"/>
    </g>
    <ellipse cx="${W / 2}" cy="${H * 0.78}" rx="${W * 0.58}" ry="${H * 0.3}" fill="${p.floor}"/>
    <radialGradient id="tg" cx="50%" cy="34%" r="66%">
      <stop offset="0%" stop-color="${p.glow}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${p.sky}" stop-opacity="0.86"/>
    </radialGradient>
    <rect width="${W}" height="${H}" fill="url(#tg)"/>`;
}

function redRocksScene(p) {
  const stars = Array.from({ length: 60 }, (_, i) => {
    const x = ((i * 137) % W).toFixed(0);
    const y = ((i * 61) % (H * 0.45)).toFixed(0);
    return `<circle cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.8 : 1.1}" fill="#FFF3DC" opacity="${i % 3 === 0 ? 0.85 : 0.4}"/>`;
  }).join("");
  return `
    <rect width="${W}" height="${H}" fill="${p.sky}"/>
    ${stars}
    <ellipse cx="${W / 2}" cy="${H * 0.36}" rx="${W * 0.34}" ry="${H * 0.2}" fill="#1C1430" opacity="0.7"/>
    <path d="M0 ${H} L0 ${H * 0.04} L118 ${H * -0.06} L196 ${H * 0.26} L172 ${H * 0.72} L246 ${H} z" fill="${p.wall}"/>
    <path d="M${W} ${H} L${W} ${H * 0.0} L${W - 132} ${H * -0.08} L${W - 206} ${H * 0.3} L${W - 178} ${H * 0.76} L${W - 258} ${H} z" fill="${p.wall}"/>
    <path d="M0 ${H} L0 ${H * 0.04} L118 ${H * -0.06} L196 ${H * 0.26} L172 ${H * 0.72} L246 ${H} z" fill="${p.trim}" opacity="0.3"/>
    <path d="M${W} ${H} L${W} ${H * 0.0} L${W - 132} ${H * -0.08} L${W - 206} ${H * 0.3} L${W - 178} ${H * 0.76} L${W - 258} ${H} z" fill="${p.trim}" opacity="0.22"/>
    <path d="M118 ${H * -0.06} L196 ${H * 0.26} L150 ${H * 0.34} z" fill="#000" opacity="0.35"/>
    <path d="M${W - 132} ${H * -0.08} L${W - 206} ${H * 0.3} L${W - 160} ${H * 0.38} z" fill="#000" opacity="0.35"/>
    <ellipse cx="${W / 2}" cy="${H * 0.82}" rx="${W * 0.5}" ry="${H * 0.26}" fill="${p.floor}"/>
    <radialGradient id="rg" cx="50%" cy="46%" r="60%">
      <stop offset="0%" stop-color="${p.glow}" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="${p.sky}" stop-opacity="0.82"/>
    </radialGradient>
    <rect width="${W}" height="${H}" fill="url(#rg)"/>`;
}

function arenaScene(p) {
  const tier = (y, h, opacity) =>
    `<path d="M-40 ${y} Q${W / 2} ${y - h} ${W + 40} ${y} L${W + 40} ${y + h} Q${W / 2} ${y - h * 0.1} -40 ${y + h} z" fill="${p.wall}" opacity="${opacity}"/>`;
  return `
    <rect width="${W}" height="${H}" fill="${p.sky}"/>
    ${tier(H * 0.13, 62, 0.95)}
    ${tier(H * 0.27, 54, 0.82)}
    ${tier(H * 0.4, 46, 0.68)}
    <g>
      ${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 41 + 12) % (W + 20) - 10}" cy="${H * (0.12 + (i % 4) * 0.1)}" r="2.2" fill="${p.trim}" opacity="${0.3 + (i % 3) * 0.22}"/>`).join("")}
    </g>
    <rect x="34" y="${H * 0.08}" width="150" height="86" rx="8" fill="#060B14" stroke="${p.trim}" stroke-width="2.5" opacity="0.95"/>
    <rect x="${W - 184}" y="${H * 0.08}" width="150" height="86" rx="8" fill="#060B14" stroke="${p.trim}" stroke-width="2.5" opacity="0.95"/>
    <g fill="${p.trim}" opacity="0.28">
      <rect x="46" y="${H * 0.1}" width="126" height="62" rx="4"/>
      <rect x="${W - 172}" y="${H * 0.1}" width="126" height="62" rx="4"/>
    </g>
    ${Array.from({ length: 5 }, (_, i) => {
      const x = 100 + i * 150;
      return `<path d="M${x} 0 L${x - 26} 0 L${x - 150} ${H * 0.8} L${x + 96} ${H * 0.8} z" fill="${p.glow}" opacity="0.05"/>`;
    }).join("")}
    <ellipse cx="${W / 2}" cy="${H * 0.84}" rx="${W * 0.52}" ry="${H * 0.28}" fill="${p.floor}"/>
    <radialGradient id="ag" cx="50%" cy="50%" r="62%">
      <stop offset="0%" stop-color="${p.glow}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${p.sky}" stop-opacity="0.88"/>
    </radialGradient>
    <rect width="${W}" height="${H}" fill="url(#ag)"/>`;
}

const SCENES = { theatre: theatreScene, redrocks: redRocksScene, arena: arenaScene };

/**
 * Cinematic backdrop for a stage venue, as an inline SVG data URI usable
 * anywhere an image URL is expected (background-image, <img src>).
 */
export function stageVenueArt(venueId) {
  const palette = PALETTE[venueId] || PALETTE.theatre;
  const draw = SCENES[venueId] || SCENES.theatre;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${draw(palette)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}
