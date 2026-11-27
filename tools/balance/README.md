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
- `run.mjs` plays a list of fights across four headless pages (`play.mjs`) and prints one line per cell.
- `grid.mjs` is the full grid: every ship x stock/fitted x captain x pirate.
- `report.mjs` prints win-rate tables, which victory types are reachable, what each shot type adds
  over round shot, and what fittings add.

About 3 fights a second. With 6 runs per cell each figure is rough (one fight is 17 points), so
confirm anything surprising with a focused jobs file at 20 runs per cell before changing numbers.
The captains are competent, not clever: a result of 0% means "not with these captains", and a
person may do better or worse.

## Seeds, replays and before/after

Every fight is seeded: shot fall, damage, fires, the AI's choices and wind shifts all come from one seeded
source (`src/rng.js`), and every result records its seed. Smoke, sparks and the crew stay on
`Math.random`, so whether anything is drawn never changes what happens.

Each fight also starts from a clean slate, whatever ran before it in the same page: the harness stops the game's
own frame loop (fights tick the rules directly, with nothing drawn), and resets the one flag that used to carry
over (`G.canBoard`, which let a few fights open with an instant boarding). Runs made before November 2026 could
differ in a few fights in a hundred depending on run order, so don't compare them with newer ones.

- **Replay one fight.** `node tools/balance/replay.mjs <jobs.mjs> <label-regex> <seed> [trace-seconds]`
  plays it again exactly. For a campaign leg it also prints where every ship was every few seconds.
  `SEED=<n>` works with `trace.mjs` too.
- **Compare before and after a change.** Run the same jobs file with the same `SEED` on both versions.
  Run k of every cell is then played on seed `SEED + k`, so each fight faces the same luck both times,
  and `compare.mjs` pairs them up:

```bash
SEED=1000 node tools/balance/run.mjs tools/balance/grid.mjs 6 /tmp/before.json
# change the rules, npm run build
SEED=1000 node tools/balance/run.mjs tools/balance/grid.mjs 6 /tmp/after.json
node tools/balance/compare.mjs /tmp/before.json /tmp/after.json
```

It lists the cells whose win rate moved, biggest first, with how many fights flipped each way. A fight
that flipped changed because of the rules, not the dice, so a small change shows up with far fewer runs
than comparing two unseeded win rates. It's still the same captains on the same few seeds, so confirm
anything that matters with more runs or a different `SEED`.

## Trying other numbers without a rebuild

The game puts its tuning tables on `G.dials` (`HANDLING`, `AMMO`, `CAL`, `SAILS`, `HULLS`, `GRADE`, `OFFICERS`, and the
skirmish ships `PLAYER_SPEC`, `ENEMIES`, `KITS`). A cell's `dials` changes any number in them for that fight only,
and everything is put back when it ends:

```js
{ label: 'brig | duel grape | v xebec | grape x3', ..., dials: { 'AMMO.grape.kills': { mul: 3 } } }
```

- A key is a path into `G.dials`: `'AMMO.grape.hull'`, `'HULLS.sloop.crew'`, `'AMMO.grape.kills.1'`.
- `*` matches every key at that step: `'HULLS.*.crew'` is every campaign hull's crew.
- A plain value replaces what was there. `{ mul: 1.2 }` or `{ add: -3 }` scales or shifts it (a list of numbers too).
- A path that matches nothing stops the run with an error, so a typo can't quietly test the shipped numbers.
- `DIALS='{"AMMO.chain.sail":3}'` on `run.mjs` or `replay.mjs` applies to every fight, under whatever a cell sets.

Seeds don't move, so a run with dials pairs up with one without in `compare.mjs`, fight by fight. Only numbers in
those tables can be dialled: a loose constant such as `BELOW` has to move into one of them first. Hull numbers reach
campaign fights through `HULLS`; skirmish fights (`grid.mjs`) take theirs from `PLAYER_SPEC` and `ENEMIES` instead.

## Sweeping a number

`sweep.mjs` plays the same seeded fights at every value of one dial and draws each hull's win rate against it:

```bash
LEGS='m2 brothers' node tools/balance/sweep.mjs tools/balance/legs.mjs 'AMMO.grape.kills=x0.5:x2:0.5' --runs 6
```

```bash
node tools/balance/sweep.mjs tools/balance/grid.mjs 'HULLS.*.crew=x0.8,x1,x1.2' 'AMMO.grape.hull=0.3,0.6,1' --only 'prep board'
```

- Values are a list (`0.1,0.2,0.4`), a range (`0.1:0.5:0.1`), multiples of the shipped number (`x0.5:x1.5:x0.25`,
  where `x1` is the game as it ships), or a JSON list for values that are lists (`'[[1,3],[2,4]]'`).
- `--by` picks what one line is (`hull`, `shipName`, `pirate`, `planName`, `routeName`, `legName`, `label`); the rest
  are averaged into it. `--metric` is `win`, `board` (won by boarding), `guns` or `t` (seconds). `--only` filters
  cells by label; the jobs file's own filters (`LEGS`, `HULLS`, `ROUTES`) work too.
- Two dials give a heatmap per line instead of a chart.
- It writes `out/sweep/<dial>/index.html` (chart, table, and the cliffs: cells that change most between neighbouring
  values, with the fights that flipped) and `data.json`, and prints the table.

Every value plays run k of every cell on seed `SEED + k` (`SEED` defaults to 1000), so a fight that changes outcome
between two values changed because of the number. Read a flat line as "this dial doesn't matter here", a cliff as
"a small change flips the game here", and look for the values where small, middling and big hulls all sit in a band
you like. It costs cells x values x runs fights at about 3 a second: it prints the estimate before it starts.

## How fights were won: fight stories

`STORY=1` makes every fight keep a record: both sides sampled every second, every hit booked to the shot that made
it, the time each side had the other under its guns, and a one-line cause (`captured: her crew boarding 80%, grape
14%`). `story.mjs` turns a run's records into tables and pictures:

```bash
STORY=1 SEED=1000 node tools/balance/run.mjs tools/balance/grid.mjs 6 /tmp/run.json
node tools/balance/story.mjs /tmp/run.json --only 'prep board'
```

- **Wins decided by**: of the damage that decided each win (her crew for a capture, her hull for a sinking or a
  striking), the share done by each cause: the four shots, `burning`, `boarding` (the deck fight and the swivels),
  `other` (rocks, collisions). **Losses decided by** is the same for our side.
- **Alone**: the wins where one cause did at least 80% of it. This is the number for "does grape (or chain) decide
  fights on its own?"
- **Guns bearing**: the share of the fight with only our guns bearing, only hers, both, neither, or boarding, and the
  longest stretch where neither side could fire.
- `out/story/index.html` has the table, and the first few fights of each cell drawn as strips: hull, sails and crew
  for both ships, what bore, and what shot was loaded (`--fights 3`, `--out`).
- `STORY=1` works with `replay.mjs` too (the record is in its JSON line), and campaign legs keep it as well. Booking
  hits needs a build with `G.onHit` (any build from this change on).

## Who beats whom: the hull matrix

`matrix.mjs` plays every campaign hull against every other, one on one in open water (`H.duel`: Home waters with
the pirate swapped for the defender, in good hands under the game's AI), with eight captains: `guns`, `kite`, `hug`,
`burn`, `prep` (chain and grape, board at 1.25 to 1), `hugBoard`, `rush`, and for galleys `bow` (bow guns at close range).

```bash
node tools/balance/matrix.mjs --runs 4
```

```bash
node tools/balance/matrix.mjs --hulls sloop,brig,xebec --captains guns,hug,prep
```

- **Win**: each cell is the best captain's win rate, with that captain's letter. It reads "the best this hull can do
  against that one with these captains".
- **Capture**: the best boarding captain's share of fights ended by taking her, and how often she was taken herself
  in the attempt. This is the "can a small ship board a big one?" table.
- **Dominance**: a hull that does no better against anyone than another hull and is no harder to beat. One that is
  dominated has no reason to be sailed.
- `out/matrix/index.html` draws both as heatmaps (hover a cell for every captain's figure); `data.json` keeps every
  fight's seed. `DIALS`, `STORY` and `SEED` work as with `run.mjs`.

The attacker has a scripted captain and the defender the game's AI, so the diagonal (a hull against itself) shows the
script's edge over the AI rather than 50%. Compare rows and columns, not single cells against 50%.

## Design rules as checks

`rules.mjs` checks the design rules in `docs/campaign.md` against a legs run, leg by leg, and with a second run on
the same seeds says which rules a change newly broke or now keeps:

```bash
STORY=lite SEED=1000 node tools/balance/run.mjs tools/balance/legs.mjs 2 /tmp/after.json
node tools/balance/rules.mjs /tmp/after.json /tmp/before.json
```

| Rule | Level |
| --- | --- |
| Winnable by at least three kinds of ship (rule 1) | fail |
| Winnable by at least three different routes (rule 1) | fail |
| A route for a heavy ship, a nimble one and an oared or boarding one (rule 5) | fail |
| Running is never the only answer (rule 5) | fail |
| No route works for every ship every time | warn |
| Some ship is in doubt | warn |
| Fights end: under 10% of a leg's fights time out | warn |
| Grape and chain set up wins, never finish them alone (needs fight records) | warn |

A route wins a leg for a hull at 50% of its fights (`WIN=<x>` to change). `--md` prints the Markdown table the pull
request job puts in its summary; `--strict` exits 1 on a broken "fail" rule. `STORY=lite` keeps each fight's record
without its second-by-second samples, which is all the rules need. A rule is a function over one leg's results in
the `RULES` list at the top of the file: add one there when a new design rule is written down.

## The best a captain can do: captain search

The stock captains are a handful of fixed plans, so a 0% means "not with these plans". `search.mjs` tries many more
for one matchup (how she moves, what she fires, whether and when she boards, the range she keeps, and on a leg
which of its routes' waypoints she sails first) and keeps the best:

```bash
node tools/balance/search.mjs duel galley flagship
```

```bash
node tools/balance/search.mjs leg 'm1O' sloop --budget 64
```

It plays every candidate on 2 seeds, the best quarter on 6, then the best three and every stock plan on 20
(`--seeds 2,6,20`), so most fights go to the promising plans: about 370 fights, a minute and a half, for the
default 48 candidates. Candidates are drawn from `SEED`, so a search repeats exactly. It prints the finalists, the
gap between the best found and the best stock plan, and the best plan's route to paste into a jobs file.

Read a big gap as "the stock captains undersell this hull here" (add the plan as a stock route) or "a tactic nobody
planned for dominates" (look at it with `STORY=1`). The first search found that a galley holding bow-on at close
range beats the great ship 75% of the time, where every stock captain lost all 20 fights. That plan is now the
matrix's `bow` captain.

## Fights a person played: recorded playtests

The playtest build (`npm run build:playtest`) records every campaign fight from the moment you engage: the seed the
rules run on from then, every ship's state at that moment, then each frame's time step, the rudder and every key
(HUD clicks are recorded as the keys that do the same). Copy one from the pause menu ("Copy this fight so far") or
from the playtest panel's Recorded fights (the last six are kept), save it to a file, and play it again headless:

```bash
node tools/balance/replay-play.mjs fight.json
STORY=1 node tools/balance/replay-play.mjs fight.json --out /tmp/played.json && node tools/balance/story.mjs /tmp/played.json
DIALS='{"AMMO.round.hull":{"mul":1.5}}' node tools/balance/replay-play.mjs fight.json
```

It reports the outcome against the recorded one, and whether the ship kept to the recorded track (checked every 60
frames). On the same rules it keeps to it exactly: a 55-second fight with hits on both sides replays with no drift.
With other rules (`DIALS`, or `DIST=` an older or newer build) the replay shows where that very fight, played the
same way, would have gone differently. Inputs are replayed blind, so once a fight drifts, later keys land in a
different situation: read the outcome after a drift as a hint, not a verdict. A fight where the playtest controls
(win, heal, unsinkable) were used is marked and won't match.

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
- How each hull sails on her own (tacks, turning circles, irons, leeway, chases) is `tools/handling/`, drawn as
  pictures with every hull's track laid over each other. The dials are `HANDLING` in `src/ship.js`.
- `drive.mjs` runs a script against the built page with screenshots, for checking flow and looks.

The design rule being checked is in `docs/campaign.md`: no mission is won by one quality alone.
