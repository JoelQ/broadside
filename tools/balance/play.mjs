// Plays a list of cells in parallel headless pages and returns every fight's result, cell by cell.
// run.mjs and sweep.mjs both use it. A cell is a skirmish fight ({ ship, fit, level, plan }) or a campaign leg
// ({ mission, leg, hull, route }) or a whole mission ({ mission, routes }); see harness.js.
//   play(cells, runs, { seed, dist, workers }) -> results[i] = the runs of cells[i], in order of k
// With a seed, run k of every cell is played on seed + k, so two calls with the same seed face the same luck.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const harness = readFileSync(path.join(here, 'harness.js'), 'utf8');

export async function play(cells, runs, opts = {}) {
  const base = opts.seed != null ? +opts.seed : null, workers = opts.workers || 4, t0 = Date.now();
  const dist = opts.dist ? path.resolve(opts.dist) : path.join(here, '../../dist/index.html');
  const queue = cells.flatMap((c, i) => Array.from({ length: runs }, (_, k) => [i, k])).reverse();
  const results = cells.map(() => []);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  await Promise.all(Array.from({ length: workers }, async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
    page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
    await page.goto(pathToFileURL(dist).href);
    await page.waitForTimeout(600);
    await page.addScriptTag({ content: harness });
    while (queue.length) {
      const [i, k] = queue.pop(), c = cells[i], seed = c.seed ?? (base != null ? base + k : undefined);
      if (queue.length % 100 === 0 && queue.length) console.error(`${queue.length} to go, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      const res = c.mission
        ? await page.evaluate((cfg) => (cfg.routes ? H.cruise(cfg) : H.leg(cfg)), JSON.parse(JSON.stringify({ ...c, seed })))
        : await page.evaluate((cfg) => H.fight(cfg), { ship: c.ship, fit: c.fit, level: c.level, plan: c.plan, stock: c.stock, maxT: c.maxT, dials: c.dials, seed });
      res.k = k; results[i].push(res);
    }
  }));
  await browser.close();
  for (const r of results) r.sort((a, b) => a.k - b.k);
  return results;
}

// The shipped value at each path in G.dials (the first match for a '*' path), read from the build.
export async function shipped(paths, opts = {}) {
  const dist = opts.dist ? path.resolve(opts.dist) : path.join(here, '../../dist/index.html');
  const browser = await chromium.launch();
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
