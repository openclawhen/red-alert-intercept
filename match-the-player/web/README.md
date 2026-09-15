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

## How the game works

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

| | Player pool | Clubs shown | Lives | Clock | Clues | Score ×|
|---|---|---|---|---|---|---|
| **Easy** | famous players | 4 | 5 | 90s | nationality, position, current club | ×1 |
| **Hard** | famous + deep cuts | 4 | 3 | 75s | position only | ×1.5 |
| **Impossible** | journeymen & cult heroes | 6 | 2 | 60s | none, and the name is hidden | ×2 |

### Modes

`Classic` (clock + lives), `Endless` (lives only) and `Time Attack`
(clock only, a miss costs 5 seconds) all work. `Daily Challenge`,
`Career Journey` and `Club Challenge` are listed but greyed out — they're
defined in `js/config.js` and just need `available: true` plus whatever extra
rule they need in `js/engine.js`.

---

## Folder layout

```
web/
├── index.html                  every screen, as plain markup
├── css/
│   ├── base.css                design tokens, reset, buttons, panels
│   ├── screens.css             home / league / difficulty / game over / records
│   └── game.css                HUD, player card, club grid, answer animations
├── js/
│   ├── main.js                 boot + navigation + menus
│   ├── game.js                 the game screen controller
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

* **The core idea and the scoring rule** — match a player to the club he played
  for the longest, with partial credit for his other clubs.
* **The Israeli league data.** All 178 players from `character_color_map` in the
  original `main.py`, with their career weights intact, plus the 176 player
  photos re-encoded as WebP (11 MB of PNG → 2.1 MB). The four corner colours of
  the original game were the four Israeli giants, and they are now clubs:
  red = Hapoel Tel Aviv, green = Maccabi Haifa, blue = Maccabi Tel Aviv,
  yellow = Beitar Jerusalem.
* **Difficulty levels, high scores, the mute toggle, the rules screen.**

Deliberately left behind: the 1280×720 fixed canvas, the drag-a-bouncing-ball
input (a pain on a phone), the hard-coded Hebrew virtual keyboard, the GitHub
Gist high-score board (it needed a personal access token in the source), and the
27 MB tutorial video.

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
npm test                      # 27 checks: the rules, the scoring, and the player data
```

`tests/engine.test.mjs` has no dependencies — it runs the real engine against the
real JSON, so a typo in a player file (an answer that isn't a club in that league,
a duplicate id, an empty difficulty pool) fails the run.

`tests/browser.test.mjs` walks the whole game in a real browser — every screen,
a scored round, a wrong answer, game over, localStorage, the sound toggle and
three viewport sizes. It needs Playwright's Chromium; see the header of the file.

## Browser support

Anything current: Chrome/Edge, Safari 16.4+ (iOS included), Firefox.
Uses ES modules, `fetch`, `color-mix()`, `aspect-ratio` and `dvh`.
