// The game in this process, with nothing drawn: src/game.js started with no view, and the balance harness
// (tools/balance/harness.js) on top, as a page would have them. No browser, no build: it runs src/ as it is.
//   const { G, H } = await load(); H.leg({ mission: 'm1', ... })
// Pass more scripts (paths) to run after the harness, as a page's script tags would (the handling tool's sim.js).
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));

// harness: another copy of harness.js to run instead of this checkout's (play.mjs passes its own, so two versions
// of the game are played by the same harness).
export async function load(extra = [], harness = path.join(here, '../balance/harness.js')) {
  globalThis.__PLAYTEST__ ??= false; // the build sets this; the playtest tools are not part of a headless run
  const { start } = await import('../../src/game.js');
  const G = start();
  globalThis.window = globalThis; globalThis.G = G;
  for (const f of [harness, ...extra]) (0, eval)(readFileSync(f, 'utf8'));
  return { G, H: globalThis.H };
}
