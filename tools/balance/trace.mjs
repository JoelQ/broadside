// Plays one cell of legs.mjs and prints where everything was every few seconds.
//   LEGS='m1V The patrol' HULLS=sloop ROUTES=shoals [SEED=n] node tools/balance/trace.mjs [seconds-between-lines]
// Plays in plain Node from src/ (see tools/sim); DIST=<html> plays a built page in the browser instead.
import { play } from './play.mjs';
const cells = (await import('./legs.mjs')).default.slice(0, 3), every = +process.argv[2] || 10;
const seed = process.env.SEED != null ? +process.env.SEED : undefined;
const res = await play(cells.map((c) => ({ ...c, trace: every, seed })), 1, { workers: 1, dist: process.env.DIST });
for (const [i, c] of cells.entries()) {
  const r = res[i][0];
  console.log(`== ${c.label}: ${r.o} at ${r.t}s (seed ${r.seed})`);
  console.log(r.trace.join('\n'));
}
