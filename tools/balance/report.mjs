// Turns a grid result file into the tables that answer the balance questions.
//   node tools/balance/report.mjs <out.json>
import { readFileSync } from 'fs';
import { PLANS, PIRATES } from './grid.mjs';
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const pct = (x) => String(Math.round(x * 100)).padStart(3) + '%';
const ships = [...new Set(rows.map((r) => r.shipName))], plans = Object.keys(PLANS);
const cell = (s, f, p, l) => rows.find((r) => r.shipName === s && !!r.fit === f && r.planName === p && r.pirate === l);
for (const fit of [false, true]) {
  console.log(`\n=== WIN RATE by strategy, ${fit ? 'FULLY FITTED' : 'STOCK'} (g = some wins by guns, b = some by boarding) ===`);
  for (const s of ships) {
    console.log(`\n${s.toUpperCase()}${fit ? ' (fitted)' : ''}`.padEnd(22) + PIRATES.map((p) => p.padStart(10)).join(''));
    for (const p of plans) console.log('  ' + p.padEnd(20) + PIRATES.map((l) => { const c = cell(s, fit, p, l); return c ? (pct(c.win) + (c.guns ? 'g' : ' ') + (c.board ? 'b' : ' ')).padStart(10) : '        - '; }).join(''));
    const best = PIRATES.map((l) => plans.map((p) => cell(s, fit, p, l)).filter(Boolean).sort((a, b) => b.win - a.win)[0]);
    console.log('  ' + 'BEST'.padEnd(20) + best.map((c) => pct(c.win).padStart(8) + '  ').join(''));
    console.log('  ' + ''.padEnd(20) + best.map((c) => c.planName.padStart(10)).join(''));
    const any = (k) => PIRATES.map((l) => (plans.some((p) => { const c = cell(s, fit, p, l); return c && c[k] / c.n >= 0.4; }) ? 'yes' : ' no').padStart(10)).join('');
    console.log('  ' + 'gun win possible'.padEnd(20) + any('guns'));
    console.log('  ' + 'boarding possible'.padEnd(20) + any('board'));
  }
}
console.log('\n=== What each shot adds: win rate of duel with that shot minus duel with round only, averaged over pirates ===');
for (const s of ships) for (const fit of [false]) console.log('  ' + s.padEnd(9) + ['duel chain', 'duel grape', 'duel fire', 'duel combo'].map((p) => `${p.slice(5)} ${String(Math.round(100 * PIRATES.reduce((a, l) => a + cell(s, fit, p, l).win - cell(s, fit, 'duel round', l).win, 0) / 5)).padStart(4)}pt`).join('   ') + `   | hug fire vs hug round ${String(Math.round(100 * PIRATES.reduce((a, l) => a + cell(s, fit, 'hug fire', l).win - cell(s, fit, 'hug round', l).win, 0) / 5)).padStart(4)}pt`);
console.log('\n=== What fittings add: best-strategy win rate, fitted minus stock ===');
for (const s of ships) console.log('  ' + s.padEnd(9) + PIRATES.map((l) => { const b = (f) => Math.max(...plans.map((p) => cell(s, f, p, l).win)); return `${l} ${String(Math.round(100 * (b(true) - b(false)))).padStart(4)}pt`; }).join('   '));
console.log('\n=== Average fight length of wins (s), stock, best strategy ===');
for (const s of ships) console.log('  ' + s.padEnd(9) + PIRATES.map((l) => { const c = plans.map((p) => cell(s, false, p, l)).sort((a, b) => b.win - a.win)[0]; return `${l} ${String(c.t).padStart(4)}`; }).join('   '));
