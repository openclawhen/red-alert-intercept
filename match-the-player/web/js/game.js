/* ==========================================================================
   game.js - drives the game screen: renders a question, handles a tap,
   animates the feedback, runs the clock.
   ========================================================================== */

import { SCORING } from './config.js';
import { createGame } from './engine.js';
import { clubOption, playerCard } from './components.js';
import { sfx } from './audio.js';
import { store } from './storage.js';

const el = {};
let game = null;
let logoSet = null;
let locked = false;      // ignore taps while an answer is being revealed
let rafId = null;
let lastFrame = 0;
let nextTimer = null;
let lastTickSecond = -1;
let onFinish = () => {};

export function initGame(refs, logos, finishHandler) {
  Object.assign(el, refs);
  logoSet = logos;
  onFinish = finishHandler;
  el.clubGrid.addEventListener('click', handleClick);
}

/* ---------- lifecycle ------------------------------------------------------ */

export function startGame({ league, difficulty, mode, players }) {
  stopLoop();
  game = createGame({ league, difficulty, mode, players });
  locked = false;
  lastTickSecond = -1;

  el.bar.classList.remove('is-low', 'is-critical');
  renderLives();
  renderHud();
  nextQuestion();

  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
  return game;
}

export function stopGame() {
  stopLoop();
  game = null;
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  if (nextTimer) clearTimeout(nextTimer);
  rafId = null;
  nextTimer = null;
}

function loop(now) {
  if (!game || game.state.over) return;
  const dt = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;

  game.tick(dt);
  renderTimer();

  if (game.state.over) {
    finish();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

/* ---------- question flow --------------------------------------------------- */

function nextQuestion() {
  const { question } = { question: game.nextQuestion() };
  locked = false;

  el.cardStage.innerHTML = playerCard(question.player, game.difficulty, {
    revealed: false,
    tint: `color-mix(in srgb, ${game.league.accent} 22%, transparent)`,
    league: game.league,
  });

  el.clubGrid.className = `club-grid${question.options.length > 4 ? ' is-six' : ''}`;
  el.clubGrid.innerHTML = question.options
    .map((club, i) => clubOption(club, i, logoSet))
    .join('');

  el.feedback.className = 'feedback';
  el.feedback.textContent = '';
  el.progress.textContent = `Q${game.state.asked}`;
}

function handleClick(event) {
  const button = event.target.closest('.club-option');
  if (!button || locked || !game || game.state.over) return;

  const index = Number(button.dataset.option);
  const option = game.state.question.options[index];
  if (!option) return;

  locked = true;
  const result = game.answer(option);
  revealAnswer(button, result);
}

function revealAnswer(button, result) {
  const { options, player } = game.state.question;
  const card = el.cardStage.querySelector('.player-card');

  // Mark up every option so the player learns something from a miss
  el.clubGrid.querySelectorAll('.club-option').forEach((node, i) => {
    const option = options[i];
    node.disabled = true;
    if (option.isMain) {
      node.classList.add('is-correct');
      node.insertAdjacentHTML('beforeend', `<span class="club-option__score">+${option.points}</span>`);
    } else if (option.played) {
      node.classList.add('is-partial');
      node.insertAdjacentHTML('beforeend', `<span class="club-option__score">+${option.points}</span>`);
    } else if (node === button) {
      node.classList.add('is-wrong');
    } else {
      node.classList.add('is-dim');
    }
  });

  if (result.verdict === 'wrong') {
    card?.classList.add('is-wrong');
    sfx.wrong();
    setFeedback('is-bad', `Never played there · −${SCORING.wrongPenalty}`);
  } else if (result.verdict === 'partial') {
    card?.classList.add('is-correct');
    sfx.partial();
    setFeedback('is-partial', `He did play there — but not the longest · +${result.gained}`);
  } else {
    card?.classList.add('is-correct');
    sfx.correct(game.state.streak);
    setFeedback('is-good', `${praise(game.state.streak)} · +${result.gained}`);
  }

  // Reveal the name and the full career on the card
  el.cardStage.innerHTML = playerCard(player, game.difficulty, {
    revealed: true,
    tint: `color-mix(in srgb, ${game.league.accent} 22%, transparent)`,
    league: game.league,
  });
  const revealedCard = el.cardStage.querySelector('.player-card');
  revealedCard?.classList.add(result.verdict === 'wrong' ? 'is-wrong' : 'is-correct');

  showDelta(result.gained);
  renderHud();
  renderLives();

  if (game.state.over) {
    finish();
    return;
  }

  const wait = result.verdict === 'wrong' ? SCORING.revealMsWrong : SCORING.revealMs;
  nextTimer = setTimeout(nextQuestion, wait);
}

function praise(streak) {
  if (streak >= 12) return 'Unstoppable';
  if (streak >= 7) return 'On fire';
  if (streak >= 3) return 'Nice run';
  return 'Correct';
}

function setFeedback(cls, text) {
  el.feedback.className = `feedback ${cls}`;
  el.feedback.innerHTML = `<span>${text}</span>`;
}

/* ---------- HUD ------------------------------------------------------------- */

function renderHud() {
  const s = game.state;
  el.score.textContent = s.score;
  el.streak.textContent = `Streak ${s.streak}`;
  el.combo.textContent = `x${s.combo}`;
  el.combo.classList.toggle('is-hot', s.combo > 1);
  el.progress.textContent = `Q${s.asked}`;
}

function renderLives() {
  if (!game.mode.useLives) {
    el.lives.innerHTML = '<span class="chip">∞ lives</span>';
    return;
  }
  const total = game.state.maxLives;
  const left = Math.max(0, game.state.lives);
  el.lives.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="life ${i < left ? '' : 'is-lost'}"></span>`).join('');
}

function renderTimer() {
  const s = game.state;
  if (!game.mode.useTimer) {
    el.barWrap.hidden = true;
    return;
  }
  el.barWrap.hidden = false;
  const ratio = Math.max(0, s.timeLeft / s.maxTime);
  el.bar.style.transform = `scaleX(${ratio})`;
  el.bar.classList.toggle('is-low', ratio < 0.35);
  el.bar.classList.toggle('is-critical', ratio < 0.15);

  const whole = Math.ceil(s.timeLeft);
  if (whole <= 5 && whole !== lastTickSecond) {
    lastTickSecond = whole;
    if (whole > 0) sfx.tick();
  }
}

function showDelta(value) {
  el.delta.className = 'hud__score-delta';
  // restart the animation
  void el.delta.offsetWidth;
  el.delta.textContent = value >= 0 ? `+${value}` : `${value}`;
  el.delta.classList.add(value >= 0 ? 'is-up' : 'is-down');
}

/* ---------- finishing -------------------------------------------------------- */

function finish() {
  stopLoop();
  const s = game.state;
  store.recordStreak(s.bestStreak);
  store.countGame();
  const isBest = store.saveBest(game.league.id, game.difficulty.id, game.mode.id, s.score);
  sfx.gameOver();
  onFinish({
    score: s.score,
    reason: s.reason || 'Full time',
    correct: s.correct + s.partial,
    bestStreak: s.bestStreak,
    accuracy: game.accuracy(),
    isBest,
    league: game.league,
    difficulty: game.difficulty,
    mode: game.mode,
  });
}
