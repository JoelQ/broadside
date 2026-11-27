// Every hull against every other, one on one in open water, with many captains. It answers three questions about
// each hull: is she viable (can she beat each of the others some of the time), how much does skill matter in each
// matchup (the typical captain against the best one), and does she have an identity of her own (how she wins, at
// what range, how fast, with which plays, and how she is beaten)?
//   node tools/balance/matrix.mjs [--runs 20] [--hulls galliot,sloop,...] [--captains guns,hug,...] [--start usual|flipped] [--out out/matrix]
// The attacker (row) has a scripted captain at the helm; the defender (column) is the same kind of hull in good
// hands, fought by the game's own AI with a little chain and grape. Half of each pair's fights start the usual way
// (the defender upwind), half with the starts traded. Seeds SEED (default 1000) and up; DIALS works as with run.mjs.
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { play } from './play.mjs';
import { CAPTAINS, OARED } from './captains.mjs';

const args = process.argv.slice(2), flags = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
const VIABLE = 0.15; // a hull should beat each other hull at least this often, at best
const runs = +flags.runs || 20, starts = flags.start === 'usual' ? [false] : flags.start === 'flipped' ? [true] : [false, true];
const perStart = Math.ceil(runs / starts.length), seed = process.env.SEED != null ? +process.env.SEED : 1000;
const HULLS = (flags.hulls || 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(',');
const caps = (flags.captains || Object.keys(CAPTAINS).join(',')).split(',');
for (const c of caps) if (!CAPTAINS[c]) throw new Error(`no captain ${c}: ${Object.keys(CAPTAINS).join(', ')}`);
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const out = path.resolve(flags.out || 'out/matrix');
const capsFor = (a) => caps.filter((c) => !CAPTAINS[c].oared || OARED.includes(a));

const cells = [];
for (const cap of caps) for (const a of HULLS) for (const b of HULLS) if (capsFor(a).includes(cap)) for (const flip of starts) cells.push({ label: `${a} v ${b} | ${cap}${flip ? ' | flipped' : ''}`, duel: true, a, b, cap, flip, route: CAPTAINS[cap].route, dials: DIALS });
console.error(`${cells.length} cells x ${perStart} runs = ${cells.length * perStart} fights, about ${Math.ceil((cells.length * perStart) / 80 / 60)} min`);
const t0 = Date.now();
const results = await play(cells, perStart, { seed, story: 'lite' });
console.error(`${cells.length * perStart} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ---------- per cell ----------
const rate = (rs, f) => rs.filter(f).length / (rs.length || 1);
const byCell = new Map();
cells.forEach((c, i) => { const k = `${c.a}|${c.b}|${c.cap}`; byCell.set(k, [...(byCell.get(k) || []), ...results[i]]); });
const cellOf = (a, b, cap) => byCell.get(`${a}|${b}|${cap}`) || [];
const median = (xs) => { const s = [...xs].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const W = {}, B = {};
for (const a of HULLS) { W[a] = {}; B[a] = {}; for (const b of HULLS) {
  const all = capsFor(a).map((cap) => ({ cap, win: rate(cellOf(a, b, cap), (r) => r.win) })).sort((x, y) => y.win - x.win);
  // best: the ceiling with these captains; typical: the median captain, a fair stand-in for "a plan, not the plan";
  // breadth: how many of her captains win at least half their fights (how many ways she has to win here)
  W[a][b] = { cap: all[0].cap, win: all[0].win, typ: median(all.map((x) => x.win)), breadth: all.filter((x) => x.win >= 0.5).length, of: all.length, all };
  const bd = capsFor(a).filter((c) => CAPTAINS[c].board).map((cap) => ({ cap, v: rate(cellOf(a, b, cap), (r) => r.how === 'board'), over: rate(cellOf(a, b, cap), (r) => r.o === 'overrun') })).sort((x, y) => y.v - x.v)[0];
  B[a][b] = bd || { cap: '-', v: 0, over: 0 };
} }
// fair: each pair both ways round, so each hull has the scripted captain once and the game's AI once
const fair = (a, b, k = 'win') => (a === b ? W[a][b][k] : (W[a][b][k] + 1 - W[b][a][k]) / 2);
const others = (a) => HULLS.filter((b) => b !== a);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

// ---------- identity ----------
const CAUSES = ['round', 'chain', 'grape', 'fire', 'burning', 'boarding', 'other'];
function style(rs) { // what a set of fights looks like: how they were decided, at what range, how fast
  const n = rs.length || 1, cause = Object.fromEntries(CAUSES.map((c) => [c, 0]));
  for (const r of rs) { const sh = r.story?.share?.[r.win ? 'dealt' : 'taken']?.[r.story.decisive] || {}; for (const c of CAUSES) cause[c] += (sh[c] || 0) / n; }
  const ranged = rs.filter((r) => r.story?.hitRange != null), raked = rs.filter((r) => r.story?.rake != null);
  return { n: rs.length, cause, board: rate(rs, (r) => r.how === 'board'), rake: mean(raked.map((r) => r.story.rake)), range: mean(ranged.map((r) => r.story.hitRange)), t: median(rs.map((r) => r.t)),
    exposed: mean(rs.map((r) => (r.story?.arcs?.hers || 0) + (r.story?.arcs?.both || 0))) };
}
const ID = {};
for (const a of HULLS) {
  // at her best: the wins of her best captain against each other hull
  const wins = others(a).flatMap((b) => cellOf(a, b, W[a][b].cap).filter((r) => r.win));
  // her plays: in how many matchups each kind of fight is her best, or wins at least half the time
  const plays = {};
  for (const b of others(a)) for (const x of W[a][b].all) if (x.win >= 0.5 || x.cap === W[a][b].cap) { const p = CAPTAINS[x.cap].play; plays[p] = plays[p] || new Set(); plays[p].add(b); }
  // her weakness: how she is beaten when she defends, by every captain
  const beaten = others(a).flatMap((b) => capsFor(b).flatMap((cap) => cellOf(b, a, cap).filter((r) => r.win)));
  ID[a] = { at: style(wins), plays: Object.fromEntries(Object.entries(plays).map(([k, v]) => [k, [...v]]).sort((x, y) => y[1].length - x[1].length)), beaten: style(beaten),
    fair: mean(others(a).map((b) => fair(a, b))), fairTyp: mean(others(a).map((b) => fair(a, b, 'typ'))) };
}
// a fingerprint for each hull at her best, to find hulls that win the same way: the decisive causes, boarding,
// raking, range (per 200 yd), speed (per 200 s) and how long she spends under the enemy's guns
const finger = (a) => { const s = ID[a].at; return [...CAUSES.map((c) => s.cause[c]), s.rake, s.range / 200, s.t / 200, s.exposed]; };
const dist = (x, y) => Math.hypot(...finger(x).map((v, i) => v - finger(y)[i]));
for (const a of HULLS) { const near = others(a).map((b) => ({ b, d: dist(a, b) })).sort((x, y) => x.d - y.d)[0]; ID[a].nearest = near; }
const ALIKE = 0.2; // closer than this, two hulls win in much the same way

// ---------- print ----------
const pct = (x) => `${Math.round(x * 100)}%`, col = 11;
const table = (title, txt) => { console.log(`\n${title}`); console.log(''.padEnd(12) + HULLS.map((h) => h.slice(0, 10).padStart(col)).join('')); for (const a of HULLS) console.log(a.padEnd(12) + HULLS.map((b) => txt(a, b).padStart(col)).join('')); };
const letters = caps.map((c) => `${CAPTAINS[c].k} ${c}`).join(', ');
table(`VIABLE? fair chance of the row hull beating the column hull, each pair both ways round, best captains (! under ${pct(VIABLE)})`, (a, b) => `${a === b ? '' : fair(a, b) < VIABLE ? '!' : ''}${pct(fair(a, b))}`);
table(`SKILL: as attacker, typical captain > best captain (letter), against the game's AI (${letters})`, (a, b) => `${pct(W[a][b].typ)}>${pct(W[a][b].win)} ${CAPTAINS[W[a][b].cap].k}`);
table('CAPTURE: best boarding captain\'s share of fights ended by taking her / taken herself in the attempt', (a, b) => `${pct(B[a][b].v)}/${pct(B[a][b].over)}`);
const unviable = HULLS.flatMap((a) => others(a).filter((b) => fair(a, b) < VIABLE).map((b) => `${a} against ${b} ${pct(fair(a, b))}`));
console.log(unviable.length ? `\nNot viable (under ${pct(VIABLE)} at best): ${unviable.join(', ')}` : `\nEvery hull beats every other at least ${pct(VIABLE)} of the time at best.`);
const desc = (s) => `${CAUSES.filter((c) => s.cause[c] >= 0.1).sort((x, y) => s.cause[y] - s.cause[x]).map((c) => `${c} ${pct(s.cause[c])}`).join(', ') || '-'}; raking ${pct(s.rake)}; hits from ${Math.round(s.range)} yd; ${Math.round(s.t)} s`;
console.log('\nIDENTITY: fair score (typical captains on both sides / best on both: a big rise is a hull that rewards skill), how she wins at her best, her plays, how she is beaten, the hull she fights most like');
for (const a of [...HULLS].sort((x, y) => ID[y].fair - ID[x].fair)) {
  const I = ID[a];
  console.log(`\n  ${a}: fair ${pct(I.fairTyp)} / ${pct(I.fair)}`);
  console.log(`    wins by   ${desc(I.at)}`);
  console.log(`    plays     ${Object.entries(I.plays).map(([p, v]) => `${p} (${v.length})`).join(', ')}`);
  console.log(`    beaten by ${desc(I.beaten)}`);
  console.log(`    most like ${I.nearest.b} (${I.nearest.d.toFixed(2)}${I.nearest.d < ALIKE ? ', too alike' : ''})`);
}

// ---------- write ----------
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'data.json'), JSON.stringify({ hulls: HULLS, captains: caps, runs: perStart * starts.length, starts: starts.length, seed, win: W, capture: B, identity: ID,
  cells: cells.map((c, i) => ({ label: c.label, a: c.a, b: c.b, cap: c.cap, flip: !!c.flip, runs: results[i].map((r) => ({ k: r.k, seed: r.seed, win: !!r.win, o: r.o, how: r.how, t: r.t, cause: r.story?.cause })) })) }));
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const lo = [234, 243, 253], hi = [13, 61, 122], fill = (v) => `rgb(${lo.map((c, i) => Math.round(c + (hi[i] - c) * v)).join(',')})`;
const grid = (title, note, val, txt, tip, flag = () => false) => `<h2>${title}</h2><p class="note">${note}</p><table class="heat"><tr><th>row ↓ against column →</th>${HULLS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${HULLS.map((a) => `<tr><th>${esc(a)}</th>${HULLS.map((b) => { const v = val(a, b); return `<td style="background:${fill(v)};color:${v > 0.55 ? '#fff' : '#191919'}${flag(a, b) ? ';outline:3px solid #c0392b;outline-offset:-3px' : ''}" title="${esc(tip(a, b))}">${esc(txt(a, b))}</td>`; }).join('')}</tr>`).join('')}</table>`;
const capTip = (a, b) => `${a} v ${b}: ${W[a][b].all.map((x) => `${x.cap} ${pct(x.win)}`).join(', ')}`;
const bar = (s) => `<span class="bar">${CAUSES.filter((c) => s.cause[c] >= 0.02).map((c) => `<i class="c-${c}" style="width:${Math.round(s.cause[c] * 160)}px" title="${c} ${pct(s.cause[c])}"></i>`).join('')}</span>`;
const card = (a) => { const I = ID[a]; return `<div class="card"><h3>${esc(a)} <small>fair score ${pct(I.fairTyp)} with typical captains on both sides, ${pct(I.fair)} with the best</small></h3>
<p><b>Wins</b> ${bar(I.at)} ${esc(desc(I.at))}</p>
<p><b>Plays</b> ${Object.entries(I.plays).map(([p, v]) => `${esc(p)} <span class="note">(${v.map(esc).join(', ')})</span>`).join('; ')}</p>
<p><b>Beaten by</b> ${bar(I.beaten)} ${esc(desc(I.beaten))}</p>
<p class="note">Fights most like ${esc(I.nearest.b)} (distance ${I.nearest.d.toFixed(2)}${I.nearest.d < ALIKE ? ': <b>too alike</b>' : ''})</p></div>`; };
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hulls: viable, and distinct?</title>
<style>body{font:14px system-ui,sans-serif;color:#191919;background:#fff;margin:24px;max-width:1000px}h1{font-size:18px}h2{font-size:15px;margin-top:28px}h3{font-size:14px;margin:0 0 6px}h3 small{font-weight:400;color:#666}.note{color:#666}
table{border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;text-align:center;font-size:13px}th{font-weight:600}.heat td{border:2px solid #fff;min-width:64px}
.card{border:1px solid #ddd;border-radius:8px;padding:10px 14px;margin:10px 0}.card p{margin:4px 0}.bar{display:inline-flex;vertical-align:middle;margin-right:6px}.bar i{display:inline-block;height:10px}
.c-round{background:#2a6fb0}.c-chain{background:#8e6bb8}.c-grape{background:#d08a2e}.c-fire,.c-burning{background:#c0392b}.c-boarding{background:#2e8b57}.c-other{background:#999}.key i{display:inline-block;width:10px;height:10px;margin:0 3px 0 10px}</style>
<h1>Hulls: is each one viable, and does each have an identity?</h1>
<p class="note">Each hull (row) with a scripted captain against each hull (column) in good hands under the game's AI, one on one in open water. ${perStart * starts.length} fights per captain per pair${starts.length > 1 ? ', half from each start' : ''}, seeds from ${seed}. ${caps.length} captains: ${caps.map((c) => `<b>${CAPTAINS[c].k}</b> ${c}`).join(', ')}.</p>
${grid('Viable?', `The row hull's chance of beating the column hull with its best captain, each pair played both ways round (half the row hull's win as attacker, half its survival as defender), so each side has the scripted captain once. Outlined: under ${pct(VIABLE)}, where the row hull has no real way to win.`, (a, b) => fair(a, b), (a, b) => pct(fair(a, b)), capTip, (a, b) => a !== b && fair(a, b) < VIABLE)}
${grid('How much skill matters', 'As attacker against the game\'s AI: the typical captain (the median of all of hers) &gt; the best, and its letter. A big gap is a matchup with a high skill ceiling: one plan wins, most lose. Hover for every captain.', (a, b) => W[a][b].win, (a, b) => `${pct(W[a][b].typ)} > ${pct(W[a][b].win)} ${CAPTAINS[W[a][b].cap].k}`, capTip)}
<h2>Identity</h2><p class="note">At her best: the wins of her best captain against each other hull. <b>Wins</b> is what did the deciding damage <span class="key">${CAUSES.map((c) => `<i class="c-${c}"></i>${c}`).join('')}</span>, the share of her hull damage done raking, the range her hits came from and the median time to win. <b>Plays</b>: the kinds of fight that win her at least half her fights (or are her best) and against whom. <b>Beaten by</b>: the same for the fights she loses as defender. Two hulls closer than ${ALIKE} win in much the same way.</p>
${[...HULLS].sort((x, y) => ID[y].fair - ID[x].fair).map(card).join('')}
${grid('Capture', 'Best boarding captain: share of fights ended by taking her / taken herself in the attempt.', (a, b) => B[a][b].v, (a, b) => `${pct(B[a][b].v)} / ${pct(B[a][b].over)}`, (a, b) => `${a} v ${b}: best ${B[a][b].cap}`)}`;
writeFileSync(path.join(out, 'index.html'), html);
console.error(`wrote ${path.relative(process.cwd(), out)}/index.html`);
