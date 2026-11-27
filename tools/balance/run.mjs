// Balance runner: plays a list of fights in parallel headless pages and prints a summary.
//   node tools/balance/run.mjs <jobs.mjs> [runs-per-cell] [out.json]
// A jobs file default-exports an array of { label, ship, fit, level, plan }.
// SEED=<n> plays run k of every cell on seed n + k, so two runs with the same SEED (before and after a
// change) face the same luck and compare.mjs can pair them up. Without SEED every fight gets a fresh seed.
// Every result records its seed; replay.mjs plays one again.
import { writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';
import { play } from './play.mjs';
const [jobsFile, runsArg, outFile] = process.argv.slice(2);
const cells = (await import(pathToFileURL(path.resolve(jobsFile)))).default, runs = +runsArg || 4;
// DIALS='{"AMMO.grape.hull":0.8}' changes those numbers in every fight (on top of any a cell sets itself).
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : null;
if (DIALS) for (const c of cells) c.dials = { ...DIALS, ...(c.dials || {}) };
const t0 = Date.now();
const results = await play(cells, runs, { seed: process.env.SEED, dist: process.env.DIST }); // DIST=<html> plays another build
const avg = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
const rows = cells.map((c, i) => {
  const r = results[i], w = r.filter((x) => x.win);
  return { ...c, runs: r.map((x) => ({ k: x.k, seed: x.seed, win: !!x.win, o: x.o, t: x.t })), n: r.length, win: w.length / r.length, guns: r.filter((x) => x.how === 'guns').length, board: r.filter((x) => x.how === 'board').length,
    lost: r.filter((x) => x.o === 'lost').length, overrun: r.filter((x) => x.o === 'overrun').length, timeout: r.filter((x) => x.o === 'timeout').length,
    t: Math.round(avg(r, (x) => x.t)), hull: +avg(w, (x) => x.hull).toFixed(2), eHull: +avg(r, (x) => x.eHull).toFixed(2), exposed: +avg(r, (x) => x.exposed).toFixed(2), acc: +avg(r, (x) => x.hits / (x.shots || 1)).toFixed(2) };
});
if (outFile) writeFileSync(outFile, JSON.stringify(rows));
if (cells[0].mission) {
  // campaign legs: one line per route
  for (const [i, c] of cells.entries()) {
    const r = results[i], n = r.length, w = r.filter((x) => x.win), cnt = (f) => r.filter(f).length;
    const outs = {}; for (const x of r) if (!x.win) outs[x.o] = (outs[x.o] || 0) + 1;
    console.log(`${c.label.padEnd(54)} win ${String(Math.round((w.length / n) * 100)).padStart(3)}% | ${String(Math.round(avg(r, (x) => x.t))).padStart(3)}s  hull ${avg(w, (x) => x.hull).toFixed(2)} crew ${avg(w, (x) => x.crew).toFixed(2)} | aground ${cnt((x) => x.aground > 0)} boarded ${cnt((x) => x.boarded)} | ${Object.entries(outs).map(([k, v]) => k + ' ' + v).join(' ')} | ${r[0].foes} @${r[0].pos}`);
  }
  if (outFile) writeFileSync(outFile, JSON.stringify(cells.map((c, i) => ({ ...c, results: results[i], runs: results[i].map((x) => ({ k: x.k, seed: x.seed, win: !!x.win, o: x.o, t: x.t })) }))));
  console.error(`${cells.length * runs} legs in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(0);
}
for (const r of rows) console.log(`${r.label.padEnd(46)} win ${String(Math.round(r.win * 100)).padStart(3)}%  guns ${r.guns} board ${r.board} | lost ${r.lost} overrun ${r.overrun} t/o ${r.timeout} | ${String(r.t).padStart(3)}s  hull left ${r.hull}  her hull ${r.eHull}  exposed ${r.exposed}  acc ${r.acc}`);
console.error(`${cells.length * runs} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
