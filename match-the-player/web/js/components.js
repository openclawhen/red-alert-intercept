/* ==========================================================================
   components.js - small render helpers shared by the screens.
   Everything returns an HTML string; the caller decides where to put it.
   ========================================================================== */

import { careerOf } from './data.js';
import { badgeSvg, shirtSvg, tierMetal } from './art.js';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** Detects Hebrew/Arabic so migrated names render right-to-left. */
export function dirFor(text = '') {
  return /[֐-ࣿ]/.test(text) ? 'rtl' : 'ltr';
}

export function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/* ---------- Club badge ----------------------------------------------------
   A monogram, not a crest. If a real logo has been added to assets/clubs/ and
   registered in data/club-logos.json, that image is used instead.
   -------------------------------------------------------------------------- */
export function clubBadge(club, logoSet, { size = 34 } = {}) {
  if (logoSet && logoSet.has(club.id)) {
    return `<span class="club-badge club-badge--real">
      <img src="assets/clubs/${encodeURIComponent(club.id)}.png" alt="${escapeHtml(club.name)}"
        loading="lazy" decoding="async" width="${size}" height="${size}">
    </span>`;
  }
  return `<span class="club-badge">${badgeSvg(club, { size })}</span>`;
}

/* ---------- Player portrait ------------------------------------------------
   Real photo when the data has one, otherwise a generated stand-in. The
   stand-in is deliberately neutral - it must never hint at the answer.
   -------------------------------------------------------------------------- */
function portrait(player, revealName) {
  if (player.image) {
    return `<img class="player-card__photo" src="${escapeHtml(player.image)}"
      alt="${revealName ? escapeHtml(player.name) : 'Mystery player'}"
      loading="lazy" decoding="async">`;
  }
  // A shirt with his initials on the back. When the name is still hidden the
  // initials would give it away, so the shirt wears a question mark instead.
  const metal = tierMetal(player.tier);
  return `<div class="portrait-fallback" style="--metal-a:${metal.a};--metal-b:${metal.b}">
      ${shirtSvg(escapeHtml(initialsOf(player.name)), { accent: metal.a, masked: !revealName })}
    </div>`;
}

/* ---------- Player card ---------------------------------------------------- */

export function playerCard(player, difficulty, { revealed = false, tint = 'rgba(0,255,157,.18)', league = null } = {}) {
  const showName = difficulty.showName || revealed;
  const name = showName ? escapeHtml(player.name) : '• • • • •';

  const facts = [];
  if (revealed || difficulty.hints.includes('nationality')) {
    if (player.nationality) facts.push(player.nationality);
  }
  if (revealed || difficulty.hints.includes('position')) {
    if (player.position) facts.push(player.position);
  }
  // "current club" is only a clue when it is not the answer itself
  if (difficulty.hints.includes('currentClub') && player.currentClub) {
    // Skip it when it gives the answer away, and when it says nothing useful
    const givesItAway = player.clubs.some(
      (c) => player.mainClubIds.includes(c.id) && c.name === player.currentClub,
    );
    const isFiller = ['retired', 'free agent', 'unattached'].includes(player.currentClub.toLowerCase());
    if (!givesItAway && !isFiller) facts.push(`Now: ${player.currentClub}`);
  }

  const metal = tierMetal(player.tier);
  return `<article class="player-card player-card--${player.tier}"
    style="--card-tint:${tint};--metal-a:${metal.a};--metal-b:${metal.b}">
    <span class="player-card__tier" aria-label="${metal.name} card">${escapeHtml(metal.name)}</span>
    <div class="player-card__frame ${player.image ? '' : 'player-card__frame--blank'}">${portrait(player, showName)}</div>
    <div class="player-card__body">
      <h2 class="player-card__name ${showName ? '' : 'is-hidden'}" dir="${dirFor(player.name)}">${name}</h2>
      ${facts.length ? `<div class="player-card__facts">${facts
        .map((f) => `<span class="player-card__fact">${escapeHtml(f)}</span>`)
        .join('')}</div>` : ''}
      ${revealed ? careerList(player, league) : ''}
    </div>
  </article>`;
}

/** The ranked career shown once the answer is out. */
export function careerList(player, league = null) {
  // Prefer the league's own spelling of a club so the reveal matches the buttons
  const leagueNames = new Map((league?.clubs || []).map((c) => [c.id, c.name]));
  const rows = careerOf(player).slice(0, 5).map((row) => ({ ...row, name: leagueNames.get(row.id) || row.name })).map((row) => `
    <div class="career__row ${row.isMain ? 'is-answer' : ''}">
      <span class="career__name" dir="${dirFor(row.name)}">${escapeHtml(row.name)}</span>
      <span class="career__bar"><span style="width:${Math.round(row.share * 100)}%"></span></span>
      <span class="career__years">${row.years != null ? `${row.years}y` : `${Math.round(row.share * 100)}%`}</span>
    </div>`).join('');
  return `<div class="career">${rows}</div>`;
}

/* ---------- Club option button --------------------------------------------- */

export function clubOption(club, index, logoSet) {
  return `<button class="club-option" type="button" data-option="${index}" dir="${dirFor(club.name)}">
    ${clubBadge(club, logoSet, { size: 30 })}
    <span class="club-option__name" dir="${dirFor(club.name)}">${escapeHtml(club.name)}</span>
  </button>`;
}
