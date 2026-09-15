# Match The Player — Pygame → Web migration notes

Notes from reading `HenAsayag/Match_The_Player` before rebuilding it for the browser.

## What the original actually was

`main.py` — 1,342 lines, one file, one `while running:` loop with six boolean
screen flags (`entering_name`, `game_active`, `viewing_high_score`,
`choosing_mode`, `choosing_difficulty`, `viewing_rules`).

The game: a 1280×720 window with a club colour in each corner. Player cards
bounce around under gravity; you drag a card into a corner. `character_color_map`
maps each player to a list of `(colour, points)` pairs — the club he played for
the longest is worth 100, other clubs he turned out for are worth less. A wrong
corner is −50. 60-second round.

| Area | Where it lived |
|---|---|
| Player data | `name_mapping` (180 entries) + `character_color_map` (178 entries), both hard-coded dicts inside `main.py` |
| Player photos | `images/ISRAELILEAUGE/image_1.png` … `image_180.png` (176 files, 11 MB) |
| Difficulty | `get_initial_velocity()` — easy/hard/impossible only changed how fast the cards flew, plus a second card on impossible |
| High scores | Three GitHub Gists over `requests`, with a token constant in the source |
| Name entry | A hand-built Hebrew `VirtualKeyboard` class |
| Sound | Six WAVs (3 MB) + a 5.4 MB MP3 loop |
| Tutorial | A 27 MB `tutorial.mp4` opened in the system browser |

The four corner colours were the four Israeli giants:
**red = Hapoel Tel Aviv, green = Maccabi Haifa, blue = Maccabi Tel Aviv,
yellow = Beitar Jerusalem** — confirmed by cross-checking the named files in
`images/red|green|blue|yellow/` (Eli Ohana and Uri Malmilian under yellow,
Yossi Benayoun and Eyal Berkovic under green, Oscar Gloukh and Sheran Yeini
under blue).

## What was worth keeping

1. **The core idea** — match a footballer to the club he belongs to.
2. **The partial-credit scoring.** Any club he really played for scores, in
   proportion to his career there. This is the thing that makes the game more
   interesting than a plain multiple-choice quiz, and it carried over exactly.
3. **The three difficulty names**, re-cast around *who* you get asked about
   rather than how fast the sprite moves.
4. **The player data.** All 178 entries migrated, weights intact.
5. **The photos**, re-encoded (11 MB PNG → 2.1 MB WebP, lazy-loaded).

## Two modes, because the original is worth keeping as it was

**Original mode** (`js/arena.js`) is the Pygame game, rule for rule: cards
thrown upward and falling under gravity, four fixed corners, drag to place,
60 seconds, no lives, raw scoring, −50 for a wrong corner *and* −50 for a card
that falls off the bottom, and a score that is allowed to go negative.

The physics come straight out of `main.py`. At 60 fps on a 720-tall screen the
card left the floor at 29 px/frame on easy, 19 on hard and 14 on impossible,
under 0.8 gravity (0.5 on impossible), and counted as fallen once its centre
passed `720 + 180`. Simulated, that gives a catch window of **1.42–1.55s on
easy, 1.05–1.23s on hard, 1.27–1.50s on impossible**. Those constants are stored
per second and relative to the arena height, so the window is identical on a
phone.

**Classic / Endless / Time Attack** are the faster tap version, with lives,
streaks and combos.

## What was rebuilt rather than ported

* **A tap alternative to the drag.** Dragging a physics object is hard work on a
  phone, so the newer modes replace it with four (or six) club buttons. The drag
  itself did not go anywhere — it is Original mode, and it is the default.
* **Six boolean screen flags → a screen stack** (`js/main.js`).
* **Fixed 1280×720 canvas → responsive DOM**, built for a 390×844 phone first.
* **Hard-coded dicts → JSON files** with a documented shape, so players and
  whole leagues are added by editing data, not code.
* **Rules image + tutorial video → a real How-to-play panel.**
* **`MOUSEBUTTONUP` anywhere → pointer events with window-level listeners**, so a
  drag survives the finger leaving the card.
* **Gist high scores → localStorage.** The Gist approach needed a GitHub token
  shipped inside the game; there is no safe way to do that in a public web app.
  Records are local for now; a proper leaderboard needs a backend.

## What was dropped

* The Hebrew virtual keyboard (phones have one).
* `PHOTO_LOGO.py` and `WikipediaTest.py` — one-off scraping/asset scripts.
* Ball physics, corner sprites, FPS counter, the 27 MB tutorial video, the
  fixed-size backgrounds, and the `.idea/` project files.

## Problems found in the original

* `card.png` is loaded as lowercase but the file on disk is `Card.png` — that
  only works on a case-insensitive filesystem (Windows/macOS), and breaks on Linux.
* `name_mapping` has 180 entries, `character_color_map` has 178, and there are
  176 image files — three lists that were maintained by hand and drifted apart.
  Two players (`אייל_בן_עמי`, `רודי_חדד`) have an image and no career data.
* `Ball.__init__` picks a random player and *then* warns if the requested colour
  doesn't match him, rather than picking a player who fits the colour — so the
  console fills with warnings during play and some cards are unanswerable.
* Buttons were positioned by rendering strings of spaces
  (`button_font.render("        ")`) and taking the resulting rect.
* The high-score functions swallow every network error silently.

None of these carried over; the new data is generated from the same source dicts
by a script, so the three lists cannot drift apart again.

## The new architecture in one line

`data/*.json` (content) → `js/data.js` (load, filter, build a question) →
`js/engine.js` (rules, pure state) → `js/game.js` + `js/components.js` (render) —
with `js/config.js` holding every difficulty, mode and scoring number.

See `web/README.md` for how to run it, deploy it, and add players.
