// Compares two runs of the same jobs file played on the same seeds (SEED=<n> for both), cell by cell.
//   node tools/balance/compare.mjs before.json after.json [min-change-in-points]
// Because run k of a cell faced the same luck both times, a fight that changed outcome changed because of
// the rules, not the dice. "flips" counts those fights: +n won that lost before, -n lost that won before.
// Prints only cells whose win rate moved by at least min-change points (default 1), biggest first.
import { readFileSync } from 'fs';
const [a, b, minArg] = process.argv.slice(2);
if (!a || !b) { console.error('usage: compare.mjs before.json after.json [min-change-in-points]'); process.exit(2); }
const load = (f) => new Map(JSON.parse(readFileSync(f, 'utf8')).map((c) => [c.label, c]));
const A = load(a), B = load(b), min = minArg != null ? +minArg : 1, rows = [];
let unpaired = 0, flipsUp = 0, flipsDown = 0, n = 0;
for (const [label, ca] of A) {
  const cb = B.get(label);
  if (!cb || !ca.runs || !cb.runs) continue;
  const bySeed = new Map(cb.runs.map((x) => [x.seed, x]));
  let up = 0, down = 0, pairs = 0;
  for (const x of ca.runs) {
    const y = bySeed.get(x.seed);
    if (!y) { unpaired++; continue; }
    pairs++; if (!x.win && y.win) up++; if (x.win && !y.win) down++;
  }
  const wa = ca.runs.filter((x) => x.win).length / ca.runs.length, wb = cb.runs.filter((x) => x.win).length / cb.runs.length;
  n += pairs; flipsUp += up; flipsDown += down;
  rows.push({ label, before: wa, after: wb, d: Math.round((wb - wa) * 100), up, down, pairs });
}
const moved = rows.filter((r) => Math.abs(r.d) >= min || r.up || r.down).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
const pct = (v) => String(Math.round(v * 100)).padStart(3) + '%';
for (const r of moved) console.log(`${r.label.padEnd(56)} ${pct(r.before)} -> ${pct(r.after)}  ${(r.d > 0 ? '+' : '') + r.d} pts  flips +${r.up} -${r.down} of ${r.pairs}`);
console.log(`\n${rows.length} cells, ${n} paired fights: ${flipsUp} now won, ${flipsDown} now lost, ${n - flipsUp - flipsDown} unchanged${unpaired ? ` · ${unpaired} fights had no partner (different SEED or run count?)` : ''}`);
if (!rows.length) console.log('no cells in common: were both files written by run.mjs from the same jobs file?');
