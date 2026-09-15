/* Tiny dependency-free test for the rules and the data helpers.
   Run with:  node tests/engine.test.mjs                                  */

import { readFileSync } from 'node:fs';
import { createGame } from '../js/engine.js';
import * as cfg from '../js/config.js';
const { getDifficulty, getMode, comboFor } = cfg;

/* The data modules use fetch(), so give Node a tiny file-backed stand-in. */
globalThis.fetch = async (url) => {
  const body = readFileSync(new URL(`../${url}`, import.meta.url), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const { loadLeagues, loadPlayers, getLeague, poolFor, buildQuestion, scoreFor } =
  await import('../js/data.js');

let passed = 0;
const failures = [];
const check = (label, fn) => {
  try { fn(); passed += 1; console.log('  ok  ', label); }
  catch (e) { failures.push(`${label}: ${e.message}`); console.log('  FAIL', label, '-', e.message); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const leagues = await loadLeagues();
const playable = leagues.filter((l) => l.available);
const await0 = {};
for (const lg of playable) await0[lg.id] = await loadPlayers(lg.id);

console.log('\n# data integrity');
for (const league of playable) {
  const players = await loadPlayers(league.id);
  const clubIds = new Set(league.clubs.map((c) => c.id));

  check(`${league.id}: has players`, () => assert(players.length > 0, 'empty'));

  check(`${league.id}: every answer is a club in the league`, () => {
    const bad = players.filter((p) => !p.mainClubIds.some((id) => clubIds.has(id)));
    assert(bad.length === 0, `${bad.length} unanswerable: ${bad.slice(0, 3).map((p) => p.id)}`);
  });

  check(`${league.id}: ids are unique`, () => {
    const ids = players.map((p) => p.id);
    assert(new Set(ids).size === ids.length, 'duplicate player id');
  });

  check(`${league.id}: every difficulty has a pool`, () => {
    for (const d of ['easy', 'hard', 'impossible']) {
      const n = poolFor(players, league, getDifficulty(d)).length;
      assert(n > 0, `${d} pool is empty`);
    }
  });

  check(`${league.id}: questions are well formed`, () => {
    const difficulty = getDifficulty('hard');
    const slots = Math.min(difficulty.options, league.clubs.length);
    for (const player of players) {
      if (!difficulty.tiers.includes(player.tier)) continue;
      const q = buildQuestion(player, league, difficulty);
      assert(q.options.length === slots, `${player.id}: ${q.options.length} options, wanted ${slots}`);
      assert(new Set(q.options.map((o) => o.id)).size === slots, `${player.id}: duplicate option`);
      assert(q.options.some((o) => o.isMain), `${player.id}: no correct option offered`);
      // A wrong option must exist unless the player genuinely turned out for
      // every club in the league (possible in the 4-club Israeli data).
      const unplayed = league.clubs.filter((c) => !player.clubs.some((pc) => pc.id === c.id));
      const wrong = q.options.filter((o) => !o.played);
      if (unplayed.length) assert(wrong.length >= 1, `${player.id}: no wrong option offered`);
      assert(q.options.every((o) => (o.played ? o.points > 0 : o.points === 0)), `${player.id}: bad points`);
    }
  });
}

console.log('\n# scoring');
check('main club is always worth 100', () => {
  const player = { clubs: [{ strength: 12 }, { strength: 4 }], topStrength: 12, mainClubIds: [] };
  assert(scoreFor(player.clubs[0], player) === 100, 'main not 100');
  assert(scoreFor(player.clubs[1], player) === 33, 'secondary should be 33');
});

check('combo ladder', () => {
  assert(comboFor(0) === 1, '0');
  assert(comboFor(3) === 1.5, '3');
  assert(comboFor(7) === 2, '7');
  assert(comboFor(12) === 3, '12');
});

console.log('\n# engine');
const league = getLeague(leagues, 'premier-league');
const players = await loadPlayers('premier-league');
const newGame = (diff = 'easy', mode = 'classic') =>
  createGame({ league, players, difficulty: getDifficulty(diff), mode: getMode(mode) });

check('a correct answer scores and builds a streak', () => {
  const g = newGame();
  const q = g.nextQuestion();
  const main = q.options.find((o) => o.isMain);
  const r = g.answer(main);
  assert(r.verdict === 'main', 'verdict');
  assert(g.state.score === main.points, `score ${g.state.score} != ${main.points}`);
  assert(g.state.streak === 1, 'streak');
  assert(g.state.correct === 1, 'correct count');
});

check('a wrong answer costs a life and 50 points', () => {
  const g = newGame();
  const q = g.nextQuestion();
  const main = q.options.find((o) => o.isMain);
  g.answer(main);                                   // bank some points first
  const before = g.state.score;
  const wrong = g.state.question.options.find((o) => !o.played);
  const r = g.answer(wrong);
  assert(r.verdict === 'wrong', 'verdict');
  assert(g.state.score === Math.max(0, before - 50), 'penalty');
  assert(g.state.streak === 0, 'streak reset');
  assert(g.state.lives === getDifficulty('easy').lives - 1, 'life lost');
});

check('score never goes negative', () => {
  const g = newGame();
  g.nextQuestion();
  g.answer(g.state.question.options.find((o) => !o.played));
  assert(g.state.score === 0, `score was ${g.state.score}`);
});

check('the combo multiplier is applied', () => {
  const g = newGame();
  let base = 0;
  for (let i = 0; i < 4; i += 1) {
    const q = g.nextQuestion();
    const main = q.options.find((o) => o.isMain);
    base += main.points * (i >= 2 ? 1.5 : 1);  // the 3rd correct answer trips the x1.5
    g.answer(main);
  }
  assert(g.state.combo === 1.5, `combo ${g.state.combo}`);
  assert(g.state.score === Math.round(base) || Math.abs(g.state.score - base) <= 4, `score ${g.state.score} vs ~${base}`);
});

check('running out of lives ends the game', () => {
  const g = newGame('impossible');
  for (let i = 0; i < 5 && !g.state.over; i += 1) {
    g.nextQuestion();
    g.answer(g.state.question.options.find((o) => !o.played));
  }
  assert(g.state.over, 'not over');
  assert(g.state.reason === 'No lives left', g.state.reason);
});

check('the clock ends the game', () => {
  const g = newGame('easy');
  g.nextQuestion();
  g.tick(1000);
  assert(g.state.over && g.state.reason === 'Full time', 'clock did not end it');
});

check('endless mode has no clock', () => {
  const g = newGame('easy', 'endless');
  g.nextQuestion();
  g.tick(10000);
  assert(!g.state.over, 'endless ended on time');
});

check('time attack has no lives but loses seconds', () => {
  const g = newGame('easy', 'time-attack');
  g.nextQuestion();
  const before = g.state.timeLeft;
  g.answer(g.state.question.options.find((o) => !o.played));
  assert(!g.state.over, 'ended without lives');
  assert(before - g.state.timeLeft === 5, 'no time penalty');
});

check('a player is not repeated until the pool is used up', () => {
  const g = newGame('easy');
  const pool = g.state.poolSize;
  const seen = new Set();
  for (let i = 0; i < pool; i += 1) seen.add(g.nextQuestion().player.id);
  assert(seen.size === pool, `saw ${seen.size} of ${pool}`);
});

check('accuracy is reported correctly', () => {
  const g = newGame('easy', 'endless');
  g.nextQuestion(); g.answer(g.state.question.options.find((o) => o.isMain));
  g.nextQuestion(); g.answer(g.state.question.options.find((o) => !o.played));
  assert(g.accuracy() === 50, `accuracy ${g.accuracy()}`);
});

console.log('\n# original mode (the Pygame rules)');
const { pickCorners } = await import('../js/data.js');
const original = (diff = 'easy') => newGame(diff, 'original');

check('the round is 60 seconds at every difficulty', () => {
  ['easy', 'hard', 'impossible'].forEach((d) => {
    const g = original(d);
    assert(g.state.maxTime === 60, `${d} ran ${g.state.maxTime}s`);
  });
});

check('there are no lives', () => {
  const g = original();
  for (let i = 0; i < 6; i += 1) {
    g.nextQuestion();
    g.answer(g.state.question.options.find((o) => !o.played));
  }
  assert(!g.state.over, 'the round ended early');
});

check('no streak bonus and no difficulty multiplier', () => {
  const g = original('impossible');   // impossible scales x2 in the newer modes
  let expected = 0;
  for (let i = 0; i < 6; i += 1) {
    const q = g.nextQuestion();
    const main = q.options.find((o) => o.isMain);
    expected += main.points;          // raw, straight out of the data
    g.answer(main);
  }
  assert(g.state.combo === 1, `combo climbed to ${g.state.combo}`);
  assert(g.state.score === expected, `score ${g.state.score}, expected ${expected}`);
});

check('the main club is worth exactly 100', () => {
  const g = original();
  const q = g.nextQuestion();
  const main = q.options.find((o) => o.isMain);
  const r = g.answer(main);
  assert(r.gained === 100, `scored ${r.gained}`);
});

check('the score is allowed to go negative', () => {
  const g = original();
  g.nextQuestion();
  g.answer(g.state.question.options.find((o) => !o.played));
  assert(g.state.score === -50, `score was ${g.state.score}`);
});

check('a dropped card costs 50 and breaks the streak', () => {
  const g = original();
  const q = g.nextQuestion();
  g.answer(q.options.find((o) => o.isMain));
  const before = g.state.score;
  const r = g.dropCard();
  assert(r.gained === -50, 'penalty');
  assert(g.state.score === before - 50, `score ${g.state.score}`);
  assert(g.state.streak === 0, 'streak not reset');
  assert(g.state.dropped === 1, 'not counted');
});

check('a drop is a miss, not a wrong answer', () => {
  const g = original();
  g.nextQuestion();
  g.answer(g.state.question.options.find((o) => o.isMain));
  g.dropCard();
  assert(g.accuracy() === 100, `accuracy ${g.accuracy()}`);
});

check('four corners, every one of them a club with players', () => {
  for (const lg of playable) {
    const ps = await0[lg.id];
    const cs = pickCorners(poolFor(ps, lg, getDifficulty('easy')), lg, 4);
    assert(cs.length === Math.min(4, lg.clubs.length), `${lg.id}: ${cs.length} corners`);
    assert(new Set(cs.map((c) => c.id)).size === cs.length, `${lg.id}: duplicate corner`);
    const answerable = cs.some((c) =>
      poolFor(ps, lg, getDifficulty('easy')).some((p) => p.mainClubIds.includes(c.id)));
    assert(answerable, `${lg.id}: no corner can be answered`);
  }
});

check('the corners stay put and every card fits them', () => {
  const g = original();
  const cs = pickCorners(poolFor(players, league, getDifficulty('easy')), league, 4);
  const ids = cs.map((c) => c.id);
  for (let i = 0; i < 25; i += 1) {
    const q = g.nextQuestion(ids);
    assert(q, 'ran out of players for these corners');
    assert(q.options.length === 4, `${q.options.length} options`);
    assert(q.options.every((o, n) => o.id === ids[n]), 'corner order changed mid-round');
    assert(q.options.some((o) => o.isMain), `${q.player.id} cannot be answered from these corners`);
  }
});

check('the name is on the card even on impossible', () => {
  const { namesShown } = cfg;
  assert(namesShown(getDifficulty('impossible'), getMode('original')) === true, 'name hidden');
  assert(namesShown(getDifficulty('impossible'), getMode('classic')) === false, 'classic should hide it');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.log(' -', f)); process.exit(1); }
