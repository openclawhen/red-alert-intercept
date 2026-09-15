/* ==========================================================================
   storage.js - everything that survives a page reload lives here.
   Uses localStorage, wrapped so a blocked/private browser never breaks the game.
   ========================================================================== */

const KEY = 'matchtheplayer.v1';

const DEFAULTS = {
  muted: false,
  music: false,
  league: 'premier-league',
  difficulty: 'easy',
  mode: 'original',
  bestStreak: 0,
  gamesPlayed: 0,
  // best scores keyed by "<league>|<difficulty>|<mode>"
  best: {},
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / storage full - the game still plays, it just forgets */
  }
}

let state = read();

export const store = {
  get(key) {
    return state[key];
  },

  set(key, value) {
    state[key] = value;
    write(state);
    return value;
  },

  all() {
    return { ...state };
  },

  bestKey(league, difficulty, mode) {
    return `${league}|${difficulty}|${mode}`;
  },

  getBest(league, difficulty, mode) {
    return state.best[this.bestKey(league, difficulty, mode)] || 0;
  },

  /** Returns true when the score beat the stored record. */
  saveBest(league, difficulty, mode, score) {
    const key = this.bestKey(league, difficulty, mode);
    const isBest = score > (state.best[key] || 0);
    if (isBest) {
      state.best = { ...state.best, [key]: score };
      write(state);
    }
    return isBest;
  },

  /** Highest score across every league/difficulty combination. */
  topScore() {
    const values = Object.values(state.best);
    return values.length ? Math.max(...values) : 0;
  },

  allBests() {
    return Object.entries(state.best).map(([key, score]) => {
      const [league, difficulty, mode] = key.split('|');
      return { league, difficulty, mode, score };
    }).sort((a, b) => b.score - a.score);
  },

  recordStreak(streak) {
    if (streak > state.bestStreak) this.set('bestStreak', streak);
  },

  countGame() {
    this.set('gamesPlayed', (state.gamesPlayed || 0) + 1);
  },

  resetRecords() {
    state = { ...state, best: {}, bestStreak: 0, gamesPlayed: 0 };
    write(state);
  },
};
