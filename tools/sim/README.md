# The game with nothing drawn

The rules of the game run in plain Node, with no browser, no build and no three.js. The balance and handling tools
play their fights this way.

## How the game is split

- `src/game.js` is the rules: ships, shot, boarding, the AI's turn, the campaign's flow, what each screen offers.
  It imports nothing that draws (no three.js) and touches no page (no `document`, `window`, `localStorage` or audio).
  `start(view)` sets it going and returns `G`.
- Whatever should be seen or heard goes through the view it was started with: `V.addShip(ship)`, `V.toast(...)`,
  `V.result(data)`, `V.port()` and so on. `NO_VIEW` (in `game.js`) does nothing for every one of them, and is the view
  when none is given.
- `src/view.js` is the browser's view: the renderer, camera, ship models (`shipview.js`), sea (`world.js`), HUD,
  screens, sound and input. It reads `G` and draws it. Keys go to the game through `G.api.tap(k)` and `G.api.keys`.
- `src/main.js` joins the two in the page: `start(VIEW)`, then each frame one tick of the rules and one of the view.
- The pure parts of modules that used to be both: `sea.js` (wind, waves' height, land and shoals; the drawn sea is
  `world.js`), `shore.js` (coastlines; the meshes are `coast.js`), `hull.js` (deck heights and gun ports; the model
  is `model.js`), `vec.js` (a `Vec3` with three.js's arithmetic), `util.js`, `quay.js`.

Nothing the rules decide may depend on what is drawn: smoke, sparks, the crew on deck and the camera stay on
`Math.random` or the view's own state. `npm test` checks that `game.js` loads no drawing code (`deps.mjs`) and
that a leg plays the same twice on one seed.

## Using it

```js
import { load } from './tools/sim/headless.mjs';
const { G, H } = await load();          // the game, plus tools/balance/harness.js as H
H.leg({ mission: 'm1', leg: 0, hull: 'brig', route: [...], seed: 1 });
G.tick(0.05, 20);                       // a second of the rules
```

- `headless.mjs`: `load(extra, harness)` starts the game with no view and runs the harness (and any `extra`
  scripts, such as the handling tool's `sim.js`) on top, as a page's script tags would.
- `worker.mjs`: one game in a worker thread. `tools/balance/play.mjs` runs one per core and hands each a job:
  `{ kind: 'leg' | 'fight' | 'cruise' | 'duel' | 'replay', cfg }`, or `{ kind: 'call', cfg: { fn: 'HS.polar', args } }`.
- `deps.mjs`: `node tools/sim/deps.mjs [entry]` lists what an entry point loads and fails on drawing code.

## Speed

Every campaign leg once (506 legs, seed 1000, fight summaries: what `checks.yml` plays), on 4 cores:

| | wall time | legs a second |
|-|-|-|
| built page in headless Chromium, 4 browsers | 236 s | 2.1 |
| plain Node, 1 worker thread | 171 s | 3.0 |
| plain Node, 4 worker threads | 54 s | 9.4 |

All three win the same 279 legs. A skirmish fight takes about a tenth of a second of one core. The handling tool's
full run (567 simulations) takes 3.4 s in Node, against 22 s in Chromium, with identical numbers.

## Node and the browser

The same code gives the same result in both nearly always, but V8's `Math.sin`, `Math.exp`, `Math.pow` and the
like round differently in the last bit in Node and in Chromium for a few inputs in a hundred. A long fight can grow
that into a different outcome: 3 of the parity set's 674 cells differ between Node and Chromium (all three m5
flagship legs), while the old and new builds in Chromium agree on all 674, as do two Node runs. So compare like with
like: Node with Node (`SRC=<other checkout>`), or a build with a build (`DIST=`). A recording made in the playtest
build replays with no drift in either, in the fights tried so far; if one ever drifts in Node, replay it with `DIST=`.
