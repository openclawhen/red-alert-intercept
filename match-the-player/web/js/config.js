/* ==========================================================================
   config.js - the tuning knobs. Difficulties and game modes are plain data so
   a new one is a few lines here, not a change in the engine.
   ========================================================================== */

export const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy',
    desc: 'Household names, four clubs, every clue on show.',
    arenaDesc: 'Household names. The card floats highest, so you get longest to catch it.',
    color: '#22e08a',
    tiers: ['easy'],          // which player tiers feed the question pool
    options: 4,               // number of club buttons
    lives: 5,
    seconds: 90,
    bonusSeconds: 2,          // added to the clock for a correct answer
    scoreMultiplier: 1,
    hints: ['nationality', 'position', 'currentClub'],
    showName: true,
    // Original-mode physics, taken straight from main.py (60 fps, 1280x720) and
    // expressed per second and relative to the arena height so the card takes
    // the same time to fall on any screen.
    arena: { rise: -2.417, gravity: 4.0, maxCards: 1 },
  },
  {
    id: 'hard',
    name: 'Hard',
    desc: 'A far wider squad list and only half the clues.',
    arenaDesc: 'A far wider squad list, and the card barely leaves the floor.',
    color: '#ffc24b',
    tiers: ['easy', 'hard'],
    options: 4,
    lives: 3,
    seconds: 75,
    bonusSeconds: 1,
    scoreMultiplier: 1.5,
    hints: ['position'],
    showName: true,
    arena: { rise: -1.583, gravity: 4.0, maxCards: 1 },
  },
  {
    id: 'impossible',
    name: 'Impossible',
    desc: 'Journeymen and cult heroes. Six clubs. No help at all.',
    arenaDesc: 'Journeymen and cult heroes, two cards in the air at once.',
    color: '#ff4d5e',
    tiers: ['hard', 'impossible'],
    options: 6,
    lives: 2,
    seconds: 60,
    bonusSeconds: 1,
    scoreMultiplier: 2,
    hints: [],
    showName: false,          // the name is hidden until the answer is revealed
    arena: { rise: -1.167, gravity: 2.5, maxCards: 2, secondCardAfter: [2, 5] },
  },
];

export const MODES = [
  {
    id: 'original',
    name: 'Original',
    hint: 'The Pygame game, exactly: catch the falling card and drag it into a corner. 60 seconds, no lives, no multipliers, and the score can go below zero.',
    available: true,
    arena: true,              // played in the falling-card arena, not the tap grid
    useTimer: true,
    useLives: false,
    useCombo: false,          // the original had no streak bonus
    clampScore: false,        // ...and the original let you go negative
    seconds: 60,              // game_duration = 60, whatever the difficulty
    scoreMultiplier: 1,       // points came straight out of character_color_map
    showName: true,           // the name was always printed on the card
    options: 4,               // four corners
  },
  {
    id: 'classic',
    name: 'Classic',
    hint: 'Tap-to-answer. Beat the clock with a handful of lives, streaks and combos.',
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
  dropPenalty: 50,            // points lost when a card falls off the arena (original only)
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

/** Round length: a mode may pin it (Original always ran 60 seconds). */
export const secondsFor = (difficulty, mode) => mode.seconds ?? difficulty.seconds;

/** Points multiplier: Original scored raw, the newer modes scale by difficulty. */
export const multiplierFor = (difficulty, mode) => mode.scoreMultiplier ?? difficulty.scoreMultiplier;

/** Is the player's name on the card before he is revealed? */
export const namesShown = (difficulty, mode) => mode.showName ?? difficulty.showName;
export const getMode = (id) => MODES.find((m) => m.id === id) || MODES[0];

export function comboFor(streak) {
  return SCORING.comboSteps.find((step) => streak >= step.streak).multiplier;
}
