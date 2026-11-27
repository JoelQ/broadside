// Searches for the best captain for one matchup: how well can this hull do here, at best? The stock captains in
// matrix.mjs and legs.mjs are a handful of fixed plans, so a 0% there means "not with these plans". This tries many
// more (how she moves, what she fires, when she boards, at what range) and keeps the best.
//   node tools/balance/search.mjs duel <attacker> <defender> [--budget 48] [--seeds 2,6,20]
//   node tools/balance/search.mjs leg '<leg regex>' <hull> [--budget 48]
// It plays every candidate on a couple of seeds, keeps the best quarter on more seeds, then the best three and the
// stock captains on many seeds (successive halving), so most fights go to the promising plans. For a leg, a candidate
// may first sail the waypoints of one of the leg's own routes. Candidates are drawn from SEED (default 1000), so a
// search repeats exactly; DIALS works as with run.mjs.
// Reports the best plans found, the best stock plan, and the gap between them: a big gap means the stock captains
// undersell this hull here, or a tactic the stock plans never try is far stronger than the rest.
import { play } from './play.mjs';

const args = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const [mode, x, y] = pos;
if (!['duel', 'leg'].includes(mode) || !x || !y) { console.error("usage: search.mjs duel <attacker> <defender> | leg '<leg regex>' <hull> [--budget 48] [--seeds 2,6,20]"); process.exit(2); }
const budget = +flags.budget || 48, [s0, s1, s2] = (flags.seeds || '2,6,20').split(',').map(Number);
const SEED = process.env.SEED != null ? +process.env.SEED : 1000, DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
let rnd = SEED >>> 0; // mulberry32: the candidates are the same every time for the same SEED
const rand = () => { rnd = (rnd + 0x6d2b79f5) >>> 0; let t = rnd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];

// what a fight step can be
const SPACE = { move: ['duel', 'kite', 'hug', 'close', 'bow'], ammo: ['round', 'chain', 'grape', 'fire', 'combo'], board: ['never', 'never', 'odds', 'rush'], odds: [1, 1.25, 1.6, 2.2], rangeK: [null, 0.3, 0.5, 0.7, 0.9] };
const stepLabel = (s) => [s.move, s.ammo, s.board === 'odds' ? `odds${s.odds}` : s.board, s.rangeK ? `r${s.rangeK}` : ''].filter(Boolean).join(' ');

// the target, the stock captains, and route prefixes (the waypoints before a route's first fight)
let base, stock = {}, prefixes = { '': [] };
if (mode === 'duel') {
  base = { duel: true, a: x, b: y };
  const M = { guns: ['duel', 'round', 'never'], kite: ['kite', 'round', 'never'], hug: ['hug', 'round', 'never'], burn: ['duel', 'fire', 'never'], prep: ['duel', 'combo', 'odds'], hugBoard: ['hug', 'combo', 'odds'], rush: ['duel', 'grape', 'rush'] };
  for (const [k, [move, ammo, board]] of Object.entries(M)) stock[k] = [{ kill: 'all', move, ammo, board }];
} else {
  const legs = (await import('./legs.mjs')).default;
  const mine = legs.filter((c) => new RegExp(x).test(c.legName) && c.hull === y);
  if (!mine.length) { console.error(`no legs.mjs cell for /${x}/ with ${y}`); process.exit(2); }
  const { route, routeName, label, ...rest } = mine[0];
  base = rest;
  for (const c of mine) {
    if (typeof c.route === 'function') continue;
    stock[c.routeName] = c.route;
    const pre = c.route.slice(0, c.route.findIndex((s) => s.kill) < 0 ? c.route.length : c.route.findIndex((s) => s.kill));
    if (pre.length && !c.route.every((s) => s.go)) prefixes[c.routeName] = pre;
  }
  console.error(`${mine[0].legName} with a ${y}: stock routes ${Object.keys(stock).join(', ')}`);
}

// candidates: a prefix, then one fight step against everything
const cands = new Map();
for (let tries = 0; cands.size < budget && tries < budget * 20; tries++) {
  const s = { kill: 'all', move: pick(SPACE.move), ammo: pick(SPACE.ammo), board: pick(SPACE.board) };
  if (s.board === 'odds') s.odds = pick(SPACE.odds);
  const rk = pick(SPACE.rangeK); if (rk && s.move !== 'hug' && s.move !== 'close') s.rangeK = rk;
  if (s.move === 'bow' && !(base.hull || base.a || '').startsWith('gall')) continue; // only oared ships fight bow-on
  const pre = pick(Object.keys(prefixes)), label = `${pre ? pre + ' then ' : ''}${stepLabel(s)}`;
  if (!cands.has(label)) cands.set(label, [...prefixes[pre], s]);
}
const cell = (label, route) => ({ ...base, label, route, dials: DIALS });
const score = (rs) => rs.filter((r) => r.win).length / rs.length;
async function round(list, runs, seedAt) {
  const res = await play(list.map(([l, r]) => cell(l, r)), runs, { seed: seedAt });
  return list.map(([l, r], i) => ({ label: l, route: r, win: score(res[i]), runs: res[i] })).sort((a, b) => b.win - a.win || a.runs.reduce((s, q) => s + q.t, 0) - b.runs.reduce((s, q) => s + q.t, 0));
}
const t0 = Date.now();
console.error(`${cands.size} candidates: ${s0} seeds each, then the best quarter on ${s1}, then the best 3 and ${Object.keys(stock).length} stock plans on ${s2}`);
const r0 = await round([...cands], s0, SEED);
const r1 = await round(r0.slice(0, Math.max(3, Math.ceil(r0.length / 4))).map((c) => [c.label, c.route]), s1, SEED + 100);
const finals = [...r1.slice(0, 3).map((c) => [c.label, c.route]), ...Object.entries(stock).map(([k, r]) => [`stock: ${k}`, r])];
const r2 = await round(finals, s2, SEED + 1000);
const fights = cands.size * s0 + r1.length * s1 + finals.length * s2;
const found = r2.filter((c) => !c.label.startsWith('stock:')), stocks = r2.filter((c) => c.label.startsWith('stock:'));
const pct = (v) => `${Math.round(v * 100)}%`;
console.log(`\n${mode === 'duel' ? `${x} against ${y}` : `${base.legName} with a ${y}`}: ${fights} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s, final round on seeds ${SEED + 1000}..${SEED + 1000 + s2 - 1}\n`);
for (const c of r2) {
  const outs = {}; for (const q of c.runs) if (!q.win) outs[q.o] = (outs[q.o] || 0) + 1;
  console.log(`  ${pct(c.win).padStart(4)}  ${c.label.padEnd(44)} ${c.runs.some((q) => q.how === 'board' || q.boarded) ? 'boards ' : ''}${Object.entries(outs).map(([k, v]) => `${k} ${v}`).join(' ')}`);
}
const gap = (found[0]?.win ?? 0) - (stocks[0]?.win ?? 0);
console.log(`\nBest found ${pct(found[0]?.win ?? 0)} (${found[0]?.label}) against best stock ${pct(stocks[0]?.win ?? 0)} (${stocks[0]?.label.slice(7)}): ${gap > 0 ? '+' : ''}${Math.round(gap * 100)} points.`);
if (gap >= 0.25) console.log('A plan the stock captains never try does much better here: worth a look, and maybe a new stock route.');
else if ((found[0]?.win ?? 0) < 0.1) console.log('Nothing found wins here either: this matchup looks hard for this hull, not just for the stock captains.');
console.log(`Replay the best: its route is ${JSON.stringify(found[0]?.route)}`);
