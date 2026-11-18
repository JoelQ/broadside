Credit Claude in commits with only `Co-Authored-By: Claude <noreply@anthropic.com>`. Don't add model names or session links to commits or pull requests.

## Tools

- `npm run map -- <leg>` draws a campaign leg from above and checks its layout (`--png` for images you can look at). Run it after changing any map in `src/missions.js`. See `tools/map/README.md`.
- `npm test` runs the map checker on every leg.
- `tools/balance/` plays fights headless for win rates; see its README.
