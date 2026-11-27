// Who can take whom: every hull against every other in open water, one on one, trying to capture her by boarding.
//   node tools/balance/boarding.mjs [runs] [hulls]       (after npm run build; DIST=<html> plays another build)
//   DIALS='{"AMMO.grape.kills":{"mul":2}}' tries other numbers, STOCK='{"grape":30}' arms the attacker, CAPS=hug,prep picks captains
// Each cell is the share of fights the attacker (row) ended by capturing the defender (column), on seeds
// SEED (default 1000) .. SEED+runs-1, with two captains who both board once the odds are 1.25 to 1: "prep" wears
// her down with chain, then grape; "batter" fires round shot, which kills fewer men but wrecks her hull, and a crew
// fights worse in a sinking ship; "hug" sits on her quarter out of her arcs, firing chain then grape into her
// stern, which is how a small handy ship should do it. The defender is the
// same hull in good hands, fighting back with the game's own AI and a little chain and grape of her own.
// Each cell: % captured / % won by guns instead (she struck or sank first) / % overrun (taken herself in the attempt).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const runs = +(process.argv[2] || 4), HULLS = (process.argv[3] || 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(',');
const SEED = +(process.env.SEED ?? 1000), dist = process.env.DIST ? path.resolve(process.env.DIST) : path.join(here, '../../dist/index.html');
const CAPTAINS = { prep: [{ kill: 'all', move: 'duel', ammo: 'combo', board: 'odds' }], batter: [{ kill: 'all', move: 'duel', ammo: 'round', board: 'odds' }], hug: [{ kill: 'all', move: 'hug', ammo: 'combo', board: 'odds' }] };
const HANDS = +(process.env.HANDS || 150); // the attacker's crew is her fleet's hands, at most her full crew: 150 is the most a fleet ever has
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined, STOCK = process.env.STOCK ? JSON.parse(process.env.STOCK) : undefined;
for (const c of Object.keys(CAPTAINS)) if (process.env.CAPS && !process.env.CAPS.split(',').includes(c)) delete CAPTAINS[c];
const jobs = [];
for (const cap of Object.keys(CAPTAINS)) for (const a of HULLS) for (const b of HULLS) for (let k = 0; k < runs; k++) jobs.push({ cap, a, b, seed: SEED + k });
const out = {};
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(dist).href);
  await page.waitForTimeout(600);
  await page.addScriptTag({ content: readFileSync(path.join(here, 'harness.js'), 'utf8') });
  while (next < jobs.length) {
    const j = jobs[next++];
    const r = await page.evaluate(({ a, b, seed, steps, dials, stock, hands }) => {
      H.setupLeg({ mission: 'm0', leg: 0, hull: b, seed, dials });
      const specB = JSON.parse(JSON.stringify(G.player.spec));
      specB.stock = { chain: 3, grape: 3, fire: 0 };
      // Home waters with her pirate swapped for the defender
      return H.leg({ mission: 'm0', leg: 0, hull: a, seed, dials, stock, maxT: 900, route: (S) => {
        const old = S.by.pirate, [x, z, h] = [old.pos.x, old.pos.z, old.heading];
        G.api.clearShips();
        S.by.pirate = G.api.addShip(specB, 1, x, z, h, { id: 'pirate', speed: 6 });
        G.player.crew = Math.min(G.player.crewMax, hands);
        return steps;
      } });
    }, { ...j, steps: CAPTAINS[j.cap], dials: DIALS, stock: STOCK, hands: HANDS });
    const k = `${j.cap}|${j.a}|${j.b}`;
    (out[k] ||= []).push(r.foes.includes('captured') ? 'cap' : r.o === 'overrun' ? 'over' : r.o === 'won' ? 'guns' : r.o);
  }
}));
await browser.close();
const pct = (xs, w) => Math.round((100 * xs.filter((x) => x === w).length) / xs.length);
for (const cap of Object.keys(CAPTAINS)) {
  console.log(`\n${cap}: % captured / won by guns instead / overrun; attacker down, defender across`);
  console.log(''.padEnd(12) + HULLS.map((h) => h.slice(0, 9).padStart(13)).join(''));
  for (const a of HULLS) console.log(a.padEnd(12) + HULLS.map((b) => { const xs = out[`${cap}|${a}|${b}`]; return `${pct(xs, 'cap')}/${pct(xs, 'guns')}/${pct(xs, 'over')}`.padStart(13); }).join(''));
}
