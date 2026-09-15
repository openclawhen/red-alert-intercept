/* ==========================================================================
   engine.js - the rules of the game. Pure state, no DOM, no sound.
   The UI calls start/answer/tick and reads `state` back.
   ========================================================================== */

import { SCORING, comboFor } from './config.js';
import { buildQuestion, createQueue, poolFor } from './data.js';

export function createGame({ league, difficulty, mode, players }) {
  const pool = poolFor(players, league, difficulty);
  if (!pool.length) {
    throw new Error(`No players available for ${league.id} / ${difficulty.id}`);
  }

  const queue = createQueue(pool);

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
    timeLeft: mode.useTimer ? difficulty.seconds : Infinity,
    maxTime: mode.useTimer ? difficulty.seconds : 0,
    poolSize: pool.length,
    question: null,
    over: false,
    reason: '',
  };

  function nextQuestion() {
    state.question = buildQuestion(queue.next(), league, difficulty);
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
      state.combo = comboFor(state.streak);

      const gained = Math.round(option.points * state.combo * difficulty.scoreMultiplier);
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
    state.score = Math.max(0, state.score - SCORING.wrongPenalty);

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

  return { state, nextQuestion, answer, tick, end, accuracy, league, difficulty, mode };
}
