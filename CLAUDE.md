Credit Claude in commits with only `Co-Authored-By: Claude <noreply@anthropic.com>`. Don't add model names or session links to commits or pull requests.

## Tools

- `npm run map -- <leg>` draws a campaign leg from above and checks its layout (`--png` for images you can look at). Run it after changing any map in `src/missions.js`. See `tools/map/README.md`.
- `npm test` runs the map checker on every leg.
- `tools/balance/` plays fights headless for win rates. Every fight is seeded: `replay.mjs` plays one again, and `SEED=<n>` with `compare.mjs` compares before and after a rules change. See its README.
- `node tools/shots/shots.mjs [scene]` screenshots the title and every leg's opening at desktop, phone and portrait sizes (after `npm run build`). Use it to check looks and the phone layout.
- Every pull request runs `.github/workflows/checks.yml`: map checks, the whole campaign for both sides, screenshots, and every leg played on this branch and on the base branch with the same seeds. Results are in the job summaries and artifacts.
