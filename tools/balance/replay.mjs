// Plays one fight or leg again, exactly, from the seed a run recorded.
//   node tools/balance/replay.mjs <jobs.mjs> <label-regex> <seed> [trace-seconds]
// e.g. node tools/balance/replay.mjs tools/balance/legs.mjs 'm1V The run \| sloop \| shoals' 81234 5
// Prints the result, and for a campaign leg where every ship was every few seconds. Run it twice to
// see the same fight twice; change the rules and run it again to see what the change did to that fight.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const [jobsFile, pattern, seedArg, everyArg] = process.argv.slice(2);
if (!jobsFile || !pattern || seedArg == null) { console.error('usage: replay.mjs <jobs.mjs> <label-regex> <seed> [trace-seconds]'); process.exit(2); }
const cells = (await import(pathToFileURL(path.resolve(jobsFile)))).default, re = new RegExp(pattern);
const c = cells.find((x) => re.test(x.label));
if (!c) { console.error(`no cell matches /${pattern}/`); process.exit(2); }
if (process.env.DIALS) c.dials = { ...JSON.parse(process.env.DIALS), ...(c.dials || {}) }; // the same DIALS as run.mjs
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(pathToFileURL(process.env.DIST ? path.resolve(process.env.DIST) : path.join(here, '../../dist/index.html')).href); // DIST=<html> plays another build
await page.waitForTimeout(600);
await page.addScriptTag({ content: readFileSync(path.join(here, 'harness.js'), 'utf8') });
const seed = +seedArg, every = +everyArg || 0;
const r = c.mission
  ? await page.evaluate((cfg) => (cfg.routes ? H.cruise(cfg) : H.leg(cfg)), JSON.parse(JSON.stringify({ ...c, seed, trace: every || undefined, story: !!process.env.STORY })))
  : await page.evaluate((cfg) => H.fight(cfg), { ship: c.ship, fit: c.fit, level: c.level, plan: c.plan, stock: c.stock, maxT: c.maxT, dials: c.dials, story: !!process.env.STORY, seed });
await browser.close();
const { trace, legs, ...rest } = r;
console.log(`== ${c.label} · seed ${seed}`);
console.log(JSON.stringify(rest));
if (trace && trace.length) console.log(trace.join('\n'));
