// Plays the same seeded fights at every value of one tuning number (or every pair of values of two), and draws
// how the win rate of each hull moves with it. Built on cfg.dials (see README): no rebuild between values.
//   node tools/balance/sweep.mjs <jobs.mjs> <dial>=<values> [<dial>=<values>] [--runs 6] [--by hull] [--metric win]
//                                [--only <label-regex>] [--out out/sweep/<name>]
// values:  0.1,0.2,0.4      those values
//          0.1:0.5:0.1      a range, from:to:step
//          x0.5:x1.5:x0.25  multiples of the shipped number (x1 is the game as it ships); x0.5,x1,x2 works too
//          [[1,3],[2,4]]    a JSON list, for values that are lists
// --by      what one line is: a cell field such as hull, shipName, pirate, planName, routeName, legName, label
//           (default hull for campaign legs, shipName for skirmish fights); the other cells are averaged into it
// --metric  win (default) | board (won by boarding) | guns (won by gunfire) | t (seconds, mean)
// Every value plays run k of every cell on seed SEED + k (SEED defaults to 1000), so a fight that changes outcome
// between two values changed because of the number, not the dice. Writes index.html (the chart, a table and the
// cliffs: the cells that change most between neighbouring values) and data.json; prints the table.
import { mkdirSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';
import { play, shipped } from './play.mjs';

const args = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const [jobsFile, ...dialArgs] = pos;
if (!jobsFile || !dialArgs.length || dialArgs.length > 2) {
  console.error('usage: sweep.mjs <jobs.mjs> <dial>=<values> [<dial>=<values>] [--runs 6] [--by hull] [--metric win] [--only re] [--out dir]');
  process.exit(2);
}
const runs = +flags.runs || 6, seed = process.env.SEED != null ? +process.env.SEED : 1000, metric = flags.metric || 'win';

function parseValues(s) {
  if (s.startsWith('[')) return JSON.parse(s);
  const tok = (t) => (t.startsWith('x') ? { mul: +t.slice(1) } : +t);
  return s.split(',').flatMap((part) => {
    const r = part.split(':');
    if (r.length !== 3) return [tok(part)];
    const mul = r[0].startsWith('x'), [a, b, st] = r.map((t) => +t.replace(/^x/, '')), out = [];
    for (let v = a, n = 0; v <= b + st / 1e6 && n < 200; v = a + st * ++n) out.push(+v.toFixed(6));
    return out.map((v) => (mul ? { mul: v } : v));
  });
}
const dials = dialArgs.map((d) => { const i = d.indexOf('='); return { path: d.slice(0, i), values: parseValues(d.slice(i + 1)) }; });
const show = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? `x${v.mul ?? '+' + v.add}` : JSON.stringify(v));

let base = (await import(pathToFileURL(path.resolve(jobsFile)))).default;
if (flags.only) base = base.filter((c) => new RegExp(flags.only).test(c.label));
if (!base.length) { console.error('no cells to play'); process.exit(2); }
const by = flags.by || (base[0].mission ? 'hull' : 'shipName');
const groupOf = (c) => String(c[by] ?? c.label) + (c.fit && (by === 'hull' || by === 'shipName') ? '+' : '');

// every combination of values, each with every base cell
const combos = dials.length === 1 ? dials[0].values.map((v) => [v]) : dials[0].values.flatMap((a) => dials[1].values.map((b) => [a, b]));
const cells = combos.flatMap((vals, vi) => base.map((c, ci) => ({
  ...c, label: `${c.label} | ${vals.map((v, j) => `${dials[j].path}=${show(v)}`).join(' ')}`, vi, ci,
  dials: { ...(c.dials || {}), ...Object.fromEntries(vals.map((v, j) => [dials[j].path, v])) },
})));
const name = flags.name || dials.map((d) => d.path.replace(/[^\w.]+/g, '_')).join('+');
const out = path.resolve(flags.out || path.join('out/sweep', name));
const ship = await shipped(dials.map((d) => d.path), { dist: process.env.DIST });
console.error(`${dials.map((d, j) => `${d.path} (ships as ${JSON.stringify(ship[j])}): ${d.values.map(show).join(' ')}`).join('\n')}`);
console.error(`${base.length} cells x ${combos.length} values x ${runs} runs = ${cells.length * runs} fights, about ${Math.ceil((cells.length * runs) / 3 / 60)} min`);
const t0 = Date.now();
const results = await play(cells, runs, { seed, dist: process.env.DIST });

// one number per fight, then per cell, then per group
const score = (r) => (metric === 't' ? r.t : metric === 'board' ? +(r.how === 'board' || (r.win && !!r.boarded)) : metric === 'guns' ? +(r.how === 'guns' || (r.win && r.boarded === 0)) : +!!r.win);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const cellScore = cells.map((c, i) => mean(results[i].map(score)));
const groups = [...new Set(base.map(groupOf))];
const at = (ci, vi) => cells.findIndex((c) => c.ci === ci && c.vi === vi);
const table = groups.map((g) => ({ g, v: combos.map((_, vi) => mean(base.map((c, ci) => (groupOf(c) === g ? cellScore[at(ci, vi)] : NaN)).filter((x) => !Number.isNaN(x)))) }));
const fmt = (x) => (Number.isNaN(x) ? '  -' : metric === 't' ? String(Math.round(x)).padStart(4) : String(Math.round(x * 100)).padStart(3) + '%');

// cliffs: the cells whose fights change most between neighbouring values (1D), with the fights that flipped
const cliffs = [];
if (dials.length === 1) for (const [ci, c] of base.entries()) for (let vi = 0; vi + 1 < combos.length; vi++) {
  const a = results[at(ci, vi)], b = results[at(ci, vi + 1)];
  let up = 0, down = 0;
  for (const x of a) { const y = b.find((q) => q.k === x.k); if (y && !x.win && y.win) up++; if (y && x.win && !y.win) down++; }
  cliffs.push({ label: c.label, from: show(combos[vi][0]), to: show(combos[vi + 1][0]), d: cellScore[at(ci, vi + 1)] - cellScore[at(ci, vi)], up, down });
}
cliffs.sort((x, y) => Math.abs(y.d) - Math.abs(x.d) || y.up + y.down - x.up - x.down);
const topCliffs = cliffs.filter((x) => x.up || x.down).slice(0, 12);

// print
const w = Math.max(8, ...groups.map((g) => g.length));
if (dials.length === 1) {
  console.log(`${metric} by ${by} as ${dials[0].path} goes ${combos.map((v) => show(v[0])).join(' ')}  (ships as ${JSON.stringify(ship[0])})\n`);
  console.log(''.padEnd(w) + combos.map((v) => show(v[0]).padStart(9)).join(''));
  for (const r of table) console.log(r.g.padEnd(w) + r.v.map((x) => fmt(x).padStart(9)).join(''));
  if (topCliffs.length) {
    console.log('\nCliffs: the cells that change most between neighbouring values (fights that flipped: + now won, - now lost)');
    for (const x of topCliffs) console.log(`  ${x.label.padEnd(50)} ${x.from} -> ${x.to}  ${x.d > 0 ? '+' : ''}${Math.round(x.d * 100)} pts  +${x.up} -${x.down}`);
  }
} else {
  const [A, B] = dials;
  for (const r of table) {
    console.log(`\n${r.g}: ${metric}, ${B.path} down, ${A.path} across`);
    console.log(''.padEnd(10) + A.values.map((v) => show(v).padStart(9)).join(''));
    for (const [bi, bv] of B.values.entries()) console.log(show(bv).padEnd(10) + A.values.map((_, ai) => fmt(r.v[ai * B.values.length + bi]).padStart(9)).join(''));
  }
}
console.error(`${cells.length * runs} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// write
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'data.json'), JSON.stringify({ dials: dials.map((d, j) => ({ ...d, shipped: ship[j] })), by, metric, runs, seed, groups: table, combos,
  cells: cells.map((c, i) => ({ label: c.label, group: groupOf(c), vals: combos[c.vi], score: cellScore[i], runs: results[i].map((r) => ({ k: r.k, seed: r.seed, win: !!r.win, o: r.o, t: r.t })) })), cliffs: topCliffs }));
writeFileSync(path.join(out, 'index.html'), page());
console.error(`wrote ${path.relative(process.cwd(), out)}/index.html`);

function page() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const SERIES = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'];
  const yMax = metric === 't' ? Math.max(60, ...table.flatMap((r) => r.v.filter((x) => !Number.isNaN(x)))) * 1.1 : 1;
  const yLabel = (y) => (metric === 't' ? `${Math.round(y)}s` : `${Math.round(y * 100)}%`);
  const title = `${{ win: 'Win rate', board: 'Won by boarding', guns: 'Won by gunfire', t: 'Fight length' }[metric]} by ${by} as ${dials.map((d) => d.path).join(' and ')} changes`;
  let body = '';
  if (dials.length === 1) {
    const W = 760, H = 380, L = 56, R = 120, T = 16, Bm = 44, n = combos.length;
    const x = (i) => L + (n === 1 ? 0 : (i * (W - L - R)) / (n - 1)), y = (v) => T + (1 - v / yMax) * (H - T - Bm);
    const shippedIdx = combos.findIndex(([v]) => (typeof v === 'object' && !Array.isArray(v) ? v.mul === 1 && v.add == null : JSON.stringify(v) === JSON.stringify(ship[0])));
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(title)}">`;
    for (let k = 0; k <= 4; k++) { const v = (yMax * k) / 4; svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${yLabel(v)}</text>`; }
    for (let i = 0; i < n; i++) svg += `<text x="${x(i)}" y="${H - Bm + 18}" text-anchor="middle" class="ax">${esc(show(combos[i][0]))}</text>`;
    svg += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="ax">${esc(dials[0].path)}</text>`;
    if (shippedIdx >= 0) svg += `<line x1="${x(shippedIdx)}" x2="${x(shippedIdx)}" y1="${T}" y2="${H - Bm}" class="ship"/><text x="${x(shippedIdx) + 4}" y="${T + 10}" class="ax">as shipped</text>`;
    const ends = [];
    table.slice(0, 8).forEach((r, gi) => {
      const pts = r.v.map((v, i) => [x(i), y(v), v]).filter((p) => !Number.isNaN(p[2]));
      svg += `<polyline fill="none" stroke="${SERIES[gi]}" stroke-width="2" points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}"/>`;
      for (const [px, py, v] of pts) svg += `<circle cx="${px}" cy="${py}" r="4.5" fill="${SERIES[gi]}" stroke="#fff" stroke-width="2"><title>${esc(r.g)}: ${yLabel(v)}</title></circle>`;
      if (pts.length) ends.push({ g: r.g, y: pts[pts.length - 1][1], x: pts[pts.length - 1][0], c: SERIES[gi] });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14); // keep end labels apart
    for (const e of ends) svg += `<text x="${e.x + 10}" y="${e.y + 4}" class="lab">${esc(e.g)}</text>`;
    svg += '</svg>';
    const legend = table.slice(0, 8).map((r, gi) => `<span><i style="background:${SERIES[gi]}"></i>${esc(r.g)}</span>`).join('');
    body += `<div class="legend">${legend}</div>${svg}${table.length > 8 ? `<p class="note">${table.length - 8} more lines are in the table only; use --by for fewer.</p>` : ''}`;
    body += `<table><tr><th>${esc(by)}</th>${combos.map((v) => `<th>${esc(show(v[0]))}</th>`).join('')}</tr>${table.map((r) => `<tr><td>${esc(r.g)}</td>${r.v.map((v) => `<td>${Number.isNaN(v) ? '-' : yLabel(v)}</td>`).join('')}</tr>`).join('')}</table>`;
    if (topCliffs.length) body += `<h2>Cliffs</h2><p class="note">The cells that change most between neighbouring values. Flips are fights on the same seed that went the other way: + now won, − now lost. Replay one with <code>replay.mjs</code> and its seed.</p><table><tr><th>cell</th><th>between</th><th>change</th><th>flips</th></tr>${topCliffs.map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.from)} → ${esc(c.to)}</td><td>${c.d > 0 ? '+' : ''}${Math.round(c.d * 100)} pts</td><td>+${c.up} −${c.down}</td></tr>`).join('')}</table>`;
  } else {
    const [A, B] = dials, lerp = (a, b, t) => Math.round(a + (b - a) * t), lo = [234, 243, 253], hi = [13, 61, 122];
    const fill = (v) => { const t = Math.max(0, Math.min(1, v / yMax)); return `rgb(${lo.map((c, i) => lerp(c, hi[i], t)).join(',')})`; };
    for (const r of table) {
      body += `<h2>${esc(r.g)}</h2><table class="heat"><tr><th>${esc(B.path)} ↓ ${esc(A.path)} →</th>${A.values.map((v) => `<th>${esc(show(v))}</th>`).join('')}</tr>`;
      for (const [bi, bv] of B.values.entries()) body += `<tr><th>${esc(show(bv))}</th>${A.values.map((_, ai) => { const v = r.v[ai * B.values.length + bi]; return `<td style="background:${fill(v)};color:${v / yMax > 0.55 ? '#fff' : '#191919'}">${Number.isNaN(v) ? '-' : yLabel(v)}</td>`; }).join('')}</tr>`;
      body += '</table>';
    }
  }
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:14px system-ui,sans-serif;color:#191919;background:#fff;margin:24px;max-width:900px}h1{font-size:18px}h2{font-size:15px;margin-top:28px}
.note{color:#666}.grid{stroke:#e6e6e6}.ship{stroke:#999;stroke-dasharray:4 4}.ax{fill:#666;font-size:12px}.lab{fill:#191919;font-size:12px}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
table{border-collapse:collapse;margin-top:16px}td,th{padding:4px 10px;border-bottom:1px solid #eee;text-align:right}td:first-child,th:first-child{text-align:left}
.heat td{text-align:center;min-width:52px;border:2px solid #fff}code{background:#f4f4f4;padding:1px 4px}</style>
<h1>${esc(title)}</h1>
<p class="note">${base.length} cells${flags.only ? ` matching /${esc(flags.only)}/` : ''} from ${esc(path.basename(jobsFile))}, ${runs} runs each on seeds ${seed} to ${seed + runs - 1} at every value. ${dials.map((d, j) => `${esc(d.path)} ships as ${esc(JSON.stringify(ship[j]))}.`).join(' ')}</p>
${body}`;
}
