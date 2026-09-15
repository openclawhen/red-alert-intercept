# Match The Player — Web

The browser version of **Match The Player**. Plain HTML, CSS and JavaScript —
no framework, no build step, no dependencies. Open it, serve it, deploy it.

The original Python/Pygame game is untouched and still lives in its own repository.
This folder is a clean re-implementation of the same idea, not a line-by-line port.

---

## Run it locally

ES modules and `fetch()` need a real HTTP server, so don't open `index.html`
straight off the disk — the game will tell you so if you do.

```bash
cd web
python3 -m http.server 8000     # or: npm start
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S`, VS Code Live Server…).

## Deploy to Vercel

There is nothing to build.

```bash
npm i -g vercel
cd web
vercel
```

Or, in the Vercel dashboard: *Add New → Project*, pick the repo, set the
**Root Directory** to `web`, and leave the framework preset on **Other**.
`vercel.json` already sets sensible cache headers.

---

## Two ways to play

### Original — the Pygame game, rule for rule

The default. Cards are thrown upward and fall under gravity; you grab one and
drag it into the corner of the club he played for the longest. Everything is
taken from `main.py`:

| | |
|---|---|
| Round | 60 seconds at every difficulty |
| Lives | none |
| Main club | 100 points, raw — no combo, no difficulty multiplier |
| Other club he played for | its share of his career |
| Wrong corner, or released nowhere | −50 |
| Card falls off the bottom | −50 |
| Score | allowed to go negative |
| Corners | four clubs, fixed for the whole round |
| Impossible | two cards in the air at once |

The physics are the original numbers (`get_initial_velocity()` and gravity at
60 fps on a 720-tall screen), re-expressed per second and relative to the arena
height — so a card takes the same time to fall on a phone as it did on the
desktop: about **1.5s on easy, 1.2s on hard, 1.4s on impossible**. Grab it
before then; once you are holding it, the card stops and you can think as long
as the clock allows. That is the original game.

### Classic, Endless, Time Attack — the faster tap version

A footballer's card appears. Tap the club he spent the longest stretch of his
career at.

* Tapping **his main club** scores the full 100 base points.
* Tapping **another club he really played for** still scores, in proportion to
  how much of his career it was. (This is the scoring rule from the original
  Pygame game, kept on purpose — it's what makes this game different from a
  plain quiz.)
* Tapping a club he never played for costs a life and 50 points.
* Correct answers build a **streak**, which raises the **combo multiplier**
  (×1 → ×1.5 → ×2 → ×3).
* After every answer the full career is revealed on the card, so a wrong guess
  still teaches you something.

### Difficulties

In the tap modes:

| | Player pool | Clubs shown | Lives | Clock | Clues | Score ×|
|---|---|---|---|---|---|---|
| **Easy** | famous players | 4 | 5 | 90s | nationality, position, current club | ×1 |
| **Hard** | famous + deep cuts | 4 | 3 | 75s | position only | ×1.5 |
| **Impossible** | journeymen & cult heroes | 6 | 2 | 60s | none, and the name is hidden | ×2 |

In **Original** the difficulty changes the same things the Pygame version did —
how high the card is thrown, its gravity, and how many are in the air — plus
which players you are asked about. The clock is 60s and the scoring is raw at
every level, and the name is always on the card.

### Modes

`Original` (the Pygame rules, in the drag arena), `Classic` (clock + lives),
`Endless` (lives only) and `Time Attack` (clock only, a miss costs 5 seconds)
all work. `Daily Challenge`, `Career Journey` and `Club Challenge` are listed
but greyed out — they're defined in `js/config.js` and just need
`available: true` plus whatever extra rule they need in `js/engine.js`.

Every rule that differs between modes lives in `js/config.js`: `useLives`,
`useTimer`, `useCombo`, `clampScore`, `seconds`, `scoreMultiplier`, `showName`,
`options`, and `arena` (which picks the falling-card screen over the tap grid).
Nothing in the engine hard-codes a mode.

---

## Folder layout

```
web/
├── index.html                  every screen, as plain markup
├── css/
│   ├── base.css                design tokens, reset, buttons, panels
│   ├── screens.css             home / league / difficulty / game over / records
│   ├── game.css                HUD, player card, club grid, answer animations
│   └── arena.css               Original mode: corners, falling card, points burst
├── js/
│   ├── main.js                 boot + navigation + menus
│   ├── game.js                 the tap screen controller
│   ├── arena.js                the Original mode falling-card arena
│   ├── engine.js               the rules (pure state, no DOM)
│   ├── data.js                 loading, filtering, question building
│   ├── components.js           player card / club badge renderers
│   ├── config.js               difficulties, modes, scoring — the tuning knobs
│   ├── audio.js                synthesised sound effects + ambient music
│   └── storage.js              localStorage wrapper
├── data/
│   ├── leagues.json            leagues and their clubs
│   ├── club-logos.json         which clubs have a real crest file
│   └── players/*.json          one file per league
└── assets/
    ├── players/<league>/       player photos (lazy-loaded)
    ├── clubs/                  club crests — empty, see below
    ├── ui/                     icons
    └── audio/                  empty; sound is synthesised in the browser
```

---

## Adding players (no programming needed)

Open `data/players/premier-league.json` and copy one block:

```json
{
  "id": "unique-slug",
  "name": "Player Name",
  "image": "",
  "nationality": "England",
  "position": "Midfielder",
  "league": "premier-league",
  "currentClub": "Arsenal",
  "tier": "easy",
  "clubs": [
    { "id": "arsenal", "name": "Arsenal", "years": 9 },
    { "id": "everton", "name": "Everton", "years": 3 }
  ]
}
```

Rules to keep in mind:

* **`clubs` must be his real career.** The club with the highest `years` is the
  answer, so it has to be one of the clubs listed for that league in
  `data/leagues.json`. Clubs abroad can stay in the list — they show up in the
  career reveal but are never used as a wrong option.
* **`tier`** is `easy` (famous), `hard` or `impossible` (obscure). It decides
  which difficulties can ask about him.
* **`image`** can stay `""` — the card then draws a neutral stand-in with his
  initials. To use a real photo, save it under
  `assets/players/<league>/<id>.webp` and put that path here.

### Adding a league

1. Add an entry to `data/leagues.json` with its clubs (`id`, `name`, `short`,
   `bg`, `fg`) and `"available": true`.
2. Create `data/players/<league id>.json` with the same shape as the others.

That's it — the league picker, the difficulty pool counts and the records screen
all pick it up on their own.

### Adding club crests

None are bundled. To add one: save it as `assets/clubs/<club id>.png` and add
that club id to the `clubs` list in `data/club-logos.json`. Anything not listed
falls back to a colour monogram, so nothing 404s. Only add artwork you have the
right to use.

---

## What came across from the Python version

* **The whole of it, in Original mode** — the drag, the falling cards, the four
  corners, the 60-second round, the raw scoring and both −50 penalties.
* **The core idea and the scoring rule** — match a player to the club he played
  for the longest, with partial credit for his other clubs.
* **The Israeli league data.** All 178 players from `character_color_map` in the
  original `main.py`, with their career weights intact, plus the 176 player
  photos re-encoded as WebP (11 MB of PNG → 2.1 MB). The four corner colours of
  the original game were the four Israeli giants, and they are now clubs:
  red = Hapoel Tel Aviv, green = Maccabi Haifa, blue = Maccabi Tel Aviv,
  yellow = Beitar Jerusalem.
* **Difficulty levels, high scores, the mute toggle, the rules screen.**

Deliberately left behind: the 1280×720 fixed canvas, the hard-coded Hebrew
virtual keyboard, the GitHub Gist high-score board (it needed a personal access
token in the source), and the 27 MB tutorial video.

---

## Performance notes

* First load is roughly **150 KB** of HTML/CSS/JS/JSON. Player photos are
  `loading="lazy"`, so only the cards you actually see are fetched.
* Each league's player file is fetched once, on demand, and cached in memory.
* All sound effects and the background music are generated with the Web Audio
  API, so there is not a single audio file to download.
* No npm packages, no fonts to fetch, no analytics.

## Tests

```bash
npm test                      # 37 checks: the rules, the scoring, and the player data
```

`tests/engine.test.mjs` includes a block that pins the Original rules — 60
seconds, no lives, no combo, raw points, a negative score, both −50 penalties,
and corners that stay put — so a future tweak cannot quietly drift away from the
Pygame behaviour. It has no dependencies — it runs the real engine against the
real JSON, so a typo in a player file (an answer that isn't a club in that league,
a duplicate id, an empty difficulty pool) fails the run.

`tests/arena.test.mjs` plays a full Original round in a browser: it drags cards
into the right and wrong corners, lets one fall, and checks every number against
the rules above. `tests/browser.test.mjs` walks the tap modes in a real browser — every screen,
a scored round, a wrong answer, game over, localStorage, the sound toggle and
three viewport sizes. It needs Playwright's Chromium; see the header of the file.

## Browser support

Anything current: Chrome/Edge, Safari 16.4+ (iOS included), Firefox.
Uses ES modules, `fetch`, `color-mix()`, `aspect-ratio` and `dvh`.
