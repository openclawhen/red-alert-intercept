/* ==========================================================================
   arena.js - "Original" mode: the Pygame game, rebuilt for a touch screen.
   Cards are thrown upwards, fall under gravity, and you drag one into the
   corner of the club he played for the longest.

   The rules here are the ones from main.py, not an interpretation of them:
     - 60 seconds a round, whatever the difficulty, and no lives
     - the club he played longest for scores 100, other clubs score their
       share of his career, straight out of the data with no multipliers
     - releasing on a club he never played for - or nowhere at all - is -50
     - letting a card fall off the bottom is another -50
     - the score is allowed to go negative
     - four fixed corners for the whole round
     - impossible keeps two cards in the air at once
   ========================================================================== */

import { SCORING, namesShown } from './config.js';
import { createGame } from './engine.js';
import { pickCorners, poolFor } from './data.js';
import { clubBadge, dirFor, escapeHtml, initialsOf } from './components.js';
import { icon } from './art.js';
import { sfx } from './audio.js';
import { store } from './storage.js';

const el = {};
let logoSet = null;
let onFinish = () => {};

let game = null;
let corners = [];        // the four clubs, fixed for the round
let cornerRects = [];    // their pixel boxes inside the arena
let cards = [];          // live cards
let rafId = null;
let lastFrame = 0;
let nextSpawnAt = 0;
let arenaSize = { w: 0, h: 0 };
let feedbackTimer = null;
let cardSeq = 0;

export function initArena(refs, logos, finishHandler) {
  Object.assign(el, refs);
  logoSet = logos;
  onFinish = finishHandler;
  window.addEventListener('resize', measure);
}

/* ---------- lifecycle ------------------------------------------------------ */

export function startArena({ league, difficulty, mode, players }) {
  stopArena();

  game = createGame({ league, difficulty, mode, players });

  // Four corners, chosen once and kept for the whole round - exactly like the
  // original, where they were always the same four Israeli clubs.
  corners = pickCorners(poolFor(players, league, difficulty), league, 4);
  renderCorners();
  measure();

  cards = [];
  cardSeq = 0;
  nextSpawnAt = 0;
  el.feedback.textContent = '';
  el.feedback.className = 'arena__burst';

  renderHud();
  sfx.whistle();          // kick-off
  spawnCard();

  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
  return game;
}

export function stopArena() {
  if (rafId) cancelAnimationFrame(rafId);
  if (feedbackTimer) clearTimeout(feedbackTimer);
  rafId = null;
  feedbackTimer = null;
  cards.forEach((card) => { detach(card); card.el.remove(); });
  cards = [];
  game = null;
}

/* ---------- layout --------------------------------------------------------- */

function measure() {
  if (!el.arena) return;
  const box = el.arena.getBoundingClientRect();
  arenaSize = { w: box.width, h: box.height };
  cornerRects = Array.from(el.arena.querySelectorAll('.corner')).map((node) => {
    const r = node.getBoundingClientRect();
    return { left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top };
  });
}

function cardSize() {
  // The original card was 294x408 on a 720-tall screen. Keep the proportions,
  // but never let it eat the whole width of a phone.
  const h = Math.min(arenaSize.h * 0.34, arenaSize.w * 0.46 * (408 / 294));
  return { w: h * (294 / 408), h };
}

function renderCorners() {
  el.arena.querySelectorAll('.corner').forEach((node, i) => {
    const club = corners[i];
    node.style.setProperty('--corner-bg', club.bg);
    node.innerHTML = `${clubBadge(club, logoSet)}<span class="corner__name" dir="${dirFor(club.name)}">${escapeHtml(club.name)}</span>`;
  });
}

/* ---------- cards ---------------------------------------------------------- */

function spawnCard() {
  const question = game.nextQuestion(corners);
  if (!question) return;             // nobody left who fits these corners

  const { w, h } = cardSize();
  const physics = game.difficulty.arena;

  const card = {
    id: (cardSeq += 1),
    question,
    w,
    h,
    // create_new_ball() dropped the card at a random spot on the screen
    x: rand(w / 2, Math.max(w / 2, arenaSize.w - w / 2)),
    y: rand(h / 2, Math.max(h / 2, arenaSize.h - h / 2)),
    vy: physics.rise * arenaSize.h,          // per-second, scaled to this screen
    gravity: physics.gravity * arenaSize.h,
    dragging: false,
    pointerId: null,
    grabDX: 0,
    grabDY: 0,
    el: document.createElement('div'),
  };

  card.el.className = 'arena-card';
  card.el.style.width = `${w}px`;
  card.el.style.height = `${h}px`;
  card.el.innerHTML = cardMarkup(question.player);
  card.el.addEventListener('pointerdown', (event) => grab(card, event));
  el.cards.appendChild(card.el);

  place(card);
  cards.push(card);
}

function cardMarkup(player) {
  const showName = namesShown(game.difficulty, game.mode);
  const portrait = player.image
    ? `<img class="arena-card__photo" src="${escapeHtml(player.image)}" alt="" loading="eager" decoding="async" draggable="false">`
    : `<span class="arena-card__initials">${showName ? escapeHtml(initialsOf(player.name)) || '?' : '?'}</span>`;

  return `<div class="arena-card__frame">${portrait}</div>
    <div class="arena-card__name" dir="${dirFor(player.name)}">${showName ? escapeHtml(player.name) : '• • •'}</div>`;
}

function place(card) {
  card.el.style.transform = `translate3d(${card.x - card.w / 2}px, ${card.y - card.h / 2}px, 0)`;
}

function removeCard(card) {
  detach(card);
  card.el.remove();
  cards = cards.filter((c) => c !== card);
}

function detach(card) {
  if (!card.onMove) return;
  window.removeEventListener('pointermove', card.onMove);
  window.removeEventListener('pointerup', card.onUp);
  window.removeEventListener('pointercancel', card.onUp);
  card.onMove = null;
  card.onUp = null;
}

/* ---------- the loop ------------------------------------------------------- */

function loop(now) {
  if (!game || game.state.over) return;
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  game.tick(dt);

  cards.slice().forEach((card) => {
    if (card.dragging) return;
    card.y += card.vy * dt;
    card.vy += card.gravity * dt;
    place(card);

    // has_fallen_off_screen()
    if (card.y - card.h / 2 > arenaSize.h) {
      const result = game.dropCard();
      sfx.wrong();
      burst(result.gained, 'is-bad');
      renderHud();
      removeCard(card);
      spawnCard();
    }
  });

  // impossible kept a second card in the air, spawned 2-5 seconds apart
  const physics = game.difficulty.arena;
  if (physics.maxCards > 1 && cards.length < physics.maxCards) {
    if (!nextSpawnAt) nextSpawnAt = now + rand(...physics.secondCardAfter) * 1000;
    else if (now > nextSpawnAt) { spawnCard(); nextSpawnAt = 0; }
  }

  renderTimer();

  if (game.state.over) { finish(); return; }
  rafId = requestAnimationFrame(loop);
}

/* ---------- dragging -------------------------------------------------------- */

function grab(card, event) {
  if (!game || game.state.over || card.dragging) return;
  event.preventDefault();
  card.dragging = true;
  card.pointerId = event.pointerId;
  card.el.classList.add('is-held');

  // Capture is a nicety - if the browser refuses it, the window listeners below
  // still see the whole gesture.
  try { card.el.setPointerCapture(event.pointerId); } catch { /* not fatal */ }

  const point = toArena(event);
  card.grabDX = card.x - point.x;
  card.grabDY = card.y - point.y;

  card.onMove = (e) => move(card, e);
  card.onUp = (e) => release(card, e);
  window.addEventListener('pointermove', card.onMove);
  window.addEventListener('pointerup', card.onUp);
  window.addEventListener('pointercancel', card.onUp);
}

function move(card, event) {
  if (!card.dragging || event.pointerId !== card.pointerId) return;
  const point = toArena(event);
  card.x = point.x + card.grabDX;
  card.y = point.y + card.grabDY;
  place(card);
  highlight(card);
}

function release(card, event) {
  if (!card.dragging) return;
  card.dragging = false;
  detach(card);
  card.el.classList.remove('is-held');
  clearHighlight();

  const index = cornerAt(card.x, card.y);
  const option = index >= 0 ? card.question.options[index] : { played: false, isMain: false, points: 0 };
  const result = game.answer(option);
  if (!result) return;

  if (result.verdict === 'wrong') {
    sfx.wrong();
    burst(result.gained, 'is-bad');
    card.el.classList.add('is-wrong');
  } else {
    sfx[result.verdict === 'main' ? 'correct' : 'partial'](0);
    burst(result.gained, result.verdict === 'main' ? 'is-good' : 'is-partial');
    // snap_to_corner()
    const box = cornerRects[index];
    card.x = (box.left + box.right) / 2;
    card.y = (box.top + box.bottom) / 2;
    card.el.classList.add('is-snapped');
    place(card);
  }

  renderHud();
  window.setTimeout(() => {
    if (!game) return;
    removeCard(card);
    if (!game.state.over) spawnCard();
  }, 260);
}

function toArena(event) {
  const box = el.arena.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function cornerAt(x, y) {
  return cornerRects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

/** draw_corners(): the original lit a corner up only while a card was over it. */
function highlight(card) {
  const index = cornerAt(card.x, card.y);
  el.arena.querySelectorAll('.corner').forEach((node, i) => {
    node.classList.toggle('is-hot', i === index);
  });
}

function clearHighlight() {
  el.arena.querySelectorAll('.corner').forEach((node) => node.classList.remove('is-hot'));
}

/* ---------- readouts -------------------------------------------------------- */

/** The original printed the points change in the middle of the screen for a second. */
function burst(value, tone) {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  el.feedback.className = `arena__burst ${tone}`;
  el.feedback.textContent = value >= 0 ? `+${value}` : `${value}`;
  // restart the animation
  void el.feedback.offsetWidth;
  el.feedback.classList.add('is-live');
  feedbackTimer = setTimeout(() => el.feedback.classList.remove('is-live'), 1000);
}

function renderHud() {
  el.score.textContent = game.state.score;
  el.streak.innerHTML = `${icon('target', { size: 13 })}<span>${game.state.asked}</span>`;
  el.streak.setAttribute('aria-label', `Card ${game.state.asked}`);
}

function renderTimer() {
  const s = game.state;
  const ratio = Math.max(0, s.timeLeft / s.maxTime);
  el.bar.style.transform = `scaleX(${ratio})`;
  el.bar.classList.toggle('is-low', ratio < 0.35);
  el.bar.classList.toggle('is-critical', ratio < 0.15);
  const seconds = Math.ceil(s.timeLeft);
  el.clock.innerHTML = `${icon('clock', { size: 14 })}<span>${seconds}s</span>`;
  el.clock.setAttribute('aria-label', `${seconds} seconds left`);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/* ---------- finishing -------------------------------------------------------- */

function finish() {
  const s = game.state;
  const league = game.league;
  const difficulty = game.difficulty;
  const mode = game.mode;
  const accuracy = game.accuracy();

  stopArena();
  store.recordStreak(s.bestStreak);
  store.countGame();
  const isBest = store.saveBest(league.id, difficulty.id, mode.id, s.score);
  sfx.gameOver();

  onFinish({
    score: s.score,
    reason: 'Full time',
    correct: s.correct + s.partial,
    bestStreak: s.bestStreak,
    accuracy,
    dropped: s.dropped,
    isBest,
    league,
    difficulty,
    mode,
  });
}

export { SCORING };
