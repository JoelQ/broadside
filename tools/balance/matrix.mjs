// Every hull against every other, one on one in open water, with several captains: who beats whom, by guns or by
// boarding, and is any hull simply worse than another?
//   node tools/balance/matrix.mjs [--runs 4] [--hulls galliot,sloop,...] [--captains guns,hug,...] [--out out/matrix]
// The attacker (row) has a scripted captain at the helm; the defender (column) is the same kind of hull in good
// hands, fought by the game's own AI with a little chain and grape. For each pair the best captain counts, so a
// cell reads "the best this hull can do against that one with these captains". Seeds SEED (default 1000) and up;
// DIALS and STORY work as with run.mjs.
// Prints and draws: the win matrix (best captain, with its letter), the capture matrix (best boarding captain),
// how often each captain is the best, and dominance: a hull whose every result is no better than another's.
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { play } from './play.mjs';

const args = process.argv.slice(2), flags = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
const CAPTAINS = {
  guns: { k: 'g', route: [{ kill: 'all', move: 'duel', ammo: 'round' }] },
  kite: { k: 'k', route: [{ kill: 'all', move: 'kite', ammo: 'round' }] },
  hug: { k: 'h', route: [{ kill: 'all', move: 'hug', ammo: 'round' }] },
  burn: { k: 'f', route: [{ kill: 'all', move: 'duel', ammo: 'fire' }] },
  prep: { k: 'p', board: true, route: [{ kill: 'all', move: 'duel', ammo: 'combo', board: 'odds' }] },
  hugBoard: { k: 'b', board: true, route: [{ kill: 'all', move: 'hug', ammo: 'combo', board: 'odds' }] },
  rush: { k: 'r', board: true, route: [{ kill: 'all', move: 'duel', ammo: 'grape', board: 'rush' }] },
};
const runs = +flags.runs || 4, seed = process.env.SEED != null ? +process.env.SEED : 1000;
const HULLS = (flags.hulls || 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(',');
const caps = (flags.captains || Object.keys(CAPTAINS).join(',')).split(',');
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const out = path.resolve(flags.out || 'out/matrix');

const cells = [];
for (const cap of caps) for (const a of HULLS) for (const b of HULLS) cells.push({ label: `${a} v ${b} | ${cap}`, duel: true, a, b, cap, route: CAPTAINS[cap].route, dials: DIALS });
console.error(`${cells.length} cells x ${runs} runs = ${cells.length * runs} fights, about ${Math.ceil((cells.length * runs) / 3.5 / 60)} min`);
const t0 = Date.now();
const results = await play(cells, runs, { seed, story: !!process.env.STORY });
console.error(`${cells.length * runs} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const rate = (rs, f) => rs.filter(f).length / (rs.length || 1);
const cellOf = (a, b, cap) => results[cells.findIndex((c) => c.a === a && c.b === b && c.cap === cap)];
const best = (a, b, list) => list.map((cap) => ({ cap, win: rate(cellOf(a, b, cap), (r) => r.win), board: rate(cellOf(a, b, cap), (r) => r.how === 'board') })).sort((x, y) => y.win - x.win)[0];
const bestBoard = (a, b) => caps.filter((c) => CAPTAINS[c].board).map((cap) => ({ cap, v: rate(cellOf(a, b, cap), (r) => r.how === 'board'), over: rate(cellOf(a, b, cap), (r) => r.o === 'overrun') })).sort((x, y) => y.v - x.v)[0];
const W = Object.fromEntries(HULLS.map((a) => [a, Object.fromEntries(HULLS.map((b) => [b, best(a, b, caps)]))]));
const B = Object.fromEntries(HULLS.map((a) => [a, Object.fromEntries(HULLS.map((b) => [b, bestBoard(a, b)]))]));
const pct = (x) => `${Math.round(x * 100)}%`;

// print
const col = 11;
console.log(`\nWIN: best captain's win rate, attacker down, defender across (letter = captain: ${caps.map((c) => `${CAPTAINS[c].k} ${c}`).join(', ')})`);
console.log(''.padEnd(12) + HULLS.map((h) => h.slice(0, 10).padStart(col)).join(''));
for (const a of HULLS) console.log(a.padEnd(12) + HULLS.map((b) => `${pct(W[a][b].win)} ${CAPTAINS[W[a][b].cap].k}`.padStart(col)).join(''));
if (caps.some((c) => CAPTAINS[c].board)) {
  console.log('\nCAPTURE: best boarding captain\'s share of fights ended by taking her (overrun = taken herself in the attempt)');
  console.log(''.padEnd(12) + HULLS.map((h) => h.slice(0, 10).padStart(col)).join(''));
  for (const a of HULLS) console.log(a.padEnd(12) + HULLS.map((b) => `${pct(B[a][b].v)}/${pct(B[a][b].over)}`.padStart(col)).join(''));
}
const tally = {};
for (const a of HULLS) for (const b of HULLS) if (W[a][b].win > 0) tally[W[a][b].cap] = (tally[W[a][b].cap] || 0) + 1;
console.log(`\nBest captain, over the ${HULLS.length ** 2} pairs it wins any of: ${Object.entries(tally).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', ')}`);
// dominance: x is dominated by y if y does at least as well as x against every defender, and x does at least as
// well as y against y's... i.e. y's row >= x's row everywhere and y is no easier to beat (column) than x
const dominated = [];
for (const x of HULLS) for (const y of HULLS) if (x !== y) {
  const row = HULLS.every((z) => W[y][z].win >= W[x][z].win), colm = HULLS.every((z) => W[z][y].win <= W[z][x].win);
  const strict = HULLS.some((z) => W[y][z].win > W[x][z].win || W[z][y].win < W[z][x].win);
  if (row && colm && strict) dominated.push([x, y]);
}
console.log(dominated.length ? `\nDominated: ${dominated.map(([x, y]) => `${x} by ${y}`).join(', ')} (does no better against anyone, and is no harder to beat)` : '\nNo hull is dominated by another.');
const offense = HULLS.map((a) => ({ a, v: HULLS.reduce((s, b) => s + W[a][b].win, 0) / HULLS.length, d: HULLS.reduce((s, b) => s + W[b][a].win, 0) / HULLS.length }));
console.log('\nOn average: wins as attacker / beaten as defender');
for (const o of offense) console.log(`  ${o.a.padEnd(12)} ${pct(o.v).padStart(4)} / ${pct(o.d).padStart(4)}`);

// write
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'data.json'), JSON.stringify({ hulls: HULLS, captains: caps, runs, seed, win: W, capture: B, dominated, cells: cells.map((c, i) => ({ label: c.label, a: c.a, b: c.b, cap: c.cap, runs: results[i].map((r) => ({ k: r.k, seed: r.seed, win: !!r.win, o: r.o, how: r.how, t: r.t })) })) }));
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const lo = [234, 243, 253], hi = [13, 61, 122], fill = (v) => `rgb(${lo.map((c, i) => Math.round(c + (hi[i] - c) * v)).join(',')})`;
const grid = (title, note, val, txt, tip) => `<h2>${title}</h2><p class="note">${note}</p><table class="heat"><tr><th>attacker ↓ defender →</th>${HULLS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${HULLS.map((a) => `<tr><th>${esc(a)}</th>${HULLS.map((b) => { const v = val(a, b); return `<td style="background:${fill(v)};color:${v > 0.55 ? '#fff' : '#191919'}" title="${esc(tip(a, b))}">${esc(txt(a, b))}</td>`; }).join('')}</tr>`).join('')}</table>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hull matchups</title>
<style>body{font:14px system-ui,sans-serif;color:#191919;background:#fff;margin:24px;max-width:960px}h1{font-size:18px}h2{font-size:15px;margin-top:28px}.note{color:#666}
table{border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;text-align:center;font-size:13px}th{font-weight:600}.heat td{border:2px solid #fff;min-width:64px}ul{padding-left:18px}</style>
<h1>Hull matchups: who beats whom</h1>
<p class="note">Each hull (row) with a scripted captain against each hull (column) in good hands under the game's AI, one on one in open water. ${runs} fights per captain per pair on seeds ${seed} to ${seed + runs - 1}; a cell keeps the best captain. Captains: ${caps.map((c) => `<b>${CAPTAINS[c].k}</b> ${c}`).join(', ')}.</p>
${grid('Win rate, best captain', 'The letter is the captain that did best.', (a, b) => W[a][b].win, (a, b) => `${pct(W[a][b].win)} ${CAPTAINS[W[a][b].cap].k}`, (a, b) => `${a} v ${b}: ${caps.map((c) => `${c} ${pct(rate(cellOf(a, b, c), (r) => r.win))}`).join(', ')}`)}
${caps.some((c) => CAPTAINS[c].board) ? grid('Capture, best boarding captain', 'Share of fights ended by taking her. After the slash: taken herself in the attempt.', (a, b) => B[a][b].v, (a, b) => `${pct(B[a][b].v)} / ${pct(B[a][b].over)}`, (a, b) => `${a} v ${b}: best ${B[a][b].cap}`) : ''}
<h2>Dominance</h2><p>${dominated.length ? `<ul>${dominated.map(([x, y]) => `<li>${esc(x)} is dominated by ${esc(y)}: no better against anyone, and no harder to beat.</li>`).join('')}</ul>` : 'No hull is dominated by another.'}</p>
<h2>On average</h2><table><tr><th>hull</th><th>wins as attacker</th><th>beaten as defender</th></tr>${offense.map((o) => `<tr><td>${esc(o.a)}</td><td>${pct(o.v)}</td><td>${pct(o.d)}</td></tr>`).join('')}</table>`;
writeFileSync(path.join(out, 'index.html'), html);
console.error(`wrote ${path.relative(process.cwd(), out)}/index.html`);
