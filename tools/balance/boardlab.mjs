// The boarding lab: how much grape it takes one hull to board another, with the seamanship taken out.
//   node tools/balance/boardlab.mjs [runs] [attackers] [defenders]     (after npm run build; DIST=<html> plays another build)
// The attacker is held on the defender's quarter, out of her arcs and with her stern on our beam, and fires grape
// whenever a battery is loaded, until the odds reach ODDS (default 1.25) or the grape is gone; then she boards. The
// defender sails straight on at 6 knots and never fires back except at the rail. So this measures the rules alone:
// how many rounds and seconds it takes, and who wins on deck. How risky it is to get there is for the boarding
// matrix (boarding.mjs) and for a person to judge.
//   DIALS='{"AMMO.grape.kills":{"mul":2}}' tries other numbers; GRAPE=<n> is the grape aboard (default 40); HANDS=<n>
//   caps the attacker's crew (default 150, the most a fleet ever has); ODDS=<x> is when she boards.
// Each cell: captured % / grape rounds fired / seconds to board / her crew left when we boarded / ours after the fight.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const runs = +(process.argv[2] || 3);
const ATT = (process.argv[3] || 'sloop,galliot,brig,xebec,galley,merchantman,flagship').split(',');
const DEF = (process.argv[4] || process.argv[3] || 'sloop,galliot,brig,xebec,galley,merchantman,flagship').split(',');
const SEED = +(process.env.SEED ?? 1000), dist = process.env.DIST ? path.resolve(process.env.DIST) : path.join(here, '../../dist/index.html');
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const GRAPE = +(process.env.GRAPE ?? 40), HANDS = +(process.env.HANDS || 150), ODDS = +(process.env.ODDS || 1.25);
const jobs = [];
for (const a of ATT) for (const b of DEF) for (let k = 0; k < runs; k++) jobs.push({ a, b, seed: SEED + k });
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
    const r = await page.evaluate(({ a, b, seed, dials, grape, hands, odds }) => {
      H.setupLeg({ mission: 'm0', leg: 0, hull: b, seed, dials });
      const specB = JSON.parse(JSON.stringify(G.player.spec));
      specB.stock = { chain: 3, grape: 3, fire: 0 };
      H.setupLeg({ mission: 'm0', leg: 0, hull: a, seed, dials, stock: { grape, chain: 0, fire: 0 } });
      const P = G.player, old = G.sc.S.by.pirate;
      G.api.clearShips();
      const E = (G.sc.S.by.pirate = G.api.addShip(specB, 1, old.pos.x, old.pos.z, old.heading, { id: 'pirate', speed: 6 }));
      P.crew = Math.min(P.crewMax, hands);
      E.ai = null; E.sailLevel = 1; E.input.turn = 0;
      const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
      const blind = Math.PI / 2 - E.arc - 0.15, back = E.spec.L * 0.5 + Math.min(40, P.range('grape') * 0.55);
      P.setAmmo('grape');
      const crew0 = E.crew;
      let t = 0, board = null, side = 1;
      const dt = 0.05;
      while (t < 900 && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'battle' && !board) {
          // held on her quarter, her stern abeam of us; her speed and course
          const ang = E.heading + Math.PI + side * blind * 0.6, sx = E.pos.x - Math.sin(E.heading) * E.spec.L * 0.5, sz = E.pos.z - Math.cos(E.heading) * E.spec.L * 0.5;
          P.pos.x = sx + Math.sin(ang) * (back - E.spec.L * 0.5); P.pos.z = sz + Math.cos(ang) * (back - E.spec.L * 0.5);
          const toStern = Math.atan2(sx - P.pos.x, sz - P.pos.z), s = side > 0 ? 'stbd' : 'port';
          P.heading = wrap(toStern + (side > 0 ? 1 : -1) * Math.PI / 2); // which hand puts her stern on our beam: try both
          if (!G.api.inArc(P, 'port', E, 1) && !G.api.inArc(P, 'stbd', E, 1)) P.heading = wrap(P.heading + Math.PI);
          P.speed = E.speed; P.sailLevel = 1; P.input.turn = 0;
          for (const sd of P.sides) if (G.api.inArc(P, sd, E, 1)) G.api.fire(P, sd);
          const o = G.api.strength(P) / (G.api.strength(E) || 1);
          if (o >= odds || (P.stock.grape <= 0 && !G.balls.some((x) => x.owner === P))) {
            board = { t, used: grape - P.stock.grape, eCrew: Math.round(E.crew), odds: +o.toFixed(2) };
            if (o < 1) break; // nothing to gain: she would not board at these odds
            P.pos.x = E.pos.x + Math.cos(E.heading) * (E.spec.B + P.spec.B) * 0.5; P.pos.z = E.pos.z - Math.sin(E.heading) * (E.spec.B + P.spec.B) * 0.5;
            P.heading = E.heading; P.speed = E.speed = 2; G.enemy = E; G.api.setTarget(E);
            G.api.startBoarding('player', E);
          }
        }
        if (G.state === 'boarding') G.api.boardSwivel();
        G.tick(dt, 1); t += dt;
        if (E.out) break;
      }
      const res = { o: E.out === 'captured' ? 'cap' : G.outcome || (board ? (board.odds < 1 ? 'short' : 'timeout') : 'timeout'), t: Math.round(t), crew0, pCrew: Math.round(P.crew), ...(board || {}) };
      if (G.state === 'boarding') G.api.cutGrapples();
      G.bot = null; G.state = 'story'; G.outcome = null; P.sinking = 0; G.fast = false; H.restoreDials();
      return res;
    }, { ...j, dials: DIALS, grape: GRAPE, hands: HANDS, odds: ODDS });
    (out[`${j.a}|${j.b}`] ||= []).push(r);
  }
}));
await browser.close();
const avg = (xs, f) => (xs.length ? Math.round(xs.reduce((s, x) => s + f(x), 0) / xs.length) : '-');
console.log(`grape ${GRAPE}, board at ${ODDS}:1, hands ${HANDS}${DIALS ? ', dials ' + JSON.stringify(DIALS) : ''}`);
console.log('captured % / grape fired / s to board / her crew at boarding / ours after; attacker down, defender across');
console.log(''.padEnd(12) + DEF.map((h) => h.slice(0, 9).padStart(22)).join(''));
for (const a of ATT) console.log(a.padEnd(12) + DEF.map((b) => {
  const xs = out[`${a}|${b}`];
  return `${Math.round((100 * xs.filter((x) => x.o === 'cap').length) / xs.length)}/${avg(xs, (x) => x.used ?? GRAPE)}/${avg(xs, (x) => x.t)}/${avg(xs, (x) => x.eCrew ?? 0)}/${avg(xs, (x) => x.pCrew)}`.padStart(22);
}).join(''));
if (process.env.JSON) console.log(JSON.stringify(out));
