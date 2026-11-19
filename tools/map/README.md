# Map preview and checks

Draws every campaign leg from above and checks its layout, in plain Node with no browser and no build.
It builds each leg with the same `build(c)` the game calls, so it always shows the maps as they are in
`src/missions.js`.

```bash
npm run map                 # every leg
npm run map -- m4           # legs whose name matches a regex: "m1V The run", "strait", "m5O"
npm run map -- m4 --png     # also PNGs and a contact sheet (needs Playwright, like the balance harness)
npm run map -- --json       # findings as JSON, for scripts and agents
npm test                    # the checker's own tests, plus "every leg passes"
```

It writes `out/maps/<leg>.svg` and `out/maps/index.html` (all legs on one page); with `--png`, a PNG per
leg and `out/maps/contact.png`. The leg list and the routes drawn on the maps come from
`tools/balance/legs.mjs`, so a new leg shows up here once it's in the balance grid.

## What a map shows

North (+z) is up. Land is sand with the line a ship actually hits (r x 0.8) in green. Banks are the same ragged
shapes the game builds (a ship that draws more than the depth sticks anywhere inside), drawn under the
land and shaded by depth with the depth written on them; a reef (under 2 deep) grounds anything. Zones are dashed gold
circles. Ships are drawn to length (at least 14 px), pointing where they head: gold is you, blue friends,
red foes; hollow means at anchor, dashed means the ship arrives later (from the leg's timed events). Forts
are squares with their gun reach. Dotted lines from a ship go to where it is sent (`goTo`); coloured
dotted paths are the balance routes' waypoints. Arrows on the water are the current; the dial is the wind
(pointing where it blows to).

## What it checks

- **error**: a ship starts on land, or on a bank shallower than she draws; a zone is centred on land; a
  zone no hull can reach from the player's start; a route waypoint on land. Errors make the command exit 1.
- **warn**: the player's start is aground for some hulls (named); ships start overlapping or on top of
  the player; a ship is sent somewhere she can't get to; no hull can reach a route's waypoints.
- **note**: which hulls can reach each zone and each route's waypoints.

"Reach" is a flood fill on an 8 m grid that keeps a ship a beam's width off land and off any bank she'd
stick on (by the bank's shape, not a circle round it). It ignores wind, current and enemies: it answers "is there water", not "can you win".

Timed events are run against a stand-in scene to find later arrivals and zones. An event that depends on
the state of the fight is skipped, so a ship that only appears if something happens may not be drawn.
