// Balance runner: plays a list of fights in parallel headless pages and prints a summary.
//   node tools/balance/run.mjs <jobs.mjs> [runs-per-cell] [out.json]
// A jobs file default-exports an array of { label, ship, fit, level, plan }.
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const [jobsFile, runsArg, outFile] = process.argv.slice(2);
const cells = (await import(pathToFileURL(path.resolve(jobsFile)))).default, runs = +runsArg || 4, WORKERS = 4;
const harness = readFileSync(path.join(here, 'harness.js'), 'utf8');
const queue = cells.flatMap((c, i) => Array.from({ length: runs }, () => i));
const results = cells.map(() => []);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(path.join(here, '../../dist/index.html')).href);
  await page.waitForTimeout(600);
  await page.addScriptTag({ content: harness });
  while (queue.length) {
    const i = queue.pop(), c = cells[i];
    if (queue.length % 100 === 0 && queue.length) console.error(`${queue.length} to go, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    results[i].push(c.mission ? await page.evaluate((cfg) => (cfg.routes ? H.cruise(cfg) : H.leg(cfg)), JSON.parse(JSON.stringify(c))) : await page.evaluate((cfg) => H.fight(cfg), { ship: c.ship, fit: c.fit, level: c.level, plan: c.plan, stock: c.stock, maxT: c.maxT }));
  }
}));
await browser.close();
const avg = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
const rows = cells.map((c, i) => {
  const r = results[i], w = r.filter((x) => x.win);
  return { ...c, n: r.length, win: w.length / r.length, guns: r.filter((x) => x.how === 'guns').length, board: r.filter((x) => x.how === 'board').length,
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
  if (outFile) writeFileSync(outFile, JSON.stringify(cells.map((c, i) => ({ ...c, results: results[i] }))));
  console.error(`${cells.length * runs} legs in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(0);
}
for (const r of rows) console.log(`${r.label.padEnd(46)} win ${String(Math.round(r.win * 100)).padStart(3)}%  guns ${r.guns} board ${r.board} | lost ${r.lost} overrun ${r.overrun} t/o ${r.timeout} | ${String(r.t).padStart(3)}s  hull left ${r.hull}  her hull ${r.eHull}  exposed ${r.exposed}  acc ${r.acc}`);
console.error(`${queue.length} left, ${cells.length * runs} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
