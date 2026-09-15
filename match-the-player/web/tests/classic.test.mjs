/* Walks the original Pygame screens in a real browser: the painted buttons, the
 * original fonts and art, the 1280x720 stage (and its rotation on a portrait
 * screen), a full drag onto a corner, and the TOP 5 board lining up with the
 * medal bars in the artwork.
 *
 *   npm i -D playwright-core && npx playwright install chromium
 *   python3 -m http.server 8123      (in another terminal, from web/)
 *   node tests/classic.test.mjs
 */
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8123';
const errors = [];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
const step = async (label, fn) => {
  try { await fn(); console.log('✔', label); }
  catch (e) { console.log('✘', label, '->', e.message.split('\n').slice(0,3).join(' | ')); errors.push(label + ': ' + e.message.split('\n')[0]); }
};
const live = (sel) => `.classic-screen:not([hidden]) ${sel}`;

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
// pretend an earlier round was finished, so the TOP 5 board has a row
await page.evaluate(() => localStorage.setItem('matchtheplayer.v1', JSON.stringify({
  muted: false, music: false, league: 'israeli-premier-league', difficulty: 'easy', mode: 'original',
  bestStreak: 4, gamesPlayed: 1, playerName: 'חן',
  best: { 'israeli-premier-league|easy|original': 640 },
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-screen="home"]:not([hidden])');

await step('the modern home offers the original screens', async () => {
  await page.click('[data-action="classic"]');
  await page.waitForSelector('.classic-root:not([hidden])');
  await page.waitForSelector('.classic-screen:not([hidden]) img[src*="home.webp"]');
});

await step('every original background is actually loaded', async () => {
  await page.waitForTimeout(900);
  const broken = await page.evaluate(() => [...document.querySelectorAll('.classic-root img')]
    .filter(i => i.getBoundingClientRect().width > 0 && i.complete && i.naturalWidth === 0)
    .map(i => i.getAttribute('src')));
  if (broken.length) throw new Error('broken art: ' + broken.join(', '));
});

await step('the original fonts are in use', async () => {
  const fonts = await page.evaluate(() => document.fonts ? [...document.fonts].map(f => f.family) : []);
  if (!fonts.includes('Nrkis') || !fonts.includes('Ozrad')) throw new Error('fonts: ' + fonts.join(','));
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('30px Nrkis'); await document.fonts.load('40px Ozrad');
    return document.fonts.check('30px Nrkis') && document.fonts.check('40px Ozrad');
  });
  if (!loaded) throw new Error('fonts did not load');
});

await step('the stage is the original 1280x720, scaled to fit', async () => {
  const info = await page.evaluate(() => {
    const s = document.querySelector('.classic-stage');
    const r = s.getBoundingClientRect();
    return { w: s.offsetWidth, h: s.offsetHeight, shownW: Math.round(r.width), shownH: Math.round(r.height), t: s.style.transform };
  });
  if (info.w !== 1280 || info.h !== 720) throw new Error(`stage is ${info.w}x${info.h}`);
  if (Math.abs(info.shownW / info.shownH - 1280 / 720) > 0.02) throw new Error('aspect drifted: ' + info.shownW + 'x' + info.shownH);
  if (info.t.includes('rotate(90')) throw new Error('rotated while landscape');
  console.log('   stage shown at', info.shownW + 'x' + info.shownH);
});

await step('home -> modes -> difficulty -> pitch, through the painted buttons', async () => {
  await page.click(live('.classic-hit[aria-label="שחק עכשיו"]'));
  await page.waitForSelector(live('img[src*="modes.webp"]'));
  await page.click(live('img[src*="mode1.webp"]'));
  await page.waitForSelector(live('img[src*="difficulty.webp"]'));
  await page.click(live('.classic-hit[aria-label="מתחילים"]'));
  await page.waitForSelector(live('img[src*="pitch.webp"]'));
  await page.waitForSelector('.classic-card');
});

await step('the card uses the original frame and shows the name', async () => {
  const frame = await page.locator('.classic-card__frame').first().getAttribute('src');
  if (!frame.includes('card.webp')) throw new Error('frame is ' + frame);
  const name = (await page.locator('.classic-card__name').first().textContent()).trim();
  if (!name || !/[֐-׿]/.test(name)) throw new Error('name is "' + name + '"');
  const size = await page.locator('.classic-card').first().evaluate(n => [n.offsetWidth, n.offsetHeight]);
  if (size[0] !== 294 || size[1] !== 408) throw new Error('card is ' + size.join('x'));
  console.log('   card:', name, size.join('x'));
});

await step('SCORE and TIME sit over the painted labels and tick', async () => {
  const t1 = await page.textContent('.classic-time');
  await page.waitForTimeout(1300);
  const t2 = await page.textContent('.classic-time');
  if (Number(t2) >= Number(t1)) throw new Error(`clock stuck at ${t1} -> ${t2}`);
  if (Number(t1) > 60) throw new Error('clock started at ' + t1);
});

/* One in-page helper drives the whole drag - a card only lives ~1.4s. */
const answerKey = await page.evaluate(async () => {
  const { players } = await (await fetch('data/players/israeli-premier-league.json')).json();
  const m = {};
  players.forEach(p => {
    const top = Math.max(...p.clubs.map(c => c.weight));
    m[p.name.trim()] = { main: p.clubs.filter(c => c.weight === top).map(c => c.id), all: p.clubs.map(c => c.id) };
  });
  return m;
});
await page.evaluate((key) => {
  window.__key = key;
  window.__corners = ['hapoel-tel-aviv', 'beitar-jerusalem', 'maccabi-tel-aviv', 'maccabi-haifa'];
  window.__fire = (t, x, y, tgt) => tgt.dispatchEvent(new PointerEvent(t, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
  /* Stage coordinates -> viewport coordinates, through the scale and rotation. */
  window.__toView = (sx, sy) => {
    const st = document.querySelector('.classic-stage');
    const box = st.getBoundingClientRect();
    const portrait = window.innerHeight > window.innerWidth;
    const scale = portrait ? box.height / 1280 : box.width / 1280;
    const dx = (sx - 640) * scale, dy = (sy - 360) * scale;
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    return portrait ? { x: cx - dy, y: cy + dx } : { x: cx + dx, y: cy + dy };
  };
  window.__drag = (kind) => {
    const card = document.querySelector('.classic-card');
    if (!card) return { skip: 'no card' };
    const name = card.querySelector('.classic-card__name').textContent.trim();
    const entry = window.__key[name];
    if (!entry) return { skip: 'unknown ' + name };
    let i;
    if (kind === 'right') i = window.__corners.findIndex(c => entry.main.includes(c));
    else if (kind === 'wrong') i = window.__corners.findIndex(c => !entry.all.includes(c));
    else i = -2;
    if (i === -1) return { skip: 'no ' + kind + ' corner' };
    const boxes = [[155, 155], [1140, 155], [155, 540], [1109, 553]];  // corner centres on the stage
    const target = i === -2 ? [640, 360] : boxes[i];
    const cb = card.getBoundingClientRect();
    const before = Number(document.querySelector('.classic-score').textContent);
    window.__fire('pointerdown', cb.left + cb.width / 2, cb.top + cb.height / 2, card);
    const held = card.classList.contains('is-held');
    const to = window.__toView(target[0], target[1]);
    window.__fire('pointermove', to.x, to.y, window);
    const hot = [...document.querySelectorAll('.classic-corner')].findIndex(c => c.classList.contains('is-hot'));
    window.__fire('pointerup', to.x, to.y, window);
    const after = Number(document.querySelector('.classic-score').textContent);
    return { name, kind, held, hot, aimed: i, gained: after - before, burst: document.querySelector('.classic-burst').textContent };
  };
}, answerKey);

const tryDrag = async (kind, tries = 14) => {
  for (let t = 0; t < tries; t++) {
    const r = await page.evaluate((k) => window.__drag(k), kind);
    if (!r.skip) return r;
    await page.waitForTimeout(220);
  }
  throw new Error('never found a card for "' + kind + '"');
};

await step('grabbing a card holds it and lights the corner under it', async () => {
  const r = await tryDrag('right');
  if (!r.held) throw new Error('card never entered the held state');
  if (r.hot !== r.aimed) throw new Error(`corner ${r.aimed} should be lit, got ${r.hot}`);
  console.log('   ', r.name, '-> corner', r.aimed, r.burst);
  if (r.gained !== 100) throw new Error('scored ' + r.gained);
  await page.waitForTimeout(320);
});

await step('a wrong corner costs 50', async () => {
  const r = await tryDrag('wrong');
  if (r.gained !== -50) throw new Error('scored ' + r.gained);
  await page.waitForTimeout(320);
});

await step('releasing in the middle costs 50 and lights nothing', async () => {
  const r = await tryDrag('nowhere');
  if (r.hot !== -1) throw new Error('a corner lit in the middle of the pitch');
  if (r.gained !== -50) throw new Error('scored ' + r.gained);
  await page.waitForTimeout(320);
});

await step('a dropped card costs 50', async () => {
  const before = await page.evaluate(() => Number(document.querySelector('.classic-score').textContent));
  const who = await page.evaluate(() => document.querySelector('.classic-card')?.querySelector('.classic-card__name').textContent);
  await page.waitForFunction((prev) => {
    const n = document.querySelector('.classic-card')?.querySelector('.classic-card__name').textContent;
    return n && n !== prev;
  }, who, { timeout: 8000 });
  const after = await page.evaluate(() => Number(document.querySelector('.classic-score').textContent));
  if (before - after !== 50) throw new Error(`score went ${before} -> ${after}`);
});

await step('the back button returns to the original menu', async () => {
  await page.click(live('.classic-hit[aria-label="חזור לתפריט הראשי"]'));
  await page.waitForSelector(live('img[src*="home.webp"]'));
  await page.waitForTimeout(400);
  if (await page.locator('.classic-card').count() !== 0) throw new Error('cards left running');
});

await step('the rules screen is the original rules image', async () => {
  await page.click(live('.classic-hit[aria-label="חוקים"]'));
  await page.waitForSelector(live('img[src*="rules.webp"]'));
  await page.click(live('.classic-hit'));
  await page.waitForSelector(live('img[src*="home.webp"]'));
});

await step('the TOP 5 board fills in and its tabs switch difficulty', async () => {
  await page.click(live('.classic-hit[aria-label="שיא נוכחי"]'));
  await page.waitForSelector(live('img[src*="highscores.webp"]'));
  const rows = await page.locator('.classic-rank').count();
  if (rows !== 5) throw new Error('rows: ' + rows);
  const filled = await page.locator('.classic-rank:not(.classic-rank--empty)').count();
  if (filled === 0) throw new Error('the stored record is not on the board');
  const top = await page.locator('.classic-rank').first().textContent();
  if (!top.includes('640') || !top.includes('חן')) throw new Error('top row reads "' + top + '"');
  await page.click(live('.classic-hit[aria-label="מטורפים"]'));
  await page.waitForTimeout(150);
  const afterTab = await page.locator('.classic-rank:not(.classic-rank--empty)').count();
  if (afterTab !== 0) throw new Error('impossible should be empty, has ' + afterTab);
  await page.click(live('.classic-hit[aria-label="מתחילים"]'));
  await page.click(live('.classic-hit[aria-label="חזרה לתפריט"]'));
  await page.waitForSelector(live('img[src*="home.webp"]'));
});

await step('the mute button swaps art and is remembered', async () => {
  const before = await page.locator('.classic-mute').getAttribute('src');
  await page.click('.classic-mute');
  await page.waitForTimeout(150);
  const after = await page.locator('.classic-mute').getAttribute('src');
  if (before === after) throw new Error('art did not change: ' + after);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('matchtheplayer.v1')).muted);
  if (typeof stored !== 'boolean') throw new Error('mute not stored');
  await page.click('.classic-mute');
});

await step('mode 2 explains itself instead of doing nothing', async () => {
  await page.click(live('.classic-hit[aria-label="שחק עכשיו"]'));
  await page.waitForSelector(live('img[src*="modes.webp"]'));
  await page.click(live('img[src*="mode2.webp"]'));
  await page.waitForSelector('.classic-note');
  const t = await page.textContent('.classic-note__box');
  if (!t.includes('פרמייר ליג')) throw new Error('note says: ' + t.slice(0, 80));
  await page.click('.classic-note__btn:not(.classic-note__btn--go)');
  await page.waitForSelector('.classic-note', { state: 'detached' });
});

await step('portrait turns the stage so the phone can be held sideways', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const t = await page.locator('.classic-stage').evaluate(n => n.style.transform);
  if (!t.includes('rotate(90deg)')) throw new Error('stage not rotated: ' + t);
  const box = await page.locator('.classic-stage').evaluate(n => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  console.log('   rotated stage occupies', box.join('x'), 'of 390x844');
  const hintShown = await page.locator('.classic-rotate-hint:not([hidden])').count();
  if (!hintShown) throw new Error('no rotate hint');
});

await step('dragging still hits the right corner while rotated', async () => {
  // the mode-2 step left us on the mode screen
  await page.waitForSelector(live('img[src*="modes.webp"]'));
  await page.click(live('img[src*="mode1.webp"]'));
  await page.click(live('.classic-hit[aria-label="מתחילים"]'));
  await page.waitForSelector('.classic-card');
  const r = await tryDrag('right');
  if (r.hot !== r.aimed) throw new Error(`rotated: aimed at corner ${r.aimed}, lit ${r.hot}`);
  if (r.gained !== 100) throw new Error('rotated: scored ' + r.gained);
  console.log('   rotated drag scored', r.gained);
});

await step('the TOP 5 rows line up with the painted medal bars', async () => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  await page.click(live('.classic-hit[aria-label="חזור לתפריט הראשי"]'));
  await page.waitForSelector(live('img[src*="home.webp"]'));
  await page.click(live('.classic-hit[aria-label="שיא נוכחי"]'));
  await page.waitForSelector(live('img[src*="highscores.webp"]'));
  const tops = await page.locator('.classic-rank').evaluateAll(ns => ns.map(n => n.offsetTop + n.offsetHeight / 2));
  const want = [171, 281, 400, 531, 650];
  tops.forEach((t, i) => { if (Math.abs(t - want[i]) > 2) throw new Error(`row ${i} at ${t}, bar at ${want[i]}`); });
  const first = await page.locator('.classic-rank').first().evaluate(n => [n.offsetLeft, n.offsetWidth]);
  if (first[0] !== 263 || first[1] !== 797) throw new Error('row box ' + first.join('x'));
  await page.click(live('.classic-hit[aria-label="חזרה לתפריט"]'));
  await page.waitForSelector(live('img[src*="home.webp"]'));
});

await step('the mute art matches what main.py drew', async () => {
  const src = await page.locator('.classic-mute').getAttribute('src');
  const muted = await page.evaluate(() => JSON.parse(localStorage.getItem('matchtheplayer.v1')).muted);
  // main.py: blit(unmute_image if not muted else mute_image)
  const expected = muted ? 'mute.webp' : 'unmute.webp';
  if (!src.endsWith(expected)) throw new Error(`muted=${muted} showed ${src}`);
});

await step('leaving classic returns to the modern home', async () => {
  await page.click('.classic-exit');
  await page.waitForSelector('[data-screen="home"]:not([hidden])');
  await page.waitForTimeout(400);
  if (await page.locator('.classic-root:not([hidden])').count()) throw new Error('classic still showing');
  if (await page.locator('.classic-card').count() !== 0) throw new Error('cards left running');
});

console.log('\n--- console errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await b.close();
process.exit(errors.length ? 1 : 0);
