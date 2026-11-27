// Plays a list of cells in parallel and returns every fight's result, cell by cell. run.mjs and sweep.mjs both use it.
// By default the game runs in plain Node, one worker thread per core, straight from src/ (see tools/sim): no build,
// no browser. SRC=<checkout> (or opts.src) plays another checkout's src/ the same way, with this checkout's harness.
// With a dist (a built page, say of a version from before tools/sim) it plays that build in headless Chromium
// instead, which needs Playwright; BROWSER=1 does the same with dist/index.html.
// A cell is a skirmish fight ({ ship, fit, level, plan }) or a campaign leg
// ({ mission, leg, hull, route }), a whole mission ({ mission, routes }) or one hull against another
// ({ duel: true, a, b, route }) or a fight a person recorded ({ rec }); see harness.js.
//   play(cells, runs, { seed, dist, workers, story }) -> results[i] = the runs of cells[i], in order of k
// story: every result carries a fight record (see story.mjs); 'lite' keeps its summary without the samples.
// With a seed, run k of every cell is played on seed + k, so two calls with the same seed face the same luck.
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { availableParallelism } from 'os';
import path from 'path';
const chromium = () => createRequire(import.meta.url)('playwright').chromium;
const here = path.dirname(fileURLToPath(import.meta.url));
const harness = readFileSync(path.join(here, 'harness.js'), 'utf8');

// the job a cell is, as the harness takes it
const job = (c, seed, opts) => (c.rec
  ? { kind: 'replay', cfg: JSON.parse(JSON.stringify({ rec: c.rec, dials: c.dials, story: !!opts.story })) }
  : c.duel
  ? { kind: 'duel', cfg: JSON.parse(JSON.stringify({ ...c, seed, story: !!opts.story })) }
  : c.mission
  ? { kind: c.routes ? 'cruise' : 'leg', cfg: JSON.parse(JSON.stringify({ ...c, seed, story: !!opts.story })) }
  : { kind: 'fight', cfg: JSON.parse(JSON.stringify({ ship: c.ship, fit: c.fit, level: c.level, plan: c.plan, stock: c.stock, maxT: c.maxT, dials: c.dials, story: !!opts.story, seed })) });
const lite = (res, opts) => { if (opts.story === 'lite' && res.story) delete res.story.samples; return res; }; // the summary without the second-by-second record

export async function play(cells, runs, opts = {}) {
  if (opts.dist || process.env.BROWSER) return playBrowser(cells, runs, opts);
  return playNode(cells, runs, opts);
}

// every fight in plain Node: a worker thread per core, each with its own game
export async function playNode(cells, runs, opts = {}) {
  const base = opts.seed != null ? +opts.seed : null, t0 = Date.now();
  const root = path.resolve(opts.src || process.env.SRC || path.join(here, '../..'));
  if (!existsSync(path.join(root, 'tools/sim/headless.mjs'))) throw new Error(`${root} has no headless game (tools/sim/headless.mjs): play its build in the browser instead (DIST=...)`);
  const queue = cells.flatMap((c, i) => Array.from({ length: runs }, (_, k) => [i, k])).reverse(), total = queue.length;
  const results = cells.map(() => []), workers = Math.max(1, Math.min(opts.workers || availableParallelism(), total));
  await Promise.all(Array.from({ length: workers }, () => new Promise((resolve, reject) => {
    const w = new Worker(path.join(root, 'tools/sim/worker.mjs'), { workerData: { root, extra: opts.extra || [], harness: path.join(here, 'harness.js') } });
    let cur = null;
    const next = () => {
      if (!queue.length) { w.terminate(); return resolve(); }
      const [i, k] = (cur = queue.pop()), c = cells[i], seed = c.seed ?? (base != null ? base + k : undefined);
      if (queue.length % 100 === 0 && queue.length) console.error(`${queue.length} to go, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      w.postMessage({ id: i, ...job(c, seed, opts) });
    };
    w.on('message', (m) => {
      if (m.ready) return next();
      if (m.error) { w.terminate(); return reject(new Error(`${cells[cur[0]].label || 'cell ' + cur[0]}: ${m.error}`)); }
      lite(m.res, opts); m.res.k = cur[1]; results[cur[0]].push(m.res);
      next();
    });
    w.on('error', reject);
  })));
  for (const r of results) r.sort((a, b) => a.k - b.k);
  if (opts.timing !== false && total > 20) console.error(`${total} fights in ${((Date.now() - t0) / 1000).toFixed(1)}s on ${workers} threads`);
  return results;
}

// every fight in headless Chromium, on a built page (dist/index.html, or any build given as dist)
export async function playBrowser(cells, runs, opts = {}) {
  const base = opts.seed != null ? +opts.seed : null, workers = opts.workers || 4, t0 = Date.now();
  const dist = opts.dist ? path.resolve(opts.dist) : path.join(here, '../../dist/index.html');
  const queue = cells.flatMap((c, i) => Array.from({ length: runs }, (_, k) => [i, k])).reverse();
  const results = cells.map(() => []);
  const browser = await chromium().launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  await Promise.all(Array.from({ length: workers }, async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
    page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
    await page.goto(pathToFileURL(dist).href);
    await page.waitForTimeout(600);
    await page.addScriptTag({ content: harness });
    while (queue.length) {
      const [i, k] = queue.pop(), c = cells[i], seed = c.seed ?? (base != null ? base + k : undefined);
      if (queue.length % 100 === 0 && queue.length) console.error(`${queue.length} to go, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      const { kind, cfg } = job(c, seed, opts), res = await page.evaluate(([kd, cf]) => H[kd](cf), [kind, cfg]);
      lite(res, opts);
      res.k = k; results[i].push(res);
    }
  }));
  await browser.close();
  for (const r of results) r.sort((a, b) => a.k - b.k);
  return results;
}

// The shipped value at each path in G.dials (the first match for a '*' path), read from src/ (or from a build, given dist).
export async function shipped(paths, opts = {}) {
  const pick = (D, ps) => ps.map((p) => {
    let o = [D];
    for (const k of p.split('.')) o = o.flatMap((x) => (x == null ? [] : k === '*' ? Object.values(x) : [x[k]]));
    return o.find((x) => x !== undefined) ?? null;
  });
  if (!opts.dist && !process.env.BROWSER) {
    const { load } = await import(pathToFileURL(path.join(path.resolve(opts.src || process.env.SRC || path.join(here, '../..')), 'tools/sim/headless.mjs')).href);
    const { G } = await load();
    return JSON.parse(JSON.stringify(pick(G.dials, paths)));
  }
  const dist = opts.dist ? path.resolve(opts.dist) : path.join(here, '../../dist/index.html');
  const browser = await chromium().launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  await page.goto(pathToFileURL(dist).href);
  await page.waitForTimeout(300);
  const out = await page.evaluate((ps) => ps.map((p) => {
    let o = [G.dials];
    for (const k of p.split('.')) o = o.flatMap((x) => (x == null ? [] : k === '*' ? Object.values(x) : [x[k]]));
    return o.find((x) => x !== undefined) ?? null;
  }), paths);
  await browser.close();
  return out;
}
