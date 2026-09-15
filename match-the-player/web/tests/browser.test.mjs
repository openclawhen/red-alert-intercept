/* End-to-end walkthrough of the whole game in a real browser.
 *
 * Needs Playwright's Chromium, which is not a project dependency:
 *   npm i -D playwright-core && npx playwright install chromium
 *   python3 -m http.server 8123      (in another terminal, from web/)
 *   node tests/browser.test.mjs
 *
 * Set CHROME_PATH if your Chromium lives somewhere unusual.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:8123';
const errors = [];
const fails = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => fails.push('REQFAIL: ' + r.url() + ' ' + r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) fails.push('HTTP ' + r.status() + ' ' + r.url()); });

const step = async (label, fn) => {
  try { await fn(); console.log('✔', label); }
  catch (e) { console.log('✘', label, '->', e.message.split('\n')[0]); errors.push(label + ': ' + e.message.split('\n')[0]); }
};

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

await step('home screen visible', async () => {
  await page.waitForSelector('[data-screen="home"]:not([hidden])', { timeout: 5000 });
  const t = await page.textContent('.brand__title');
  if (!t.includes('Match')) throw new Error('brand missing: ' + t);
});

await step('how-to modal opens, ignores the ghost tap, and closes', async () => {
  await page.click('[data-action="how-to"]');
  await page.waitForSelector('#howto:not([hidden])');
  const rules = await page.locator('.rules li').count();
  if (rules !== 5) throw new Error('expected 5 rules, got ' + rules);
  await page.click('.modal__box [data-action="close-modal"]');
  await page.waitForSelector('#howto', { state: 'hidden' });
  // and the backdrop still closes it on a deliberate, later tap
  await page.click('[data-action="how-to"]');
  await page.waitForSelector('#howto:not([hidden])');
  await page.waitForTimeout(350);
  await page.locator('#howto .modal__backdrop').click({ position: { x: 8, y: 8 } });
  await page.waitForSelector('#howto', { state: 'hidden' });
});

await step('high scores screen renders + back', async () => {
  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-screen="scores"]:not([hidden])');
  await page.click('[data-screen="scores"] [data-action="back"]');
  await page.waitForSelector('[data-screen="home"]:not([hidden])');
});

await step('play -> league list', async () => {
  await page.click('[data-action="play"]');
  await page.waitForSelector('[data-screen="league"]:not([hidden])');
  const n = await page.locator('.league-card').count();
  if (n !== 8) throw new Error('expected 8 league cards, got ' + n);
  const disabled = await page.locator('.league-card[disabled]').count();
  if (disabled !== 5) throw new Error('expected 5 disabled leagues, got ' + disabled);
});

await step('pick Premier League -> difficulty', async () => {
  await page.click('[data-league="premier-league"]');
  await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');
  const counts = await page.locator('.diff-card__count').allTextContents();
  console.log('   pool counts:', counts.join(' / '));
  if (counts.some(c => c === '0')) throw new Error('empty difficulty pool: ' + counts);
  const hint = await page.textContent('#mode-hint');
  if (!hint) throw new Error('mode hint empty');
});

await step('difficulty + mode selection toggles', async () => {
  await page.click('[data-difficulty="impossible"]');
  await page.waitForSelector('[data-difficulty="impossible"].is-selected');
  await page.click('[data-mode="endless"]');
  await page.waitForSelector('[data-mode="endless"].is-selected');
  await page.click('[data-difficulty="easy"]');
  await page.click('[data-mode="classic"]');
  await page.waitForSelector('[data-mode="classic"].is-selected');
});

await step('kick off -> game screen with a question', async () => {
  await page.click('[data-action="start"]');
  await page.waitForSelector('[data-screen="game"]:not([hidden])');
  await page.waitForSelector('.player-card');
  const opts = await page.locator('.club-option').count();
  if (opts !== 4) throw new Error('expected 4 options, got ' + opts);
  const lives = await page.locator('.life').count();
  if (lives !== 5) throw new Error('expected 5 lives, got ' + lives);
});

await step('page does not scroll horizontally at 390px', async () => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) throw new Error('horizontal overflow of ' + over + 'px');
});

await step('no vertical overflow at 390x844', async () => {
  const over = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  if (over > 4) throw new Error('vertical overflow of ' + over + 'px');
});

// ---- play a deterministic round using the real answers from the JSON ----
const answerKey = await page.evaluate(async () => {
  const { players } = await (await fetch('data/players/premier-league.json')).json();
  const { leagues } = await (await fetch('data/leagues.json')).json();
  const label = new Map(leagues.find((l) => l.id === 'premier-league').clubs.map((c) => [c.id, c.name]));
  const map = {};
  players.forEach((p) => {
    const top = Math.max(...p.clubs.map((c) => c.years));
    map[p.name] = {
      main: p.clubs.filter((c) => c.years === top).map((c) => label.get(c.id) || c.name),
      all: p.clubs.map((c) => label.get(c.id) || c.name),
    };
  });
  return map;
});
console.log('   answer key size:', Object.keys(answerKey).length);

async function currentAnswer() {
  const name = (await page.textContent('.player-card__name')).trim();
  const entry = answerKey[name];
  if (!entry) throw new Error('player not in answer key: ' + name);
  const labels = await page.locator('.club-option__name').allTextContents();
  return { name, entry, labels: labels.map((l) => l.trim()) };
}

await step('picking the main club scores full points and builds a streak', async () => {
  for (let i = 0; i < 3; i++) {
    const { entry, labels } = await currentAnswer();
    const idx = labels.findIndex((l) => entry.main.includes(l));
    if (idx < 0) throw new Error('correct club not offered: ' + entry.main + ' vs ' + labels);
    await page.locator('.club-option').nth(idx).click();
    await page.waitForSelector('.feedback.is-good');
    await page.waitForFunction(() => document.querySelectorAll('.club-option[disabled]').length === 0, { timeout: 4000 });
  }
  const score = Number(await page.textContent('#hud-score'));
  const streak = await page.textContent('#hud-streak');
  const combo = await page.textContent('#hud-combo');
  console.log('   after 3 correct: score', score, '|', streak, '|', combo);
  if (score < 300) throw new Error('score too low: ' + score);
  if (streak !== 'Streak 3') throw new Error('streak wrong: ' + streak);
  if (combo !== 'x1.5') throw new Error('combo did not kick in: ' + combo);
  const q = await page.textContent('#hud-progress');
  if (q !== 'Q4') throw new Error('expected Q4, got ' + q);
});

await step('the career reveal appears after an answer', async () => {
  const { entry, labels } = await currentAnswer();
  const idx = labels.findIndex((l) => entry.main.includes(l));
  await page.locator('.club-option').nth(idx).click();
  await page.waitForSelector('.career__row.is-answer');
  const rows = await page.locator('.career__row').count();
  if (rows === 0) throw new Error('no career rows');
  const scored = await page.locator('.club-option.is-correct .club-option__score').textContent();
  if (scored !== '+100') throw new Error('main club should be worth +100, got ' + scored);
  await page.waitForFunction(() => document.querySelectorAll('.club-option[disabled]').length === 0, { timeout: 4000 });
});

await step('timer bar is counting down', async () => {
  const a = await page.evaluate(() => getComputedStyle(document.querySelector('#hud-bar')).transform);
  await page.waitForTimeout(1200);
  const b = await page.evaluate(() => getComputedStyle(document.querySelector('#hud-bar')).transform);
  if (a === b) throw new Error('timer did not move: ' + a);
});

await step('a wrong club costs a life and 50 points', async () => {
  const before = Number(await page.textContent('#hud-score'));
  const livesBefore = await page.locator('.life:not(.is-lost)').count();
  const { entry, labels } = await currentAnswer();
  const idx = labels.findIndex((l) => !entry.all.includes(l));
  if (idx < 0) throw new Error('no wrong option available');
  await page.locator('.club-option').nth(idx).click();
  await page.waitForSelector('.feedback.is-bad');
  const after = Number(await page.textContent('#hud-score'));
  const livesAfter = await page.locator('.life:not(.is-lost)').count();
  if (after !== Math.max(0, before - 50)) throw new Error(`score ${before} -> ${after}`);
  if (livesAfter !== livesBefore - 1) throw new Error(`lives ${livesBefore} -> ${livesAfter}`);
  if ((await page.textContent('#hud-streak')) !== 'Streak 0') throw new Error('streak not reset');
  await page.waitForFunction(() => document.querySelectorAll('.club-option[disabled]').length === 0, { timeout: 4000 });
});

await step('losing every life ends the game with a saved score', async () => {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-screen="gameover"]:not([hidden])').count()) break;
    const { entry, labels } = await currentAnswer();
    const idx = labels.findIndex((l) => !entry.all.includes(l));
    await page.locator('.club-option').nth(idx < 0 ? 0 : idx).click();
    await page.waitForTimeout(1700);
  }
  await page.waitForSelector('[data-screen="gameover"]:not([hidden])', { timeout: 8000 });
  const score = Number(await page.textContent('#over-score'));
  const reason = await page.textContent('#over-reason');
  const acc = await page.textContent('#over-accuracy');
  const best = await page.locator('#over-best:not([hidden])').count();
  console.log('   game over:', reason, '| score', score, '| accuracy', acc, '| new best banner', best);
  if (score <= 0) throw new Error('expected a positive final score, got ' + score);
  if (reason !== 'No lives left') throw new Error('unexpected reason: ' + reason);
  if (!best) throw new Error('first game should be a personal best');
});

await step('play again restarts at Q1 with a fresh score', async () => {
  await page.click('[data-action="replay"]');
  await page.waitForSelector('[data-screen="game"]:not([hidden])');
  if ((await page.textContent('#hud-progress')) !== 'Q1') throw new Error('not Q1');
  if ((await page.textContent('#hud-score')) !== '0') throw new Error('score not reset');
  const lives = await page.locator('.life:not(.is-lost)').count();
  if (lives !== 5) throw new Error('lives not reset: ' + lives);
});

await step('quit returns home and shows records', async () => {
  await page.click('[data-action="quit"]');
  await page.waitForSelector('[data-screen="home"]:not([hidden])');
  const games = await page.textContent('#home-games');
  if (games === '0') throw new Error('gamesPlayed not stored');
  console.log('   games played:', games);
});

await step('localStorage persists across reload', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="home"]:not([hidden])');
  const games = await page.textContent('#home-games');
  if (games === '0') throw new Error('stats lost after reload');
  const raw = await page.evaluate(() => localStorage.getItem('matchtheplayer.v1'));
  if (!raw) throw new Error('no storage key');
  console.log('   stored:', raw.slice(0, 120));
});

await step('sound toggle flips state and persists', async () => {
  await page.click('#sound-toggle');
  await page.waitForSelector('#sound-toggle.is-muted');
  const muted = await page.evaluate(() => JSON.parse(localStorage.getItem('matchtheplayer.v1')).muted);
  if (muted !== true) throw new Error('muted not stored');
  await page.click('#sound-toggle');
  await page.waitForSelector('#sound-toggle:not(.is-muted)');
});

await step('records screen lists the saved best', async () => {
  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-screen="scores"]:not([hidden])');
  const rows = await page.locator('.score-row').count();
  if (rows === 0) throw new Error('no record rows');
  console.log('   record rows:', rows);
});

await step('reset records clears them', async () => {
  await page.click('[data-action="reset-scores"]');
  await page.waitForSelector('.scores-empty');
});

// ---- La Liga + impossible + Israeli league with photos ----
await page.click('[data-screen="scores"] [data-action="back"]');
await step('La Liga / impossible / time-attack round', async () => {
  await page.click('[data-action="play"]');
  await page.click('[data-league="la-liga"]');
  await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');
  await page.click('[data-difficulty="impossible"]');
  await page.click('[data-mode="time-attack"]');
  await page.click('[data-action="start"]');
  await page.waitForSelector('.player-card');
  const opts = await page.locator('.club-option').count();
  if (opts !== 6) throw new Error('expected 6 options on impossible, got ' + opts);
  const lives = await page.locator('.hud__lives .chip').count();
  if (lives !== 1) throw new Error('time-attack should show infinite lives');
  const nameHidden = await page.locator('.player-card__name.is-hidden').count();
  if (nameHidden !== 1) throw new Error('name should be hidden on impossible');
  // the portrait stand-in must not leak the initials while the name is masked
  const initials = (await page.locator('.portrait-fallback__initials').textContent()).trim();
  if (initials !== '?') throw new Error('initials leaked the answer: ' + initials);
  
});

await step('Israeli league uses the migrated photos', async () => {
  await page.click('[data-action="quit"]');
  await page.click('[data-action="play"]');
  await page.click('[data-league="israeli-premier-league"]');
  await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');
  await page.click('[data-difficulty="easy"]');
  await page.click('[data-mode="classic"]');
  await page.click('[data-action="start"]');
  await page.waitForSelector('.player-card');
  const img = page.locator('.player-card__photo');
  if (await img.count() !== 1) throw new Error('expected a real photo for the Israeli league');
  await img.waitFor({ state: 'visible' });
  const ok = await img.evaluate(n => n.complete && n.naturalWidth > 0);
  if (!ok) throw new Error('photo failed to load');
  const opts = await page.locator('.club-option').count();
  if (opts !== 4) throw new Error('expected 4 clubs for the Israeli league, got ' + opts);
  
});

// ---- other viewports ----
for (const [label, size] of [['iPhone SE', { width: 375, height: 667 }], ['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1440, height: 900 }]]) {
  await step(`no horizontal overflow on ${label}`, async () => {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) throw new Error(over + 'px overflow');

  });
}

console.log('\n--- console errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
console.log('--- failed requests ---');
console.log(fails.length ? fails.join('\n') : '(none)');

await browser.close();
process.exit(errors.length ? 1 : 0);
