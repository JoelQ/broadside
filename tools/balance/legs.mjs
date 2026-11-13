// Every campaign leg x every hull x each of that leg's routes. A route is a way of winning the
// leg that a scripted captain can follow (see routeBot in harness.js). The point of this grid is
// the design rule that no mission has a single answer: each leg should be winnable by a heavy
// ship, a nimble one and an oared or boarding one, by different routes.
//   LEGS=<regex> HULLS=sloop,brig node tools/balance/run.mjs tools/balance/legs.mjs 4
const guns = [{ kill: 'all', move: 'duel', ammo: 'round' }];
const kite = [{ kill: 'all', move: 'kite', ammo: 'round' }];
const combo = [{ kill: 'all', move: 'duel', ammo: 'combo' }];
const hug = [{ kill: 'all', move: 'hug', ammo: 'round' }];
const burn = [{ kill: 'all', move: 'duel', ammo: 'fire' }];
const board = [{ kill: 'all', move: 'duel', ammo: 'combo', board: 'rush' }];
const prep = [{ kill: 'all', move: 'duel', ammo: 'combo', board: 'odds' }];
const bow = [{ kill: 'all', move: 'bow', ammo: 'round' }];
const std = { guns, kite, hug, burn, board, prep };
const run = (zone) => [{ go: 'zone:' + zone, r: 30 }];
const V = 'venice', O = 'ottoman';
const inshore = (x, zs) => zs.map((z) => ({ go: [x, z], r: 40 }));

export const LEGS = [
  { name: 'm0 Home waters', mission: 'm0', leg: 0, side: null, routes: { guns, hug, prep } },
  { name: 'm1V The picket', mission: 'm1', leg: 0, side: V, routes: { guns, run: run('north'), board } },
  { name: 'm1V The patrol', mission: 'm1', leg: 1, side: V, routes: {
    guns, kite, run: run('harbour'),
    shoals: [{ go: [520, 20], r: 50 }, { go: [660, 300], r: 50 }, { go: [540, 540], r: 50 }, ...run('harbour')],
    boardBrig: [{ kill: 'brig', move: 'duel', ammo: 'combo', board: 'rush' }],
  } },
  { name: 'm1O The guard ship', mission: 'm1', leg: 0, side: O, routes: { guns, run: run('north'), board } },
  { name: 'm1O The anchorage', mission: 'm1', leg: 1, side: O, routes: {
    batter: [{ go: [-190, -40], r: 40, sail: 2 }, { kill: 'battery', move: 'duel', ammo: 'round', anchor: true, anchorAt: 1.2 }, { go: [-60, 60], r: 40, sail: 2 }, { kill: 'powder', move: 'duel', ammo: 'round', anchor: true, anchorAt: 0.9 }],
    direct: [{ kill: 'powder', move: 'duel', ammo: 'round' }],
    eastBurn: [{ go: [230, 40], r: 50 }, { go: [150, 170], r: 40 }, { kill: 'powder', move: 'kite', ammo: 'fire', range: 110 }],
    eastBoard: [{ go: [230, 40], r: 50 }, { go: [150, 170], r: 40 }, { kill: 'powder', move: 'duel', ammo: 'grape', board: 'rush' }],
  } },
  ...['brothers', 'leeShore', 'coveRaid', 'landing', 'islets', 'falseColours'].map((k) => ({ name: 'm2 ' + k, mission: 'm2', leg: k, side: V, routes: { guns, hug, burn, board, prep, ...(k === 'falseColours' ? { rakeBoard: [{ kill: 'a', move: 'close', ammo: 'grape', board: 'rush' }] } : {}) } })),
  { name: 'm3 Dead calm', mission: 'm3', leg: 0, side: V, routes: {
    spring: [{ kill: 'all', move: 'duel', ammo: 'grape', anchor: true, anchorAt: 1.3 }],
    guns, bow, board, prep,
  } },
  { name: 'm3 The breeze', mission: 'm3', leg: 1, side: V, carry: { galleys: [{ hull: 0.7, sails: 0.8, crew: 0.7 }, null] }, routes: { guns, kite, hug, board, prep } },
  { name: 'm4V The castles', mission: 'm4', leg: 0, side: V, routes: {
    middle: run('above'),
    west: [...inshore(-222, [-520, -360, -200, -60, 60, 200, 360, 500]), ...run('above')],
    east: [...inshore(222, [-520, -360, -200, -40, 90, 200, 360, 500]), ...run('above')],
    silence: [{ go: [-40, -200], r: 40, sail: 2 }, { kill: 'west', move: 'duel', ammo: 'round', anchor: true, anchorAt: 1.2 }, ...run('above')],
  } },
  { name: 'm4V The flagship', mission: 'm4', leg: 1, side: V, routes: {
    guns: [{ kill: 'flag', move: 'duel', ammo: 'round' }, { go: 'zone:out', r: 40, wait: true }],
    burn: [{ kill: 'flag', move: 'kite', ammo: 'fire' }, { go: 'zone:out', r: 40, wait: true }],
    hug: [{ kill: 'flag', move: 'hug', ammo: 'round' }, { go: 'zone:out', r: 40, wait: true }],
    board: [{ kill: 'flag', move: 'duel', ammo: 'grape', board: 'rush' }],
    guardFirst: [{ kill: 'guard', move: 'duel', ammo: 'round' }, { kill: 'flag', move: 'duel', ammo: 'combo', board: 'odds' }, { go: 'zone:out', r: 40, wait: true }],
  } },
  { name: 'm4O The watch galley', mission: 'm4', leg: 0, side: O, routes: { guns, run: run('below'), board, prep } },
  { name: 'm4O The blockade', mission: 'm4', leg: 1, side: O, routes: {
    anchor: [{ go: [-85, -30], r: 40, sail: 2 }, { kill: 'heavy', move: 'duel', ammo: 'round', anchor: true, anchorAt: 1.05 }],
    guns: [{ kill: 'brig', move: 'duel', ammo: 'round' }],
    hug: [{ kill: 'brig', move: 'hug', ammo: 'round' }],
    burn: [{ kill: 'heavy', move: 'kite', ammo: 'fire' }],
    board: [{ kill: 'brig', move: 'duel', ammo: 'grape', board: 'rush' }],
    boardHeavy: [{ kill: 'heavy', move: 'duel', ammo: 'grape', board: 'rush' }],
  } },
  { name: 'm5O The mole', mission: 'm5', leg: 0, side: O, routes: {
    batter: [{ go: [-330, 20], r: 40, sail: 2 }, { kill: 'battery', move: 'duel', ammo: 'round', anchor: true, anchorAt: 1.2 }],
    westBurn: [{ go: [-430, 120], r: 50 }, { go: [-380, 250], r: 40 }, { kill: 'battery', move: 'kite', ammo: 'fire', range: 120 }],
    westStorm: [{ go: [-430, 120], r: 50 }, { go: [-330, 255], r: 40 }, { kill: 'battery', move: 'duel', ammo: 'grape', board: 'rush' }],
    storm: [{ kill: 'battery', move: 'duel', ammo: 'grape', board: 'rush' }],
  } },
  { name: 'm5 The harbour', mission: 'm5', leg: 1, side: O, routes: { guns, kite, hug, board, prep } },
  { name: 'm5O The flagship', mission: 'm5', leg: 2, side: O, routes: { guns: [{ kill: 'flag', move: 'duel', ammo: 'round' }], kite: [{ kill: 'flag', move: 'kite', ammo: 'round' }], hug: [{ kill: 'flag', move: 'hug', ammo: 'round' }], burn: [{ kill: 'flag', move: 'kite', ammo: 'fire' }], prep: [{ kill: 'flag', move: 'duel', ammo: 'combo', board: 'odds' }] } },
  { name: 'm5V The sortie', mission: 'm5', leg: 0, side: V, routes: {
    guns: ['fs1', 'fs0', 'fs2'].map((k) => ({ kill: k, move: 'duel', ammo: 'round' })),
    burn: ['fs1', 'fs0', 'fs2'].map((k) => ({ kill: k, move: 'duel', ammo: 'fire' })),
    board: ['fs1', 'fs0', 'fs2'].map((k) => ({ kill: k, move: 'duel', ammo: 'grape', board: 'rush' })),
  } },
  { name: 'm5V The flagship', mission: 'm5', leg: 2, side: V, routes: { guns: [{ kill: 'flag', move: 'duel', ammo: 'round' }], kite: [{ kill: 'flag', move: 'kite', ammo: 'round' }], hug: [{ kill: 'flag', move: 'hug', ammo: 'round' }], burn: [{ kill: 'flag', move: 'kite', ammo: 'fire' }], prep: [{ kill: 'flag', move: 'duel', ammo: 'combo', board: 'odds' }] } },
];
export const HULLS = ['sloop', 'brig', 'xebec', 'merchantman', 'galley', 'flagship'];
const want = process.env.LEGS ? new RegExp(process.env.LEGS) : null, hulls = process.env.HULLS ? process.env.HULLS.split(',') : HULLS, rts = process.env.ROUTES ? new RegExp(process.env.ROUTES) : null, fit = process.env.FIT ? 'full' : null;
const cells = [];
for (const L of LEGS) {
  if (want && !want.test(L.name)) continue;
  for (const hull of hulls) for (const [rn, route] of Object.entries(L.routes)) {
    if (rts && !rts.test(rn)) continue;
    if (rn === 'bow' && hull !== 'galley') continue;
    cells.push({ label: `${L.name} | ${hull}${fit ? '+' : ''} | ${rn}`, legName: L.name, mission: L.mission, leg: L.leg, side: L.side, hull, fit, route, routeName: rn, carry: L.carry, maxT: L.maxT || 600 });
  }
}
export default cells;
