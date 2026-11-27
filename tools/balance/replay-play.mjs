// Plays fights a person recorded in the playtest build again, exactly, with nothing drawn.
//   node tools/balance/replay-play.mjs <recording.json>... [--out run.json]
// A recording is what the playtest build's "Copy" button puts on the clipboard (pause menu, or the playtest
// panel's Recorded fights): save it to a file. Each is played on dist/index.html (DIST=<html> for another build)
// and checked against what happened when it was played: same outcome, and where (if anywhere) the ship first
// drifted from the recorded track. On the build it was recorded on it should not drift; on another build, or with
// DIALS, the drift and the outcome say what the change would have done to that very fight, played the same way.
// STORY=1 records the replay; --out writes a run file that story.mjs can draw.
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), files = [], flags = {};
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]; else files.push(args[i]); }
if (!files.length) { console.error('usage: replay-play.mjs <recording.json>... [--out run.json]'); process.exit(2); }
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(pathToFileURL(process.env.DIST ? path.resolve(process.env.DIST) : path.join(here, '../../dist/index.html')).href);
await page.waitForTimeout(600);
await page.addScriptTag({ content: readFileSync(path.join(here, 'harness.js'), 'utf8') });
const cells = [];
for (const f of files) {
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  for (const rec of Array.isArray(raw) ? raw : [raw]) {
    const res = await page.evaluate((cfg) => H.replay(cfg), { rec, dials: DIALS, story: !!process.env.STORY });
    const label = `${rec.title} | ${rec.hull} | played ${rec.when.slice(0, 16).replace('T', ' ')}`;
    console.log(`== ${label}`);
    if (res.o === 'mismatch') { console.log(`  can't replay: ${res.why}`); continue; }
    const done = rec.outcome != null, tamper = rec.tampered ? ' (playtest controls were used: expect it to differ)' : '';
    console.log(`  recorded: ${done ? `${rec.outcome} at ${rec.t}s, hull ${Math.round(rec.hullLeft * 100)}%` : `still going when it was copied, ${rec.dt.length} frames in`}${tamper}`);
    const drift = res.drift ? `left the recorded track at ${res.drift.t}s (${res.drift.yards} yd off${res.drift.hull ? `, hull ${res.drift.hull > 0 ? "+" : ""}${res.drift.hull} points` : ''})` : 'kept to the recorded track';
    console.log(`  replayed: ${res.o === 'unfinished' ? 'still going' : res.o} at ${res.t}s, hull ${Math.round(res.hull * 100)}%${done ? ` · ${res.same ? 'same outcome' : 'DIFFERENT OUTCOME'}` : ''} · ${drift}`);
    if (res.story) console.log(`  ${res.story.cause}`);
    cells.push({ label, legName: rec.title, hull: rec.hull, routeName: 'played', results: [res], runs: [{ k: 0, seed: res.seed, win: res.win, o: res.o, t: res.t }] });
  }
}
await browser.close();
if (flags.out) writeFileSync(flags.out, JSON.stringify(cells));
