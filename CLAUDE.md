Credit Claude in commits with only `Co-Authored-By: Claude <noreply@anthropic.com>`. Don't add model names or session links to commits or pull requests.

When showing work to the user for them to try or validate, build with `npm run build:playtest` and share `dist/playtest.html` (for example, published as an artifact), not the public `dist/index.html`. The playtest build lets them jump straight to the mission, fight and ships the change affects; say which ones to pick.

## Tools

- `npm run map -- <leg>` draws a campaign leg from above and checks its layout (`--png` for images you can look at). Run it after changing any map in `src/missions.js`. See `tools/map/README.md`.
- `npm test` runs the map checker on every leg.
- `node tools/handling/run.mjs` sails standard manoeuvres (tack, wear, irons, beat, lee shore...) with every hull in three winds and draws the tracks laid over each other, plus polar roses and a chase table; `GHOST=<old dist html>` draws a build from before a change dashed underneath. Run it after changing how ships sail (`src/ship.js`, hull numbers in `src/fleet.js`). See `tools/handling/README.md`.
- `tools/balance/` plays fights headless for win rates. Every fight is seeded: `replay.mjs` plays one again, and `SEED=<n>` with `compare.mjs` compares before and after a rules change. See its README.
- `node tools/shots/shots.mjs [scene]` screenshots the title and every leg's opening at desktop, phone and portrait sizes (after `npm run build`). Use it to check looks and the phone layout.
- `node tools/portraits/gallery.mjs` shows every character portrait (`src/portraits.js`) at dialog and bubble sizes. See `tools/portraits/README.md`.
- Every pull request runs `.github/workflows/checks.yml`: map checks, the whole campaign for both sides, screenshots, and every leg played on this branch and on the base branch with the same seeds. Results are in the job summaries and artifacts.
