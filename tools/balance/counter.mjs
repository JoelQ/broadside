// Plan against plan: every hull against every other with a scripted captain on BOTH sides, every plan against every
// plan, scored as a game. The hull matrix (matrix.mjs) puts the game's own AI on the defending side, a single plan that
// never answers anything, so a tactic that beats the AI can look like a sure win when a captain who saw it coming
// would counter it (a great ship that opens with chain before a sloop gets under her stern). This finds those.
//   node tools/balance/counter.mjs [--runs 10] [--hulls sloop,flagship,...] [--captains guns,hug,...] [--out out/counter]
// For each pair: every plan of hers against every plan of the other's, half from each start, both with full shot
// lockers. The value of the pair is her chance of winning when both captains choose well, knowing the other may
// counter (the value of the zero-sum game, mixed plans allowed); her best mix and the other's answer are what get
// there. Each pair is also played with her plans against the game's AI, to show what the matrix would have said, and
// any plan that beats the AI but has a counter is listed with that counter. Timeouts count half. Seeds SEED (default
// 1000) and up; DIALS works as with run.mjs.
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { play } from './play.mjs';
import { CAPTAINS, OARED } from './captains.mjs';

const args = process.argv.slice(2), flags = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
const POOL = 'guns,wary,weather,kite,hug,hugWary,shadow,shadowFire,burn,chainOpen,chainHug,prep,prepWary,hugBoard,grapeBoard,rush,bow,bowWeather';
const caps = (flags.captains || POOL).split(',');
for (const c of caps) if (!CAPTAINS[c]) throw new Error(`no captain ${c}: ${Object.keys(CAPTAINS).join(', ')}`);
const HULLS = (flags.hulls || 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(',');
const runs = +flags.runs || 10, perStart = Math.ceil(runs / 2), seed = process.env.SEED != null ? +process.env.SEED : 1000;
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const out = path.resolve(flags.out || 'out/counter');
const FULL = { chain: 8, grape: 8, fire: 5 }; // what the attacker carries: the defender gets the same, so the game is even
const capsFor = (h) => caps.filter((c) => !CAPTAINS[c].oared || OARED.includes(h));
// every ordered pair: the side with the player's helm has an edge (she grapples at once and her swivel is heavier, so
// a boarding goes to whoever attacks), and playing each pair both ways round cancels it
const pairs = []; for (const a of HULLS) for (const b of HULLS) pairs.push([a, b]);

const cells = [];
for (const [a, b] of pairs) for (const ca of capsFor(a)) {
  for (const cb of capsFor(b)) for (const flip of [false, true]) cells.push({ label: `${a} ${ca} v ${b} ${cb}${flip ? ' | flipped' : ''}`, duel: true, a, b, ca, cb, flip, route: CAPTAINS[ca].route, foeRoute: CAPTAINS[cb].route, foeStock: FULL, dials: DIALS });
}
// the matrix's view, for comparison: each side's plans against the other hull under the game's AI
for (const [x, y] of pairs) for (const cx of capsFor(x)) for (const flip of [false, true]) cells.push({ label: `${x} ${cx} v ${y} AI${flip ? ' | flipped' : ''}`, duel: true, a: x, b: y, ca: cx, cb: 'AI', flip, route: CAPTAINS[cx].route, dials: DIALS });
console.error(`${cells.length} cells x ${perStart} runs = ${cells.length * perStart} fights, about ${Math.ceil((cells.length * perStart) / 80 / 60)} min`);
const t0 = Date.now();
const results = await play(cells, perStart, { seed });
console.error(`${cells.length * perStart} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const score = (r) => (r.win ? 1 : r.o === 'timeout' ? 0.5 : 0);
const acc = new Map();
cells.forEach((c, i) => { const k = `${c.a}|${c.ca}|${c.b}|${c.cb}`; const e = acc.get(k) || [0, 0]; for (const r of results[i]) { e[0] += score(r); e[1]++; } acc.set(k, e); });
const P = (a, ca, b, cb) => { const e = acc.get(`${a}|${ca}|${b}|${cb}`); return e ? e[0] / e[1] : null; };

// the value of a zero-sum game (rows maximise) by regret matching: the average strategies converge on the optimum
function solve(M) {
  const n = M.length, m = M[0].length, rx = new Array(n).fill(0), ry = new Array(m).fill(0), sx = new Array(n).fill(0), sy = new Array(m).fill(0);
  const strat = (r) => { const pos = r.map((v) => Math.max(0, v)), t = pos.reduce((s, v) => s + v, 0); return t > 0 ? pos.map((v) => v / t) : r.map(() => 1 / r.length); };
  for (let it = 0; it < 4000; it++) {
    const x = strat(rx), y = strat(ry);
    const rowU = M.map((row) => row.reduce((s, v, j) => s + v * y[j], 0)), u = rowU.reduce((s, v, i) => s + v * x[i], 0);
    const colU = M[0].map((_, j) => M.reduce((s, row, i) => s + row[j] * x[i], 0));
    for (let i = 0; i < n; i++) { rx[i] += rowU[i] - u; sx[i] += x[i]; }
    for (let j = 0; j < m; j++) { ry[j] += u - colU[j]; sy[j] += y[j]; } // the column player wants it low
  }
  const x = sx.map((v) => v / 4000), y = sy.map((v) => v / 4000);
  return { x, y, v: M.reduce((s, row, i) => s + x[i] * row.reduce((q, val, j) => q + val * y[j], 0), 0) };
}

const G = {}, R = {}; // R[a][b]: the game with her attacking; G[a][b]: both ways round, her side
for (const [a, b] of pairs) {
  const A = capsFor(a), B = capsFor(b);
  const M = A.map((ca) => B.map((cb) => P(a, ca, b, cb)));
  const g = solve(M);
  const mix = (names, w) => names.map((n, i) => [n, w[i]]).filter(([, v]) => v >= 0.08).sort((p, q) => q[1] - p[1]);
  const mean = M.flat().reduce((s, v) => s + v, 0) / M.flat().length;
  // plans that beat the AI but have an answer
  const hidden = (x, X, y, Y, Mx) => X.map((cx, i) => { const vsAI = P(x, cx, y, 'AI'), row = Mx(i), k = row.indexOf(Math.min(...row)); return { plan: cx, vsAI, worst: row[k], counter: Y[k] }; })
    .filter((h) => h.vsAI >= 0.6 && h.worst <= h.vsAI - 0.3).sort((p, q) => q.vsAI - p.vsAI);
  const bestAI = (x, X, y) => X.map((cx) => ({ plan: cx, v: P(x, cx, y, 'AI') })).sort((p, q) => q.v - p.v)[0];
  R[a] = R[a] || {};
  R[a][b] = { v: g.v, mine: mix(A, g.x), theirs: mix(B, g.y), mean, vsAI: bestAI(a, A, b), hidden: hidden(a, A, b, B, (i) => M[i]) };
}
for (const a of HULLS) { G[a] = {}; for (const b of HULLS) G[a][b] = { ...R[a][b], v: a === b ? 0.5 : (R[a][b].v + 1 - R[b][a].v) / 2, mean: a === b ? 0.5 : (R[a][b].mean + 1 - R[b][a].mean) / 2, attacking: R[a][b].v, defending: 1 - R[b][a].v }; }
const edge = HULLS.reduce((s, h) => s + R[h][h].v, 0) / HULLS.length; // a hull against herself: how much attacking is worth
const pct = (x) => `${Math.round(x * 100)}%`, col = 11;
const table = (title, txt) => { console.log(`\n${title}`); console.log(''.padEnd(12) + HULLS.map((h) => h.slice(0, 10).padStart(col)).join('')); for (const a of HULLS) console.log(a.padEnd(12) + HULLS.map((b) => txt(a, b).padStart(col)).join('')); };
table('GAME: the row hull\'s chance of beating the column hull when both captains choose well (her plans against hers, mixed), each pair both ways round', (a, b) => (a === b ? '-' : pct(G[a][b].v)));
console.log(`\nMirror check: a hull attacking herself wins ${pct(edge)} on average (${HULLS.map((h) => `${h} ${pct(R[h][h].v)}`).join(', ')}): the attacker's edge, cancelled above by playing both ways round.`);
table('AGAINST THE AI: the row hull\'s best plan against the column hull under the game\'s AI (what the matrix sees)', (a, b) => pct(G[a][b].vsAI.v));
table('TYPICAL: the average over every plan against every plan, both ways round (a big gap to GAME is a matchup that rewards choosing well)', (a, b) => (a === b ? '-' : pct(G[a][b].mean)));
const others = (a) => HULLS.filter((b) => b !== a);
console.log('\nFair score (game value against the others, on average) and the plans she leans on');
for (const a of [...HULLS].sort((x, y) => others(y).reduce((s, b) => s + G[y][b].v, 0) - others(x).reduce((s, b) => s + G[x][b].v, 0))) {
  const uses = {}; for (const b of others(a)) for (const [c, w] of G[a][b].mine) uses[c] = (uses[c] || 0) + w / others(a).length;
  console.log(`  ${a.padEnd(12)} ${pct(others(a).reduce((s, b) => s + G[a][b].v, 0) / others(a).length).padStart(4)}   ${Object.entries(uses).sort((p, q) => q[1] - p[1]).slice(0, 5).map(([c, w]) => `${c} ${pct(w)}`).join(', ')}`);
}
console.log('\nHidden counters: plans that beat the AI at least 60% of the time, and the answer that takes 30 points or more off them');
for (const a of HULLS) for (const b of others(a)) for (const h of G[a][b].hidden.slice(0, 2)) console.log(`  ${a} against ${b}: ${h.plan} beats the AI ${pct(h.vsAI)}, but ${b} answering with ${h.counter} holds it to ${pct(h.worst)}`);

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'data.json'), JSON.stringify({ hulls: HULLS, captains: caps, runs: perStart * 2, seed, game: G, attacking: R, mirror: edge, plans: Object.fromEntries([...acc].map(([k, [s, n]]) => [k, +(s / n).toFixed(3)])) }));
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const lo = [234, 243, 253], hi = [13, 61, 122], fill = (v) => `rgb(${lo.map((c, i) => Math.round(c + (hi[i] - c) * v)).join(',')})`;
const mixTxt = (m) => m.map(([c, w]) => `${c} ${pct(w)}`).join(', ');
const grid = (title, note, val) => `<h2>${title}</h2><p class="note">${note}</p><table class="heat"><tr><th>row ↓ against column →</th>${HULLS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${HULLS.map((a) => `<tr><th>${esc(a)}</th>${HULLS.map((b) => { const v = val(a, b); return `<td style="background:${fill(v)};color:${v > 0.55 ? '#fff' : '#191919'}" title="${esc(`${a} v ${b}: plays ${mixTxt(G[a][b].mine)}; ${b} answers ${mixTxt(G[a][b].theirs)}. Against the AI: ${G[a][b].vsAI.plan} ${pct(G[a][b].vsAI.v)}`)}">${pct(v)}</td>`; }).join('')}</tr>`).join('')}</table>`;
const pairCard = (a, b) => { const g = G[a][b]; return `<tr><td>${esc(a)} v ${esc(b)}</td><td><b>${pct(g.v)}</b></td><td>${pct(g.vsAI.v)} <span class="note">${esc(g.vsAI.plan)}</span></td><td>${pct(g.mean)}</td><td>${esc(mixTxt(g.mine))}</td><td>${esc(mixTxt(g.theirs))}</td><td>${g.hidden.map((h) => `${esc(h.plan)} ${pct(h.vsAI)} → ${pct(h.worst)} against ${esc(h.counter)}`).join('<br>')}</td></tr>`; };
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plan against plan</title>
<style>body{font:14px system-ui,sans-serif;color:#191919;background:#fff;margin:24px;max-width:1100px}h1{font-size:18px}h2{font-size:15px;margin-top:28px}.note{color:#666}
table{border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;font-size:13px;text-align:left;vertical-align:top}.heat td,.heat th{text-align:center}.heat td{border:2px solid #fff;min-width:64px}.pairs td{border-bottom:1px solid #eee}</style>
<h1>Plan against plan: counterplay between hulls</h1>
<p class="note">Every hull against every other with a scripted captain on both sides, both with full shot lockers. ${perStart * 2} fights per plan against plan, half from each start, seeds from ${seed}. Plans: ${caps.map(esc).join(', ')}. Timeouts count half.</p>
${grid('Both captains choose well', `The row hull's chance of winning when both sides pick their plans knowing the other may counter (the value of the game, mixed plans allowed), each pair played both ways round. Hover for the plans. On the diagonal, a hull attacking herself: ${pct(edge)} on average, which is what attacking is worth (her grapples bite at once and her swivel is heavier) and what playing both ways round cancels.`, (a, b) => (a === b ? R[a][a].v : G[a][b].v))}
${grid('Against the AI (what the hull matrix sees)', 'The row hull\'s best plan against the column hull sailed by the game\'s own AI, which never counters.', (a, b) => G[a][b].vsAI.v)}
<h2>Every pair</h2><p class="note">Game value; best against the AI; typical (every plan against every plan); her mix; their answer; plans that beat the AI but are countered (win against the AI → worst against a counter).</p>
<table class="pairs"><tr><th>pair</th><th>game</th><th>v AI</th><th>typical</th><th>her plans</th><th>their answer</th><th>hidden counters</th></tr>${HULLS.flatMap((a) => others(a).map((b) => pairCard(a, b))).join('')}</table>`;
writeFileSync(path.join(out, 'index.html'), html);
console.error(`wrote ${path.relative(process.cwd(), out)}/index.html`);
