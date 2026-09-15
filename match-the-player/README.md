# Match The Player

A web rebuild of the Pygame game at
[HenAsayag/Match_The_Player](https://github.com/HenAsayag/Match_The_Player).

Two skins ship side by side:

* **Classic** — the original screens, art and fonts on the 1280×720 canvas,
  scaled (and rotated on a portrait phone) to fit. Every menu, the stadium, the
  card, the TOP 5 board.
* **Modern** — a mobile-first layout for the new leagues. Its default mode,
  *Original*, is the Pygame game rule for rule; Classic, Endless and Time Attack
  are the faster tap version.

* **`web/`** — the browser game. Plain HTML/CSS/JS, no build step, no
  dependencies, ready to deploy to Vercel. Start here: [`web/README.md`](web/README.md).
* **`MIGRATION.md`** — what the original was, what was kept, what was rebuilt,
  and the bugs found along the way.

The original Python game is untouched — it still lives in its own repository.

## Quick start

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

```bash
cd web
npm test        # 37 checks over the rules and the player data
```

## Moving this into the original repo

`web/` is self-contained. Copy the whole folder into
`HenAsayag/Match_The_Player` as `/web` and nothing else needs to change —
the Python game and the web game sit side by side. On Vercel, point the
project's **Root Directory** at `web`.
