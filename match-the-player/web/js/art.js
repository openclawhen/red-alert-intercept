/* ==========================================================================
   art.js - the game's drawn assets, as inline SVG.

   Everything here is generic on purpose. The game has no licence to show a
   club's real crest or a player's photograph, so instead of faking either it
   ships a proper art system: a set of badge shapes tinted with each club's
   colours, and a shirt with the player's initials on the back where a photo
   would go. Both are obviously stand-ins, and both look like they belong to a
   football game rather than like something failed to load.

   Real artwork drops in on top - see data/club-logos.json and the `image`
   field on a player - and these step aside.
   ========================================================================== */

/* Stable small hash, so a club keeps the same badge shape forever. */
function hash(text = '') {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ---------- Club badges ----------------------------------------------------
   Four silhouettes on a 100x110 canvas. None of them copies a real crest -
   they are the generic shapes football badges are built from.
   -------------------------------------------------------------------------- */
const BADGE_SHAPES = [
  // pointed shield
  'M50 2 L96 16 V58 Q96 88 50 108 Q4 88 4 58 V16 Z',
  // roundel
  'M50 4 A51 51 0 1 1 49.9 4 Z',
  // flat-top scudetto
  'M6 4 H94 V60 Q94 90 50 108 Q6 90 6 60 Z',
  // clipped hexagon
  'M50 2 L94 26 V80 L50 108 L6 80 V26 Z',
];

/**
 * A club badge: the club's colours, its short code, and a shape picked from
 * its id so it never changes between renders.
 */
export function badgeSvg(club, { size = 34 } = {}) {
  const shape = BADGE_SHAPES[hash(club.id) % BADGE_SHAPES.length];
  const code = (club.short || club.name.slice(0, 3)).toUpperCase();
  const id = `b${hash(club.id).toString(36)}`;
  // short codes vary in width - shrink the type rather than let it overflow
  const fontSize = code.length >= 5 ? 26 : code.length === 4 ? 31 : 36;

  return `<svg class="badge-svg" viewBox="0 0 100 110" width="${size}" height="${size * 1.1}"
      role="img" aria-label="${club.name}" focusable="false">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
        <stop offset=".45" stop-color="#fff" stop-opacity=".04"/>
        <stop offset="1" stop-color="#000" stop-opacity=".3"/>
      </linearGradient>
      <clipPath id="${id}c"><path d="${shape}"/></clipPath>
    </defs>
    <path d="${shape}" fill="${club.bg}"/>
    <g clip-path="url(#${id}c)">
      <rect x="0" y="0" width="100" height="110" fill="url(#${id}g)"/>
      <path d="M0 74 H100 V110 H0 Z" fill="${club.fg}" opacity=".14"/>
    </g>
    <path d="${shape}" fill="none" stroke="${club.fg}" stroke-opacity=".55" stroke-width="4"/>
    <text x="50" y="62" text-anchor="middle" fill="${club.fg}"
      font-family="Inter, system-ui, sans-serif" font-weight="800"
      font-size="${fontSize}" letter-spacing="-1">${code}</text>
  </svg>`;
}

/* ---------- The shirt that stands in for a photo ---------------------------
   A football shirt seen from the back, with the player's initials where the
   name and number go. It reads as "we don't have his picture", not as a
   guess at what he looks like.
   -------------------------------------------------------------------------- */
export function shirtSvg(initials, { accent = '#00ff9d', masked = false } = {}) {
  const id = `s${hash(initials + accent).toString(36)}`;
  const label = masked ? '?' : (initials || '?');
  const fontSize = label.length > 2 ? 30 : 42;

  return `<svg class="shirt-svg" viewBox="0 0 160 170" role="img"
      aria-label="${masked ? 'Mystery player' : 'No photograph available'}" focusable="false">
    <defs>
      <linearGradient id="${id}f" x1=".2" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="${accent}" stop-opacity=".5"/>
        <stop offset="1" stop-color="${accent}" stop-opacity=".12"/>
      </linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".2"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- sleeves and body -->
    <path d="M55 16 L80 26 L105 16 L150 42 L133 74 L118 65 V158 Q80 166 42 158 V65 L27 74 L10 42 Z"
      fill="url(#${id}f)" stroke="${accent}" stroke-opacity=".55" stroke-width="2.5"
      stroke-linejoin="round"/>
    <path d="M55 16 L80 26 L105 16 L150 42 L133 74 L118 65 V100 H42 V65 L27 74 L10 42 Z"
      fill="url(#${id}s)"/>
    <!-- collar -->
    <path d="M64 18 Q80 34 96 18" fill="none" stroke="${accent}" stroke-opacity=".8" stroke-width="4"
      stroke-linecap="round"/>
    <text x="80" y="128" text-anchor="middle" fill="#fff" fill-opacity=".92"
      font-family="Inter, system-ui, sans-serif" font-weight="900"
      font-size="${fontSize}" letter-spacing="-2">${label}</text>
  </svg>`;
}

/* ---------- Icons -----------------------------------------------------------
   One small set, so the interface stops leaning on emoji.
   -------------------------------------------------------------------------- */
const ICONS = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor" stroke="none"/>',
  flame: '<path d="M12 3c2.6 3 4.6 5 4.6 7.9A4.6 4.6 0 0 1 12 15.5a4.6 4.6 0 0 1-4.6-4.6C7.4 8 9.4 6 12 3z"/><path d="M12 15.5c2.7 0 4.8 1.6 4.8 3.2S14.7 21 12 21s-4.8-.7-4.8-2.3 2.1-3.2 4.8-3.2z"/>',
  bolt: '<path d="M13.5 3 6 13h5l-1.5 8L18 11h-5z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>',
  sound: '<path d="M5 9.5h3l4-3.2v11.4l-4-3.2H5z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M18 6.8a7.6 7.6 0 0 1 0 10.4"/>',
  muted: '<path d="M5 9.5h3l4-3.2v11.4l-4-3.2H5z"/><path d="m15.6 9.8 4.6 4.6M20.2 9.8l-4.6 4.6"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5.4v1.6A3.4 3.4 0 0 0 8.8 10.5M16 5.5h2.6v1.6a3.4 3.4 0 0 1-3.4 3.4"/><path d="M12 13v3.5M9 20h6l-.8-3.5H9.8z"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  whistle: '<path d="M4 11.5h9l6-3v9l-6-3H4z"/><circle cx="7" cy="12" r="1" fill="currentColor" stroke="none"/>',
};

export function icon(name, { size = 18, className = '' } = {}) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ---------- Tier marks -------------------------------------------------------
   Football cards run gold for the household names down to bronze for the squad
   filler, so the easy tier - the famous players - is the gold one.
   -------------------------------------------------------------------------- */
export const TIER_METAL = {
  easy: { name: 'Gold', a: '#ffdf7e', b: '#b47c14' },
  hard: { name: 'Silver', a: '#dfe6f2', b: '#7c8798' },
  impossible: { name: 'Bronze', a: '#e0a06a', b: '#8a4f24' },
};

export function tierMetal(tier) {
  return TIER_METAL[tier] || TIER_METAL.hard;
}
