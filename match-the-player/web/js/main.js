/* ==========================================================================
   main.js - boots the game, owns navigation between screens, and wires up
   the menus. The actual gameplay lives in game.js.
   ========================================================================== */

import { DIFFICULTIES, MODES, getDifficulty, getMode } from './config.js';
import { loadLeagues, loadClubLogos, loadPlayers, getLeague, poolFor } from './data.js';
import { initGame, startGame, stopGame } from './game.js';
import { initArena, startArena, stopArena } from './arena.js';
import { openClassic } from './classic.js';
import { escapeHtml, dirFor } from './components.js';
import { icon } from './art.js';
import { store } from './storage.js';
import { sfx, setMuted, isMuted, setMusic, unlock } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const screens = {};
const stack = [];

let leagues = [];
let logoSet = new Set();
let selection = {
  league: store.get('league'),
  difficulty: store.get('difficulty'),
  mode: store.get('mode'),
};
let poolCounts = {};   // difficulty id -> number of players available

/* ========================================================================== */
/*  Boot                                                                       */
/* ========================================================================== */

async function boot() {
  $$('[data-screen]').forEach((node) => { screens[node.dataset.screen] = node; });

  try {
    [leagues, logoSet] = await Promise.all([loadLeagues(), loadClubLogos()]);
  } catch (error) {
    showFatal(error);
    return;
  }

  // Fall back to the first playable league if a stored choice disappeared
  if (!getLeague(leagues, selection.league)?.available) {
    selection.league = leagues.find((l) => l.available).id;
  }

  initGame({
    cardStage: $('#card-stage'),
    clubGrid: $('#club-grid'),
    feedback: $('#feedback'),
    score: $('#hud-score'),
    delta: $('#hud-delta'),
    lives: $('#hud-lives'),
    bar: $('#hud-bar'),
    barWrap: $('#hud-bar-wrap'),
    streak: $('#hud-streak'),
    combo: $('#hud-combo'),
    progress: $('#hud-progress'),
  }, logoSet, showGameOver);

  initArena({
    arena: $('#arena'),
    cards: $('#arena-cards'),
    feedback: $('#arena-feedback'),
    score: $('#arena-score'),
    bar: $('#arena-bar'),
    clock: $('#arena-clock'),
    streak: $('#arena-cards-count'),
  }, logoSet, showGameOver);

  // fill every icon slot from the drawn set
  $$('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon, { size: 20 }); });

  setMuted(store.get('muted'));
  renderSoundToggle();
  renderHome();
  wireGlobalClicks();
  goHome();
}

function showFatal(error) {
  const box = $('#fatal');
  $('#fatal-text').textContent = String(error.message || error).includes('Failed to fetch')
    ? 'The game data could not be read. If you opened index.html straight from the file system, '
      + 'serve the folder instead - for example: python3 -m http.server 8000'
    : `${error.message || error}`;
  box.hidden = false;
  console.error('[Match The Player] boot failed:', error);
}

/* ========================================================================== */
/*  Navigation                                                                 */
/* ========================================================================== */

function display(name) {
  Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
  if (name !== 'game') stopGame();
  if (name !== 'arena') stopArena();
  applyAccent(name);
  window.scrollTo(0, 0);
}

/** Push a screen onto the stack (or swap the current one when `replace`). */
function show(name, { replace = false } = {}) {
  const current = stack[stack.length - 1];
  if (current === name) return;
  if (replace && stack.length) stack[stack.length - 1] = name;
  else stack.push(name);
  display(name);
}

/** Step back one screen. Falls back to the home screen. */
function back() {
  stack.pop();
  const previous = stack[stack.length - 1] || 'home';
  if (!stack.length) stack.push('home');
  if (previous === 'home') renderHome();
  display(previous);
}

function goHome() {
  stack.splice(0, stack.length, 'home');
  renderHome();
  display('home');
}

/** Tints the whole UI with the selected league's colour. */
function applyAccent(screenName) {
  const league = getLeague(leagues, selection.league);
  const useLeagueColour = ['difficulty', 'game', 'arena', 'gameover'].includes(screenName) && league;
  const root = document.documentElement.style;
  root.setProperty('--accent', useLeagueColour ? league.accent : '#00ff9d');
  root.setProperty('--accent-2', useLeagueColour ? (league.accent2 || '#3d7bff') : '#3d7bff');
}

/* ========================================================================== */
/*  Screens                                                                    */
/* ========================================================================== */

function renderHome() {
  $('#home-best').textContent = store.topScore();
  $('#home-streak').textContent = store.get('bestStreak');
  $('#home-games').textContent = store.get('gamesPlayed');
}

function renderLeagues() {
  $('#league-grid').innerHTML = leagues.map((league) => `
    <button class="league-card ${league.id === selection.league ? 'is-selected' : ''}"
            type="button" data-league="${league.id}" style="--card-accent:${league.accent}"
            ${league.available ? '' : 'disabled'}>
      <span class="league-card__emblem">${league.emblem}</span>
      <span class="league-card__body">
        <span class="league-card__name" dir="${dirFor(league.name)}">${escapeHtml(league.name)}</span>
        <span class="league-card__meta">${escapeHtml(league.country)}${league.available ? ` · ${league.clubs.length} clubs` : ''}</span>
      </span>
      <span class="league-card__tag ${league.available ? 'league-card__tag--live' : ''}">${league.available ? 'Play' : 'Soon'}</span>
    </button>`).join('');
}

async function renderDifficulty() {
  const league = getLeague(leagues, selection.league);
  $('#difficulty-league-label').textContent = `${league.name} · ${league.country}`;

  // Count how many players each difficulty can actually ask about
  poolCounts = {};
  try {
    const players = await loadPlayers(league.id);
    DIFFICULTIES.forEach((d) => { poolCounts[d.id] = poolFor(players, league, d).length; });
  } catch (error) {
    showFatal(error);
    return;
  }

  // A stored difficulty with an empty pool would dead-end the start button
  if (!poolCounts[selection.difficulty]) {
    const firstPlayable = DIFFICULTIES.find((d) => poolCounts[d.id] > 0);
    if (firstPlayable) selection.difficulty = firstPlayable.id;
  }

  const mode = getMode(selection.mode);
  $('#difficulty-list').innerHTML = DIFFICULTIES.map((d) => `
    <button class="diff-card ${d.id === selection.difficulty ? 'is-selected' : ''}"
            type="button" data-difficulty="${d.id}" style="--diff:${d.color}"
            ${poolCounts[d.id] ? '' : 'disabled'}>
      <span class="diff-card__dot"></span>
      <span class="diff-card__body">
        <span class="diff-card__name">${d.name}</span>
        <span class="diff-card__desc">${escapeHtml(mode.arena ? d.arenaDesc : d.desc)}</span>
      </span>
      <span class="diff-card__count">${poolCounts[d.id] || 0}</span>
    </button>`).join('');

  $('#mode-chips').innerHTML = MODES.map((m) => `
    <button class="mode-chip ${m.id === selection.mode ? 'is-selected' : ''}" type="button"
            data-mode="${m.id}" ${m.available ? '' : 'disabled'}>${m.name}</button>`).join('');

  $('#mode-hint').textContent = getMode(selection.mode).hint;
  $('[data-action="start"]').disabled = !poolCounts[selection.difficulty];
}

function renderScores() {
  const rows = store.allBests().filter((entry) => entry.score > 0);
  const list = $('#scores-list');

  if (!rows.length) {
    list.innerHTML = '<p class="scores-empty">No records yet. Play a round and this fills up.</p>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const league = getLeague(leagues, row.league);
    return `<div class="score-row">
      <span class="score-row__emblem">${league ? league.emblem : '⚽'}</span>
      <span class="score-row__body">
        <span class="score-row__league" dir="${dirFor(league?.name || row.league)}">${escapeHtml(league ? league.name : row.league)}</span>
        <span class="score-row__diff">${escapeHtml(getDifficulty(row.difficulty).name)} · ${escapeHtml(getMode(row.mode).name)}</span>
      </span>
      <span class="score-row__value">${row.score}</span>
    </div>`;
  }).join('');
}

function showGameOver(result) {
  $('#over-reason').textContent = result.reason;
  $('#over-score').textContent = result.score;
  $('#over-correct').textContent = result.correct;
  $('#over-streak').textContent = result.bestStreak;
  $('#over-accuracy').textContent = `${result.accuracy}%`;
  $('#over-best').hidden = !result.isBest;
  $('#over-context').textContent =
    `${result.league.name} · ${result.difficulty.name} · ${result.mode.name}`
    + (result.dropped ? ` · ${result.dropped} dropped` : '')
    + (result.isBest ? '' : ` · best ${store.getBest(result.league.id, result.difficulty.id, result.mode.id)}`);
  show('gameover');
}

/* ========================================================================== */
/*  Starting a round                                                           */
/* ========================================================================== */

async function play() {
  const league = getLeague(leagues, selection.league);
  const difficulty = getDifficulty(selection.difficulty);
  const mode = getMode(selection.mode);

  try {
    const players = await loadPlayers(league.id);
    // Original mode is played in the falling-card arena; everything else is tap-to-answer.
    if (mode.arena) {
      show('arena');
      startArena({ league, difficulty, mode, players });
    } else {
      show('game');
      startGame({ league, difficulty, mode, players });
    }
  } catch (error) {
    showFatal(error);
  }
}

/* ========================================================================== */
/*  Events                                                                     */
/* ========================================================================== */

function wireGlobalClicks() {
  document.addEventListener('click', async (event) => {
    const actionEl = event.target.closest('[data-action]');
    const leagueEl = event.target.closest('[data-league]');
    const diffEl = event.target.closest('[data-difficulty]');
    const modeEl = event.target.closest('[data-mode]');

    if (actionEl || leagueEl || diffEl || modeEl) {
      // Setting up the audio context can take a moment on the very first tap,
      // so it happens in its own task - the screen must never wait on sound.
      setTimeout(() => { unlock(); sfx.tap(); }, 0);
    }

    if (leagueEl) {
      selection.league = store.set('league', leagueEl.dataset.league);
      renderLeagues();
      applyAccent('league');
      await renderDifficulty();
      show('difficulty');
      return;
    }

    if (diffEl) {
      selection.difficulty = store.set('difficulty', diffEl.dataset.difficulty);
      await renderDifficulty();
      return;
    }

    if (modeEl) {
      selection.mode = store.set('mode', modeEl.dataset.mode);
      await renderDifficulty();
      return;
    }

    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'play':
        renderLeagues();
        show('league');
        break;
      case 'start':
        play();
        break;
      case 'replay':
        play();
        break;
      case 'change-level':
        await renderDifficulty();
        show('difficulty', { replace: true });
        break;
      case 'home':
        goHome();
        break;
      case 'quit':
        stopGame();
        stopArena();
        goHome();
        break;
      case 'back':
        back();
        break;
      case 'classic':
        stopGame();
        stopArena();
        openClassic(leagues, async (jumpToLeague) => {
          // the classic mode-2 screen can hand us straight to a modern league
          if (jumpToLeague && getLeague(leagues, jumpToLeague)?.available) {
            selection.league = store.set('league', jumpToLeague);
            renderLeagues();
            await renderDifficulty();
            stack.splice(0, stack.length, 'home', 'league');
            show('difficulty');
            return;
          }
          goHome();
        }).catch(showFatal);
        break;
      case 'how-to':
        openHowTo();
        break;
      case 'close-modal':
        closeHowTo();
        break;
      case 'dismiss-modal':
        // The backdrop covers the whole screen, so the very tap that opened the
        // modal can land on it straight after. Ignore taps for a moment.
        if (Date.now() - modalOpenedAt > 250) closeHowTo();
        break;
      case 'scores':
        renderScores();
        show('scores');
        break;
      case 'reset-scores':
        store.resetRecords();
        renderScores();
        renderHome();
        break;
      default:
        break;
    }
  });

  $('#sound-toggle').addEventListener('click', () => {
    const next = !isMuted();
    setMuted(next);
    store.set('muted', next);
    setMusic(!next && store.get('music'));
    renderSoundToggle();
    if (!next) sfx.tap();
  });

  // Long-press / right-click the speaker to toggle the ambient music layer
  $('#sound-toggle').addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const next = !store.get('music');
    store.set('music', next);
    setMusic(next && !isMuted());
    renderSoundToggle();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('#howto').hidden) closeHowTo();
      else if (stack.length > 1) back();
    }
  });
}

let modalOpenedAt = 0;

function openHowTo() {
  modalOpenedAt = Date.now();
  $('#howto').hidden = false;
}

function closeHowTo() {
  $('#howto').hidden = true;
}

function renderSoundToggle() {
  const button = $('#sound-toggle');
  const muted = isMuted();
  button.classList.toggle('is-muted', muted);
  button.querySelector('.sound-toggle__icon').innerHTML =
    icon(muted ? 'muted' : 'sound', { size: 19 });
  button.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  button.title = muted ? 'Sound off — tap to unmute' : 'Sound on — long-press for music';
}

boot();
