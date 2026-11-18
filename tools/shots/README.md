# Screenshots

```bash
npm run build
node tools/shots/shots.mjs                 # every scene at every size
node tools/shots/shots.mjs strait --sizes phone
```

Takes the title, the campaign's first story screen, and the opening of every campaign leg (set up the way
the balance harness does, in a brig) at three sizes: `desktop` (1280x720), `phone` (an iPhone SE held
sideways, with touch controls) and `portrait` (the same phone upright, which should ask you to turn it).
Writes `out/shots/<size>/<scene>.png` and `out/shots/index.html` with each scene's sizes side by side.
Exits 1 if the page threw an error. Needs Playwright, like the balance harness.
