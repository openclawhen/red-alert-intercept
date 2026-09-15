/* Plays a full "Original" round in a real browser and checks every number
 * against the Pygame rules: 100 for the main club with no multiplier, -50 for a
 * wrong corner, -50 for releasing nowhere, -50 for a dropped card, a score that
 * may go negative, 60 seconds, and no lives.
 *
 *   npm i -D playwright-core && npx playwright install chromium
 *   python3 -m http.server 8123      (in another terminal, from web/)
 *   node tests/arena.test.mjs
 */
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8123';
const errors = [];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
const step = async (label, fn) => {
  try { await fn(); console.log('✔', label); }
  catch (e) { console.log('✘', label, '->', e.message.split('\n').slice(0,3).join(' | ')); errors.push(label + ': ' + e.message.split('\n')[0]); }
};

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-screen="home"]:not([hidden])');

/* The card only lives ~1.4s, so the whole grab-drag-release happens inside one
   page.evaluate - a Playwright round trip per mouse move is far too slow. */
await page.addInitScript(() => {});
const install = async () => page.evaluate((key) => {
  window.__key = key;
  window.__play = (kind) => {
    const card = document.querySelector('.arena-card');
    if (!card) return { skip: 'no card' };
    const name = card.querySelector('.arena-card__name').textContent.trim();
    const entry = window.__key[name];
    if (!entry) return { skip: 'unknown player ' + name };
    const corners = [...document.querySelectorAll('.corner')];
    const labels = corners.map(c => c.querySelector('.corner__name').textContent.trim());
    let i;
    if (kind === 'right') i = labels.findIndex(l => entry.main.includes(l));
    else if (kind === 'wrong') i = labels.findIndex(l => !entry.all.includes(l));
    else i = -2;                                  // 'nowhere' - release in the dead middle
    if (i === -1) return { skip: 'no ' + kind + ' corner for ' + name };

    const cb = card.getBoundingClientRect();
    const arena = document.querySelector('#arena').getBoundingClientRect();
    const to = i === -2
      ? { x: arena.left + arena.width / 2, y: arena.top + arena.height / 2 }
      : (() => { const r = corners[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();

    const before = Number(document.querySelector('#arena-score').textContent);
    const fire = (type, x, y) => card.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    }));
    fire('pointerdown', cb.left + cb.width / 2, cb.top + cb.height / 2);
    const held = card.classList.contains('is-held');
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: to.x, clientY: to.y }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: to.x, clientY: to.y }));
    const after = Number(document.querySelector('#arena-score').textContent);
    const burst = document.querySelector('#arena-feedback').textContent.trim();
    return { name, kind, held, gained: after - before, burst, corner: i >= 0 ? labels[i] : 'nowhere' };
  };

  /* Hold every card still so the clock, not gravity, decides the pace. */
  window.__freeze = () => {
    const card = document.querySelector('.arena-card');
    if (!card) return false;
    const cb = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true,
      clientX: cb.left + cb.width / 2, clientY: cb.top + cb.height / 2,
    }));
    return card.classList.contains('is-held');
  };
}, answerKey);

await page.click('[data-action="play"]');
await page.click('[data-league="israeli-premier-league"]');
await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');

var answerKey = await page.evaluate(async () => {
  const { players } = await (await fetch('data/players/israeli-premier-league.json')).json();
  const { leagues } = await (await fetch('data/leagues.json')).json();
  const label = new Map(leagues.find(l => l.id === 'israeli-premier-league').clubs.map(c => [c.id, c.name]));
  const m = {};
  players.forEach(p => {
    const top = Math.max(...p.clubs.map(c => c.weight));
    m[p.name] = { main: p.clubs.filter(c => c.weight === top).map(c => label.get(c.id)), all: p.clubs.map(c => label.get(c.id)) };
  });
  return m;
});

await step('Original is the default mode', async () => {
  const sel = (await page.locator('.mode-chip.is-selected').textContent()).trim();
  if (sel !== 'Original') throw new Error('default mode is ' + sel);
});

await step('kick off lands in the arena: four corners, a card, a 60s clock', async () => {
  await page.click('[data-action="start"]');
  await page.waitForSelector('[data-screen="arena"]:not([hidden])');
  await page.waitForSelector('.arena-card');
  await install();
  const corners = (await page.locator('.corner__name').allTextContents()).map(c => c.trim());
  if (corners.length !== 4) throw new Error('corners: ' + corners.length);
  console.log('   corners:', corners.join(' / '));
  const clock = await page.textContent('#arena-clock');
  if (!/^(60|59)s$/.test(clock)) throw new Error('clock reads ' + clock);
});

await step('the card falls under gravity', async () => {
  const a = await page.locator('.arena-card').first().evaluate(n => n.style.transform);
  await page.waitForTimeout(200);
  const b2 = await page.locator('.arena-card').first().evaluate(n => n.style.transform);
  if (a === b2) throw new Error('card is not moving');
});

await step('grabbing a card stops it falling', async () => {
  const held = await page.evaluate(() => window.__freeze());
  if (!held) throw new Error('card did not enter the held state');
  const a = await page.locator('.arena-card').first().evaluate(n => n.style.transform);
  await page.waitForTimeout(700);
  const b2 = await page.locator('.arena-card').first().evaluate(n => n.style.transform);
  if (a !== b2) throw new Error('held card kept falling');
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: 5, clientY: 5 })));
  await page.waitForTimeout(400);
});

const tryPlay = async (kind, tries = 14) => {
  for (let t = 0; t < tries; t++) {
    const r = await page.evaluate((k) => window.__play(k), kind);
    if (!r.skip) return r;
    await page.waitForTimeout(220);
  }
  throw new Error('never found a card for "' + kind + '"');
};

await step('his club scores exactly 100 - no multiplier, no combo', async () => {
  const seen = [];
  for (let n = 0; n < 4; n++) {
    const r = await tryPlay('right');
    seen.push(r.gained);
    if (r.burst !== '+100' && !r.burst.startsWith('+')) throw new Error('burst was ' + r.burst);
    await page.waitForTimeout(340);
  }
  console.log('   four correct in a row scored:', seen.join(', '));
  if (seen.some(v => ![100].includes(v) && v > 0 === false)) throw new Error('odd scores: ' + seen);
  const mains = seen.filter(v => v === 100);
  if (mains.length !== seen.length) throw new Error('a streak changed the score: ' + seen.join(','));
});

await step('a wrong corner costs exactly 50', async () => {
  const r = await tryPlay('wrong');
  console.log('   ', r.name, '->', r.corner, r.burst);
  if (r.gained !== -50) throw new Error('penalty was ' + (-r.gained));
  if (r.burst !== '-50') throw new Error('burst was ' + r.burst);
  await page.waitForTimeout(340);
});

await step('releasing nowhere also costs 50 (as in the original)', async () => {
  const r = await tryPlay('nowhere');
  if (r.gained !== -50) throw new Error('penalty was ' + (-r.gained));
  await page.waitForTimeout(340);
});

await step('letting a card fall costs 50 on its own', async () => {
  const before = await page.evaluate(() => Number(document.querySelector('#arena-score').textContent));
  const id = await page.evaluate(() => document.querySelector('.arena-card')?.querySelector('.arena-card__name').textContent);
  await page.waitForFunction((prev) => {
    const n = document.querySelector('.arena-card')?.querySelector('.arena-card__name').textContent;
    return n && n !== prev;
  }, id, { timeout: 8000 });
  const after = await page.evaluate(() => Number(document.querySelector('#arena-score').textContent));
  console.log('   drop:', before, '->', after);
  if (before - after !== 50) throw new Error('drop cost ' + (before - after));
});

await step('the score goes below zero, as the original allowed', async () => {
  await page.waitForFunction(() => Number(document.querySelector('#arena-score').textContent) < 0, { timeout: 30000 });
  console.log('   score:', await page.textContent('#arena-score'));
});

await step('the round ends at full time, never on lives', async () => {
  await page.waitForSelector('[data-screen="gameover"]:not([hidden])', { timeout: 70000 });
  const reason = await page.textContent('#over-reason');
  const c = await page.textContent('#over-context');
  console.log('   ', reason, '|', c);
  if (reason !== 'Full time') throw new Error('ended because: ' + reason);
  if (!c.includes('Original')) throw new Error('mode not recorded');
  if (!c.includes('dropped')) throw new Error('dropped cards not reported');
});

await step('impossible keeps two cards in the air', async () => {
  await page.click('[data-action="change-level"]');
  await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');
  await page.click('[data-difficulty="impossible"]');
  await page.click('[data-action="start"]');
  await page.waitForSelector('.arena-card');
  await page.waitForFunction(() => document.querySelectorAll('.arena-card').length >= 2, { timeout: 12000 });
  
  console.log('   cards in the air:', await page.locator('.arena-card').count());
});

await step('quitting the arena cleans up', async () => {
  await page.click('[data-screen="arena"] [data-action="quit"]');
  await page.waitForSelector('[data-screen="home"]:not([hidden])');
  await page.waitForTimeout(700);
  if (await page.locator('.arena-card').count() !== 0) throw new Error('cards left behind');
});

await step('the tap modes are untouched', async () => {
  await page.click('[data-action="play"]');
  await page.click('[data-league="premier-league"]');
  await page.waitForSelector('[data-screen="difficulty"]:not([hidden])');
  await page.click('[data-mode="classic"]');
  await page.click('[data-difficulty="easy"]');
  await page.click('[data-action="start"]');
  await page.waitForSelector('[data-screen="game"]:not([hidden])');
  await page.waitForSelector('.club-option');
  if (await page.locator('.life').count() !== 5) throw new Error('classic lost its lives');
});

console.log('\n--- console errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await b.close();
process.exit(errors.length ? 1 : 0);
