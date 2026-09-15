/* ==========================================================================
   classic.js - the original Pygame screens, rebuilt on a 1280x720 stage.

   Every coordinate in here is the coordinate from main.py. The backgrounds are
   the original art (re-encoded to WebP), and the labels you click are the ones
   painted into those backgrounds - so the buttons are invisible rects sitting
   on top, exactly as the original did it.

   The stage is scaled to fit the screen, and rotated when the screen is
   portrait, so turning the phone sideways fills it.
   ========================================================================== */

import { DIFFICULTIES, getDifficulty, getMode } from './config.js';
import { createGame } from './engine.js';
import { loadPlayers, getLeague } from './data.js';
import { sfx, setMuted, isMuted, unlock } from './audio.js';
import { store } from './storage.js';

const STAGE = { w: 1280, h: 720 };
const LEAGUE_ID = 'israeli-premier-league';        // the original game's only league

/* The four corners of the original screen, with their club, art and rect.
   corners{} and corner_images{} from main.py. */
const CORNERS = [
  { club: 'hapoel-tel-aviv',  art: 'corner_red.webp',    x: 0,    y: 0,   w: 310, h: 310, artW: 329, artH: 297 },
  { club: 'beitar-jerusalem', art: 'corner_yellow.webp', x: 985,  y: 0,   w: 310, h: 310, artW: 297, artH: 325 },
  { club: 'maccabi-tel-aviv', art: 'corner_blue.webp',   x: 0,    y: 385, w: 310, h: 310, artW: 379, artH: 339 },
  { club: 'maccabi-haifa',    art: 'corner_green.webp',  x: 954,  y: 398, w: 310, h: 310, artW: 327, artH: 295 },
];

const CARD = { w: 294, h: 408, radius: 180 };      // radius = the 361px photo's half width

/* The names painted onto the difficulty buttons and the TOP 5 tabs. */
const HE_DIFFICULTY = { easy: 'מתחילים', hard: 'מתקדמים', impossible: 'מטורפים' };

let root = null;
let stage = null;
let screens = {};
let onExit = () => {};

let leagues = [];
let league = null;
let players = [];
let difficulty = getDifficulty('easy');

let game = null;
let cards = [];
let rafId = null;
let lastFrame = 0;
let nextSpawnAt = 0;
let burstTimer = null;
let nameDraft = '';

/* ========================================================================== */
/*  Mounting and the stage transform                                           */
/* ========================================================================== */

export async function openClassic(allLeagues, exitHandler) {
  leagues = allLeagues;
  league = getLeague(leagues, LEAGUE_ID);
  onExit = exitHandler;
  players = await loadPlayers(LEAGUE_ID);

  if (!root) build();
  root.hidden = false;
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  showScreen('home');
}

export function closeClassic() {
  stopRound();
  if (root) root.hidden = true;
  window.removeEventListener('resize', fit);
  window.removeEventListener('orientationchange', fit);
}

/** Scale the 1280x720 stage into the viewport, turning it when the screen is tall. */
function fit() {
  if (!stage) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const portrait = vh > vw;

  // when rotated, the stage's width is measured against the viewport's height
  const boxW = portrait ? vh : vw;
  const boxH = portrait ? vw : vh;
  const scale = Math.min(boxW / STAGE.w, boxH / STAGE.h);

  stage.style.transform = `translate(-50%, -50%) rotate(${portrait ? 90 : 0}deg) scale(${scale})`;
  root.querySelector('.classic-rotate-hint').hidden = !portrait || store.get('classicRotateHintSeen');
}

function build() {
  root = document.createElement('div');
  root.className = 'classic-root';
  root.innerHTML = `
    <div class="classic-stage"></div>
    <button class="classic-exit" type="button" title="Back to the modern version">✕</button>
    <div class="classic-rotate-hint" hidden>📱 Turn your phone sideways</div>`;
  document.body.appendChild(root);
  stage = root.querySelector('.classic-stage');

  root.querySelector('.classic-exit').addEventListener('click', () => {
    closeClassic();
    onExit();
  });
  root.querySelector('.classic-rotate-hint').addEventListener('click', (e) => {
    store.set('classicRotateHintSeen', true);
    e.currentTarget.hidden = true;
  });

  buildHome();
  buildModes();
  buildDifficulty();
  buildRules();
  buildHighScores();
  buildName();
  buildPitch();
}

/* ---------- small builders -------------------------------------------------- */

function addScreen(name) {
  const node = document.createElement('div');
  node.className = 'classic-screen';
  node.hidden = true;
  stage.appendChild(node);
  screens[name] = node;
  return node;
}

function bg(parent, file) {
  const img = document.createElement('img');
  img.className = 'classic-bg';
  img.src = `assets/classic/${file}`;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  parent.appendChild(img);
  return img;
}

/** An invisible button over a label painted into the background. */
function hit(parent, { x, y, w, h, label, onClick }) {
  const b = document.createElement('button');
  b.className = 'classic-hit';
  b.type = 'button';
  b.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => { tap(); onClick(); });
  parent.appendChild(b);
  return b;
}

function img(parent, file, { x, y, w, h, onClick = null }) {
  const node = document.createElement('img');
  node.className = `classic-img${onClick ? ' classic-img--button' : ''}`;
  node.src = `assets/classic/${file}`;
  node.alt = '';
  node.loading = 'lazy';
  node.decoding = 'async';
  node.draggable = false;
  node.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  if (onClick) node.addEventListener('click', () => { tap(); onClick(); });
  parent.appendChild(node);
  return node;
}

function text(parent, className, value = '') {
  const node = document.createElement('div');
  node.className = `classic-text ${className}`;
  node.textContent = value;
  node.dir = 'auto';
  parent.appendChild(node);
  return node;
}

function tap() {
  unlock();
  sfx.tap();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
  if (name !== 'pitch') stopRound();
  if (name === 'home' || name === 'highscores') refreshHud();
}

/* ========================================================================== */
/*  HOME - home_background.png                                                 */
/* ========================================================================== */

let hudName = null;
let hudScore = null;
let muteButton = null;

function buildHome() {
  const s = addScreen('home');
  bg(s, 'home.webp');

  // start / high score / rules, centred at y 160, 360 and 560 in the original
  hit(s, { x: 380, y: 110, w: 520, h: 100, label: 'שחק עכשיו', onClick: () => showScreen('modes') });
  hit(s, { x: 380, y: 310, w: 520, h: 100, label: 'שיא נוכחי', onClick: () => { renderRanks(); showScreen('highscores'); } });
  hit(s, { x: 380, y: 510, w: 520, h: 100, label: 'חוקים', onClick: () => showScreen('rules') });

  // mute_button_rect: centred on (SCREEN_WIDTH - 165, SCREEN_HEIGHT - 70)
  // main.py drew unmute.png while the sound was ON, and mute.png while it was off
  muteButton = img(s, isMuted() ? 'mute.webp' : 'unmute.webp',
    { x: 1115 - 154, y: 650 - 46, w: 308, h: 93, onClick: toggleMute });
  muteButton.classList.add('classic-mute');

  hudName = text(s, 'classic-hud-name');
  hudScore = text(s, 'classic-hud-score');
}

function toggleMute() {
  const next = !isMuted();
  setMuted(next);
  store.set('muted', next);
  muteButton.src = `assets/classic/${next ? 'mute.webp' : 'unmute.webp'}`;
}

function refreshHud() {
  if (!hudName) return;
  hudName.textContent = store.get('playerName') || '';
  hudScore.textContent = String(store.getBest(LEAGUE_ID, difficulty.id, 'original'));
}

/* ========================================================================== */
/*  MODE SELECT - mode_selection_background.png                                */
/* ========================================================================== */

function buildModes() {
  const s = addScreen('modes');
  bg(s, 'modes.webp');
  // mode1_button_rect / mode2_button_rect: 400x400, centred at x 390 and 890
  img(s, 'mode1.webp', { x: 190, y: 160, w: 400, h: 400, onClick: () => showScreen('difficulty') });
  img(s, 'mode2.webp', { x: 690, y: 160, w: 400, h: 400, onClick: () => note(s, mode2Note()) });
  hit(s, { x: 500, y: 640, w: 280, h: 70, label: 'חזרה', onClick: () => showScreen('home') });
}

function mode2Note() {
  return {
    html: `<p>הפרמייר ליג כבר לא "Soon".<br>
             <small>במקור הלחיצה כאן לא עשתה כלום — בקוד כתוב
             "כרגע אין לוגיקה למוד 2, אבל השארתי אם תרצה להוסיף".
             הליגה הזו קיימת עכשיו בגרסה החדשה, יחד עם לה ליגה.</small></p>`,
    actions: [
      { label: 'קח אותי לפרמייר ליג', primary: true, onClick: () => { closeClassic(); onExit('premier-league'); } },
      { label: 'חזרה', onClick: null },
    ],
  };
}

/* ========================================================================== */
/*  DIFFICULTY - difficulty_selection_background.png                           */
/* ========================================================================== */

function buildDifficulty() {
  const s = addScreen('difficulty');
  bg(s, 'difficulty.webp');

  // easy / hard / impossible rects, straight from main.py
  DIFFICULTIES.forEach((d, i) => {
    hit(s, {
      x: 460, y: 240 + i * 140, w: 350, h: 100, label: HE_DIFFICULTY[d.id],
      onClick: () => startRound(d.id),
    });
  });

  // tutorial_button_rect, centred on (SCREEN_WIDTH/2 - 450, SCREEN_HEIGHT/2 + 293)
  img(s, 'tutorial.webp', { x: 190 - 174, y: 653 - 61, w: 348, h: 123, onClick: () => showScreen('rules') });
  hit(s, { x: 500, y: 640, w: 280, h: 70, label: 'חזרה', onClick: () => showScreen('modes') });
}

/* ========================================================================== */
/*  RULES - rules.png                                                          */
/* ========================================================================== */

function buildRules() {
  const s = addScreen('rules');
  bg(s, 'rules.webp');
  hit(s, { x: 0, y: 0, w: 1280, h: 720, label: 'חזרה לתפריט', onClick: () => showScreen('home') });
}

/* ========================================================================== */
/*  HIGH SCORES - high_score_background.png                                    */
/* ========================================================================== */

let rankRows = [];

function buildHighScores() {
  const s = addScreen('highscores');
  bg(s, 'highscores.webp');

  // the three tabs down the left: Rect((5,150),(200,60)) and friends
  DIFFICULTIES.forEach((d, i) => {
    hit(s, {
      x: 5, y: 150 + i * 80, w: 200, h: 60, label: HE_DIFFICULTY[d.id],
      onClick: () => { difficulty = d; renderRanks(); refreshHud(); },
    });
  });

  // the five medal rows painted into the background
  // the five medal bars painted into the background
  rankRows = [171, 281, 400, 531, 650].map((centreY) => {
    const row = document.createElement('div');
    row.className = 'classic-rank';
    row.style.top = `${centreY - 38}px`;
    row.dir = 'rtl';
    s.appendChild(row);
    return row;
  });

  // "לחץ כאן כדי לחזור לתפריט הראשי" is painted down both edges
  hit(s, { x: 1040, y: 430, w: 240, h: 250, label: 'חזרה לתפריט', onClick: () => showScreen('home') });
  hit(s, { x: 0, y: 430, w: 240, h: 250, label: 'חזרה לתפריט (שמאל)', onClick: () => showScreen('home') });
}

function renderRanks() {
  const name = store.get('playerName') || 'אתה';
  const rows = store.allBests()
    .filter((r) => r.league === LEAGUE_ID && r.mode === 'original' && r.difficulty === difficulty.id)
    .map((r) => ({ name, score: r.score }));

  rankRows.forEach((row, i) => {
    const entry = rows[i];
    row.classList.toggle('classic-rank--empty', !entry);
    row.innerHTML = entry
      ? `<span>${entry.name}</span><span>${entry.score}</span>`
      : '<span>—</span><span></span>';
  });
}

/* ========================================================================== */
/*  NAME ENTRY - name_input_background.png + VirtualKeyboard                   */
/* ========================================================================== */

function buildName() {
  const s = addScreen('name');
  bg(s, 'name.webp');

  const value = document.createElement('div');
  value.className = 'classic-name-value';
  value.dir = 'rtl';
  s.appendChild(value);

  // VirtualKeyboard.create_keys(), reproduced exactly
  const keys = ['ק','ר','א','ט','ו','ן','ם','פ',']','[',
                'ש','ד','ג','כ','ע','י','ח','ל','ך','ף',
                'ז','ס','ב','ה','נ','מ','צ','ת','ץ',
                '<-','SPACE'];
  const SIZE = 80;
  const MARGIN = 21;
  const totalWidth = 10 * (SIZE + MARGIN) - MARGIN;
  const startX = (STAGE.w - totalWidth) / 2;
  let row = -0.5;
  let col = 0;

  keys.forEach((key) => {
    const y = STAGE.h - (3 - row) * (SIZE + MARGIN) - MARGIN;
    const wide = key === 'SPACE';
    const x = wide ? startX : startX + col * (SIZE + MARGIN);
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'classic-key';
    node.textContent = key;
    node.style.cssText = `left:${x}px;top:${y}px;width:${wide ? totalWidth : SIZE}px;height:${SIZE}px`;
    node.addEventListener('click', () => {
      tap();
      if (key === '<-') nameDraft = nameDraft.slice(0, -1);
      else if (key === 'SPACE') nameDraft += ' ';
      else if (nameDraft.length < 14) nameDraft += key;
      value.textContent = nameDraft;
    });
    s.appendChild(node);
    col += wide ? 10 : 1;
    if (col > 9) { col = 0; row += 1; }
  });

  // save_button_rect: (SCREEN_WIDTH/2 - 700, SCREEN_HEIGHT/2 - 300), 400x300
  hit(s, {
    x: 0, y: 60, w: 300, h: 240, label: 'שמור בשם',
    onClick: () => {
      store.set('playerName', nameDraft.trim() || 'אתה');
      showScreen('home');
    },
  });
}

/* ========================================================================== */
/*  THE PITCH - background1.png                                                */
/* ========================================================================== */

let pitchScreen = null;
let cardLayer = null;
let scoreText = null;
let timeText = null;
let burstText = null;
let cornerNodes = [];

function buildPitch() {
  const s = addScreen('pitch');
  pitchScreen = s;
  bg(s, 'pitch.webp');

  cornerNodes = CORNERS.map((corner) => {
    const node = document.createElement('div');
    node.className = 'classic-corner';
    node.style.cssText = `left:${corner.x}px;top:${corner.y}px;width:${corner.w}px;height:${corner.h}px`;
    node.innerHTML = `<img src="assets/classic/${corner.art}" alt="" loading="lazy" decoding="async"
      style="width:${corner.artW}px;height:${corner.artH}px;left:0;top:0">`;
    s.appendChild(node);
    return node;
  });

  cardLayer = document.createElement('div');
  cardLayer.style.cssText = 'position:absolute;inset:0';
  s.appendChild(cardLayer);

  scoreText = text(s, 'classic-score', '0');
  timeText = text(s, 'classic-time', '60');

  burstText = document.createElement('div');
  burstText.className = 'classic-burst';
  s.appendChild(burstText);

  // back_button_rect: Rect(550, 620, 150, 50).inflate(100, 20)
  hit(s, { x: 500, y: 610, w: 250, h: 70, label: 'חזור לתפריט הראשי', onClick: () => showScreen('home') });
}

/* ---------- the round -------------------------------------------------------- */

function startRound(difficultyId) {
  difficulty = getDifficulty(difficultyId);
  stopRound();

  game = createGame({ league, players, difficulty, mode: getMode('original') });
  cards = [];
  nextSpawnAt = 0;
  scoreText.textContent = '0';
  timeText.textContent = String(game.state.maxTime);

  showScreen('pitch');
  spawnCard();

  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
}

function stopRound() {
  if (rafId) cancelAnimationFrame(rafId);
  if (burstTimer) clearTimeout(burstTimer);
  rafId = null;
  burstTimer = null;
  cards.forEach((card) => { detach(card); card.el.remove(); });
  cards = [];
  game = null;
}

function spawnCard() {
  if (!game) return;
  const question = game.nextQuestion(CORNERS.map((c) => c.club));
  if (!question) return;

  const physics = difficulty.arena;
  const card = {
    question,
    // create_new_ball(): a random spot on the screen, the radius kept clear
    x: rand(CARD.radius, STAGE.w - CARD.radius),
    y: rand(CARD.radius, STAGE.h - CARD.radius),
    vy: physics.rise * STAGE.h,          // the original's px/frame, as px/second
    gravity: physics.gravity * STAGE.h,
    dragging: false,
    pointerId: null,
    grabDX: 0,
    grabDY: 0,
    el: document.createElement('div'),
  };

  const player = question.player;
  card.el.className = 'classic-card';
  card.el.innerHTML = `
    <img class="classic-card__frame" src="assets/classic/card.webp" alt="" draggable="false">
    ${player.image
      ? `<img class="classic-card__photo" src="${player.image}" alt="" draggable="false" loading="eager" decoding="async">`
      : `<span class="classic-card__initials">?</span>`}
    <div class="classic-card__name" dir="rtl">${player.name}</div>`;
  card.el.addEventListener('pointerdown', (e) => grab(card, e));
  cardLayer.appendChild(card.el);

  place(card);
  cards.push(card);
}

function place(card) {
  card.el.style.transform = `translate3d(${card.x - CARD.w / 2}px, ${card.y - CARD.h / 2}px, 0)`;
}

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

    // has_fallen_off_screen(): y - radius > SCREEN_HEIGHT
    if (card.y - CARD.radius > STAGE.h) {
      const result = game.dropCard();
      sfx.wrong();
      burst(result.gained);
      scoreText.textContent = String(game.state.score);
      remove(card);
      spawnCard();
    }
  });

  const physics = difficulty.arena;
  if (physics.maxCards > 1 && cards.length < physics.maxCards) {
    if (!nextSpawnAt) nextSpawnAt = now + rand(...physics.secondCardAfter) * 1000;
    else if (now > nextSpawnAt) { spawnCard(); nextSpawnAt = 0; }
  }

  timeText.textContent = String(Math.max(0, Math.floor(game.state.timeLeft)));

  if (game.state.over) { endRound(); return; }
  rafId = requestAnimationFrame(loop);
}

/* ---------- dragging ---------------------------------------------------------- */

function grab(card, event) {
  if (!game || game.state.over || card.dragging) return;
  event.preventDefault();
  card.dragging = true;
  card.pointerId = event.pointerId;
  card.el.classList.add('is-held');
  try { card.el.setPointerCapture(event.pointerId); } catch { /* not fatal */ }

  const point = toStage(event);
  card.grabDX = card.x - point.x;
  card.grabDY = card.y - point.y;

  card.onMove = (e) => moveCard(card, e);
  card.onUp = (e) => releaseCard(card, e);
  window.addEventListener('pointermove', card.onMove);
  window.addEventListener('pointerup', card.onUp);
  window.addEventListener('pointercancel', card.onUp);
}

function moveCard(card, event) {
  if (!card.dragging || event.pointerId !== card.pointerId) return;
  const point = toStage(event);
  card.x = point.x + card.grabDX;
  card.y = point.y + card.grabDY;
  place(card);
  // draw_corners(): light a corner only while a card is over it
  const index = cornerAt(card.x, card.y);
  cornerNodes.forEach((node, i) => node.classList.toggle('is-hot', i === index));
}

function releaseCard(card, event) {
  if (!card.dragging) return;
  card.dragging = false;
  detach(card);
  card.el.classList.remove('is-held');
  cornerNodes.forEach((node) => node.classList.remove('is-hot'));

  const index = cornerAt(card.x, card.y);
  const option = index >= 0
    ? card.question.options.find((o) => o.id === CORNERS[index].club)
    : null;
  const result = game.answer(option || { played: false, isMain: false, points: 0 });
  if (!result) return;

  if (result.verdict === 'wrong') {
    sfx.wrong();
    card.el.classList.add('is-wrong');
  } else {
    sfx[result.verdict === 'main' ? 'correct' : 'partial'](0);
    // snap_to_corner()
    const corner = CORNERS[index];
    card.x = corner.x + corner.w / 2;
    card.y = corner.y + corner.h / 2;
    card.el.classList.add('is-snapped');
    place(card);
  }

  burst(result.gained);
  scoreText.textContent = String(game.state.score);

  window.setTimeout(() => {
    if (!game) return;
    remove(card);
    if (!game.state.over) spawnCard();
  }, 240);
}

/** Viewport coordinates -> stage coordinates, through the scale and the rotation. */
function toStage(event) {
  const box = stage.getBoundingClientRect();
  const portrait = window.innerHeight > window.innerWidth;
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  const scale = portrait ? box.height / STAGE.w : box.width / STAGE.w;
  // undo the 90deg rotation the stage is drawn with on a portrait screen
  const sx = portrait ? dy / scale : dx / scale;
  const sy = portrait ? -dx / scale : dy / scale;
  return { x: sx + STAGE.w / 2, y: sy + STAGE.h / 2 };
}

function cornerAt(x, y) {
  return CORNERS.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
}

function remove(card) {
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

/* ---------- finishing ---------------------------------------------------------- */

function endRound() {
  const score = game.state.score;
  const bestStreak = game.state.bestStreak;
  stopRound();
  sfx.gameOver();
  store.recordStreak(bestStreak);
  store.countGame();
  store.saveBest(LEAGUE_ID, difficulty.id, 'original', score);

  // The original went straight back to the menu, asking for a name the first time.
  if (!store.get('playerName')) {
    nameDraft = '';
    showScreen('name');
  } else {
    renderRanks();
    showScreen('home');
  }
}

/* ---------- odds and ends ------------------------------------------------------- */

function burst(value) {
  if (burstTimer) clearTimeout(burstTimer);
  burstText.textContent = value >= 0 ? `+${value}` : String(value);
  burstText.classList.remove('is-live');
  void burstText.offsetWidth;
  burstText.classList.add('is-live');
  burstTimer = setTimeout(() => burstText.classList.remove('is-live'), 1000);
}

function note(parent, { html, actions }) {
  const box = document.createElement('div');
  box.className = 'classic-note';
  box.innerHTML = `<div class="classic-note__box">${html}<div class="classic-note__actions"></div></div>`;
  const row = box.querySelector('.classic-note__actions');
  actions.forEach((action) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `classic-note__btn${action.primary ? ' classic-note__btn--go' : ''}`;
    b.textContent = action.label;
    b.addEventListener('click', () => { tap(); box.remove(); action.onClick?.(); });
    row.appendChild(b);
  });
  parent.appendChild(box);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
