/* ==========================================================================
   config.js - the tuning knobs. Difficulties and game modes are plain data so
   a new one is a few lines here, not a change in the engine.
   ========================================================================== */

export const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy',
    desc: 'Household names, four clubs, every clue on show.',
    color: '#22e08a',
    tiers: ['easy'],          // which player tiers feed the question pool
    options: 4,               // number of club buttons
    lives: 5,
    seconds: 90,
    bonusSeconds: 2,          // added to the clock for a correct answer
    scoreMultiplier: 1,
    hints: ['nationality', 'position', 'currentClub'],
    showName: true,
  },
  {
    id: 'hard',
    name: 'Hard',
    desc: 'A far wider squad list and only half the clues.',
    color: '#ffc24b',
    tiers: ['easy', 'hard'],
    options: 4,
    lives: 3,
    seconds: 75,
    bonusSeconds: 1,
    scoreMultiplier: 1.5,
    hints: ['position'],
      showName: true,
  },
  {
    id: 'impossible',
    name: 'Impossible',
    desc: 'Journeymen and cult heroes. Six clubs. No help at all.',
    color: '#ff4d5e',
    tiers: ['hard', 'impossible'],
    options: 6,
    lives: 2,
    seconds: 60,
    bonusSeconds: 1,
    scoreMultiplier: 2,
    hints: [],
    showName: false,          // the name is hidden until the answer is revealed
  },
];

export const MODES = [
  {
    id: 'classic',
    name: 'Classic',
    hint: 'Beat the clock with a handful of lives. The original rules.',
    available: true,
    useTimer: true,
    useLives: true,
  },
  {
    id: 'endless',
    name: 'Endless',
    hint: 'No clock. Play until your lives run out.',
    available: true,
    useTimer: false,
    useLives: true,
  },
  {
    id: 'time-attack',
    name: 'Time Attack',
    hint: 'Clock only, no lives. Mistakes cost points and seconds.',
    available: true,
    useTimer: true,
    useLives: false,
    penaltySeconds: 5,
  },
  // Sketched out for later - the picker shows them greyed out until available
  { id: 'daily', name: 'Daily Challenge', hint: 'One shared set of players every day. Coming soon.', available: false },
  { id: 'career', name: 'Career Journey', hint: 'Walk a career club by club. Coming soon.', available: false },
  { id: 'club-challenge', name: 'Club Challenge', hint: 'One club, every player who wore the shirt. Coming soon.', available: false },
];

/* Scoring rules - kept in one place so the balance is easy to tweak. */
export const SCORING = {
  wrongPenalty: 50,           // points lost on a wrong club (same as the original game)
  comboSteps: [
    { streak: 12, multiplier: 3 },
    { streak: 7, multiplier: 2 },
    { streak: 3, multiplier: 1.5 },
    { streak: 0, multiplier: 1 },
  ],
  revealMs: 900,              // how long the answer stays on screen before the next card
  revealMsWrong: 1500,
};

export const getDifficulty = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
export const getMode = (id) => MODES.find((m) => m.id === id) || MODES[0];

export function comboFor(streak) {
  return SCORING.comboSteps.find((step) => streak >= step.streak).multiplier;
}
