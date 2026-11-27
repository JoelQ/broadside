# Handling

Shows how every hull sails, side by side, so a change to the sailing rules can be seen before it is played.

```
node tools/handling/run.mjs                       # everything, every hull, light air, breeze and gale
node tools/handling/run.mjs tack,irons --png      # just these manoeuvres, with PNGs and a contact sheet
node tools/handling/run.mjs --hulls sloop,brig --winds breeze --no-chase
```

It runs this checkout's `src/` in plain Node (`tools/sim/`), with no build and no browser. To compare a rules
change, pass the version from before it as `GHOST`: another checkout (a `git worktree` of main, say), or a built page:

```
git worktree add /tmp/before main
# ... change src/ship.js or src/fleet.js ...
GHOST=/tmp/before node tools/handling/run.mjs --png
```

The ghost's tracks are drawn dashed under this version's, and its numbers follow in brackets: green where this
version does better, red where worse. `DIST=<checkout or html>` runs some other version in place of this one.
A built page (`.html`) is run in headless Chromium, which needs Playwright; a version from before `tools/sim/`
can only be run that way.

A full run takes about 3.5 seconds on 4 cores in Node (about 20 for a build in Chromium); the simulations are shared
out among worker threads, `JOBS=<n>` per version. `--no-chase` skips the slowest part.

Everything goes to `out/handling/` (`--out` to change): `index.html` has every picture and the chase tables on one
page; `data.json` has the raw tracks and numbers; the tables are also printed.

## What it sails

Every test is one ship alone in open water: no land, no shoals, no current, a steady wind from the north (the top of
every picture). Full sail, battle sails in a gale (full sail tears there). The little hulls along each track show
where her bow pointed every 2 seconds, so leeway shows as the track sliding away from the way she is pointing.

| Manoeuvre | What she does | Numbers |
| --- | --- | --- |
| tack | close-hauled at full way, helm over through the wind's eye, close-hauled on the other tack | seconds to come round, slowest speed, ground made to windward in 40 s |
| wear | the same change of tack turning away from the wind | the same |
| circle | a full turn, helm hard over, from a beam reach | seconds, width of the circle |
| irons | head to wind with no way on, helm over until she pays off | seconds to get free, how far she fell back |
| beat | close-hauled for 90 s, tacking every 30 s | ground made to windward, and per second |
| gather | from rest on a beam reach | seconds to 90% speed, distance in 30 s |
| chainTack | the tack with 40% of her canvas, as chain shot leaves it | as tack |
| leeShore | lying beam-on with no way on, rocks 40 yd to leeward; she makes sail and comes up close-hauled | closest she came to the rocks |

**Polar roses** (`polar-<wind>.svg`): her settled speed over the ground at every 10° from the wind, with her best
speed made good to windward and her leeway (the angle between where she points and where she goes).

**Chases** (`chase.html`): every hull chasing every other from 300 yd, with the quarry to windward (beating away),
abeam, or to leeward (running off). The chaser steers like an AI captain, cutting the corner and never pointing into
the wind's eye unless she is rowing; nobody fires. Each cell is the seconds to close within 100 yd, or the gap left
after 4 minutes.

## How it works

`sim.js` runs on top of the game after `tools/balance/harness.js`, sets up an empty sea with
`H.setupLeg`, and drives the player's ship with `G.bot`, ticking the real rules (`G.tick`) so what it measures is
what the game does. `run.mjs` runs it in worker threads (or headless Chromium for a built page), every version at once, and draws the
SVGs. In a page the game's own frame loop is stopped, since drawing frames in software costs far more than the rules.
To add a manoeuvre, add it to `MANOEUVRES` and `metrics` in `sim.js` and to `ABOUT` in `run.mjs`.
