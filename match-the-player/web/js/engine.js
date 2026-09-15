/* ==========================================================================
   engine.js - the rules of the game. Pure state, no DOM, no sound.
   The UI calls start/answer/tick and reads `state` back.
   ========================================================================== */

import { SCORING, comboFor, secondsFor, multiplierFor } from './config.js';
import { buildQuestion, createQueue, poolFor } from './data.js';

export function createGame({ league, difficulty, mode, players }) {
  const pool = poolFor(players, league, difficulty);
  if (!pool.length) {
    throw new Error(`No players available for ${league.id} / ${difficulty.id}`);
  }

  const queue = createQueue(pool);

  // Original mode scored exactly what the old character_color_map said: no
  // streak bonus, no difficulty scaling, and no floor under the score.
  const useCombo = mode.useCombo !== false;
  const clampScore = mode.clampScore !== false;
  const multiplier = multiplierFor(difficulty, mode);
  const roundSeconds = secondsFor(difficulty, mode);
  const optionCount = mode.options ?? difficulty.options;

  const state = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    combo: 1,
    lives: mode.useLives ? difficulty.lives : Infinity,
    maxLives: mode.useLives ? difficulty.lives : 0,
    asked: 0,
    correct: 0,
    partial: 0,
    wrong: 0,
    dropped: 0,
    timeLeft: mode.useTimer ? roundSeconds : Infinity,
    maxTime: mode.useTimer ? roundSeconds : 0,
    poolSize: pool.length,
    question: null,
    over: false,
    reason: '',
  };

  /**
   * Draw the next question.
   * `fixedClubs` pins the club buttons (the arena keeps the same four corners
   * while cards are still in play), and only players answerable with those
   * clubs are drawn.
   */
  function nextQuestion(fixedClubs = null) {
    const fixedIds = fixedClubs ? fixedClubs.map((c) => (typeof c === 'string' ? c : c.id)) : null;
    const player = fixedIds ? queue.nextMatching(fixedIds) : queue.next();
    if (!player) return null;
    state.question = buildQuestion(player, league, difficulty, { fixedClubs, optionCount });
    state.asked += 1;
    return state.question;
  }

  /**
   * Resolve a tapped club.
   * Returns { verdict: 'main' | 'partial' | 'wrong', gained, combo, points }.
   */
  function answer(option) {
    if (state.over || !state.question) return null;

    if (option.played) {
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.combo = useCombo ? comboFor(state.streak) : 1;

      const gained = Math.round(option.points * state.combo * multiplier);
      state.score += gained;

      if (option.isMain) state.correct += 1;
      else state.partial += 1;

      if (mode.useTimer && difficulty.bonusSeconds) {
        state.timeLeft = Math.min(state.maxTime, state.timeLeft + difficulty.bonusSeconds);
      }

      return {
        verdict: option.isMain ? 'main' : 'partial',
        gained,
        combo: state.combo,
        points: option.points,
      };
    }

    // Wrong club
    state.streak = 0;
    state.combo = 1;
    state.wrong += 1;
    state.score = applyPenalty(SCORING.wrongPenalty);

    if (mode.useLives) {
      state.lives -= 1;
      if (state.lives <= 0) end('No lives left');
    }
    if (mode.penaltySeconds && mode.useTimer) {
      state.timeLeft = Math.max(0, state.timeLeft - mode.penaltySeconds);
      if (state.timeLeft <= 0) end('Full time');
    }

    return { verdict: 'wrong', gained: -SCORING.wrongPenalty, combo: 1, points: 0 };
  }

  function applyPenalty(amount) {
    const next = state.score - amount;
    return clampScore ? Math.max(0, next) : next;
  }

  /**
   * The original docked 50 points when a card fell off the bottom of the screen.
   * It is a miss, not a wrong answer, so it does not count against accuracy.
   */
  function dropCard() {
    if (state.over) return null;
    state.streak = 0;
    state.combo = 1;
    state.dropped += 1;
    state.score = applyPenalty(SCORING.dropPenalty);
    return { verdict: 'dropped', gained: -SCORING.dropPenalty, combo: 1, points: 0 };
  }

  /** Advance the clock by `seconds`. No-op for modes without a timer. */
  function tick(seconds) {
    if (state.over || !mode.useTimer) return;
    state.timeLeft = Math.max(0, state.timeLeft - seconds);
    if (state.timeLeft <= 0) end('Full time');
  }

  function end(reason) {
    if (state.over) return;
    state.over = true;
    state.reason = reason;
  }

  function accuracy() {
    const answered = state.correct + state.partial + state.wrong;
    if (!answered) return 0;
    return Math.round(((state.correct + state.partial) / answered) * 100);
  }

  return { state, nextQuestion, answer, dropCard, tick, end, accuracy, league, difficulty, mode };
}
