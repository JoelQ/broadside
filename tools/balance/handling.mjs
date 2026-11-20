// How each hull handles under sail, measured in open water with a steady breeze and nothing else.
//   node tools/balance/handling.mjs [hulls] [sail]      (after npm run build; DIST=<html> measures another build)
// hulls: comma list (default every hull); sail: 0 furled .. 3 full (default 2, battle sails).
// For each hull it prints:
//   top      speed on her best point of sail, and beam-reach speed
//   upwind   best speed made good straight upwind (yd/s) and the heading off the wind that gives it
//   tack     seconds to come about from close-hauled on one tack to close-hauled on the other, and her
//            lowest speed on the way ("stuck" if she has not come round in 60 s)
//   irons    seconds to pay off from dead into the wind at rest until her sails draw again
//   circle   seconds for a full turn from a beam reach at full way, and the circle's width (yd)
//   way      seconds from rest to 90% of beam-reach speed, and to coast from it down to a third once the sails are furled
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const HULLS = (process.argv[2] || 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(','), SAIL = +(process.argv[3] ?? 2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(pathToFileURL(process.env.DIST ? path.resolve(process.env.DIST) : path.join(here, '../../dist/index.html')).href);
await page.waitForTimeout(600);
await page.addScriptTag({ content: readFileSync(path.join(here, 'harness.js'), 'utf8') });
const rows = [];
for (const hull of HULLS) rows.push(await page.evaluate(([hull, SAIL]) => {
  const PI = Math.PI, wrap = (a) => { a = (a + PI) % (PI * 2); if (a < 0) a += PI * 2; return a - PI; };
  H.setupLeg({ mission: 'm0', leg: 0, side: null, hull, seed: 1 });
  const W = G.api.world, P = G.player, dt = 0.05;
  G.api.clearShips(); W.islands = []; W.pieces = []; W.shoals = []; W.currentAt = null;
  W.setWind(0, 1, true); W.wind.steady = true; W.wind.timer = 1e9; W.wind.next = null;
  P.oar = 0; // under sail only
  let turn = 0; G.bot = (me) => { me.input.turn = turn; me.sailLevel = SAIL; };
  const off = () => wrap(P.heading - W.wind.dir); // 0 is running dead before the wind, PI is head to wind
  const noGo = Math.max(0.2, 0.6 - (P.spec.point || 0));
  const reset = (h, v) => { P.pos.set(0, 0, 0); P.heading = wrap(h); P.speed = v; P.yaw = 0; P.rudder = 0; P.anchored = false; P.aground = 0; turn = 0; };
  const run = (secs, until) => { for (let t = 0; t < secs; t += dt) { G.tick(dt, 1); if (until && until(t)) return t; } return null; };
  const r1 = (x) => Math.round(x * 10) / 10;
  // speeds by heading, from the ship's own speed function
  let best = 0, bestOff = 0, top = 0, beam = 0;
  for (let d = 0; d <= 180; d += 1) {
    P.heading = (d * PI) / 180; P.sailLevel = SAIL; const v = P.maxSpeedNow(W);
    top = Math.max(top, v); if (d === 90) beam = v;
    const vmg = -v * Math.cos(P.heading); if (vmg > best) { best = vmg; bestOff = d; }
  }
  // tack: close-hauled on one tack at full way, helm hard over through the wind, until close-hauled on the other
  const ch = PI - noGo - 0.3;
  reset(ch, 0); run(40);
  turn = 1; let vmin = P.speed;
  const tack = run(60, () => { vmin = Math.min(vmin, P.speed); return off() < 0 && off() > -ch - 0.02; });
  // irons: head to wind, no way on, helm hard over, until her sails draw (out of the no-go wedge)
  reset(PI, 0); turn = 1;
  const irons = run(60, () => Math.abs(off()) < PI - noGo - 0.1);
  // turning circle from a beam reach at full way
  reset(PI / 2, 0); run(40); turn = 1;
  let turned = 0, last = P.heading, far = 0; const x0 = P.pos.x, z0 = P.pos.z;
  const circle = run(90, () => { turned += Math.abs(wrap(P.heading - last)); last = P.heading; far = Math.max(far, Math.hypot(P.pos.x - x0, P.pos.z - z0)); return turned >= 2 * PI; });
  // way: gathering way from rest on a beam reach, then coasting once the canvas is in
  reset(PI / 2, 0); const target = beam * 0.9;
  const gather = run(90, () => P.speed >= target);
  const v0 = P.speed; G.bot = (me) => { me.input.turn = 0; me.sailLevel = 0; };
  const coast = run(90, () => P.speed <= v0 / 3);
  G.bot = null; G.state = 'story';
  return { hull, mass: r1(P.mass), turn: P.spec.turn, top: r1(top), beam: r1(beam), vmg: r1(best), vmgOff: bestOff, tack: tack == null ? 'stuck' : r1(tack), vmin: r1(vmin), irons: irons == null ? 'stuck' : r1(irons), circle: circle == null ? '-' : r1(circle), width: Math.round(far), gather: gather == null ? '-' : r1(gather), coast: coast == null ? '-' : r1(coast) };
}, [hull, SAIL]));
await browser.close();
const cols = [['hull', 12], ['mass', 5], ['turn', 5], ['top', 6], ['beam', 6], ['vmg', 5], ['vmgOff', 7], ['tack', 7], ['vmin', 5], ['irons', 7], ['circle', 7], ['width', 6], ['gather', 7], ['coast', 6]];
console.log(`sail level ${SAIL}, breeze`);
console.log(cols.map(([k, w]) => k.padStart(w)).join(''));
for (const r of rows) console.log(cols.map(([k, w]) => String(r[k]).padStart(w)).join(''));
