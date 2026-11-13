# Balance harness

Plays whole fights with nothing drawn, to answer balance questions with numbers.

A scripted captain takes the player's helm against the game's own pirate AI. A captain is a way of
moving (`duel`, `kite`, `hug` the stern, `close` to board), a shot policy (`round`, `chain`, `grape`,
`fire`, `combo`) and a boarding policy (`never`, `rush`, `odds`). Any ownable ship, stock or fully
fitted, against any of the five pirates.

It drives a headless browser, so it needs [Playwright](https://playwright.dev) and its Chromium
(`npm install --no-save playwright && npx playwright install chromium`). Build the game first, then run
a jobs file:

```bash
npm run build
```

```bash
node tools/balance/run.mjs tools/balance/grid.mjs 6 /tmp/grid.json
```

```bash
node tools/balance/report.mjs /tmp/grid.json
```

- `harness.js` is injected into the built page and exposes `H.fight(cfg)`.
- `run.mjs` plays a list of fights across four headless pages and prints one line per cell.
- `grid.mjs` is the full grid: every ship x stock/fitted x captain x pirate.
- `report.mjs` prints win-rate tables, which victory types are reachable, what each shot type adds
  over round shot, and what fittings add.

About 3 fights a second. With 6 runs per cell each figure is rough (one fight is 17 points), so
confirm anything surprising with a focused jobs file at 20 runs per cell before changing numbers.
The captains are competent, not clever: a result of 0% means "not with these captains", and a
person may do better or worse.

## Campaign legs

The same harness plays campaign fights. `H.leg(cfg)` sets up one leg of one mission for a given
side and hull and follows a **route**: a list of steps such as "sail to this point", "fight that ship
this way", "board her", "anchor on a spring once in range".

```bash
NODE_PATH=... node tools/balance/run.mjs tools/balance/legs.mjs 4 /tmp/legs.json
```

```bash
node tools/balance/legreport.mjs /tmp/legs.json
```

- `legs.mjs` is the grid: every leg x six hulls x that leg's routes. Filter with `LEGS=<regex>`,
  `HULLS=sloop,brig`, `ROUTES=<regex>`; `FIT=1` fits every ship out fully.
- `legreport.mjs` prints a table per leg and flags any leg that fewer than three kinds of ship, or
  fewer than three routes, can win; it also flags a route that always works.
- `drive.mjs` runs a script against the built page with screenshots, for checking flow and looks.

The design rule being checked is in `docs/campaign.md`: no mission is won by one quality alone.
