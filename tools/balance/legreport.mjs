// Summarises a legs run: for each leg, the win rate of every hull by every route, and whether the
// leg passes the design rule (winnable by at least three different kinds of ship, and by at least
// three different routes).   node tools/balance/legreport.mjs <out.json> [threshold]
import { readFileSync } from 'fs';
const cells = JSON.parse(readFileSync(process.argv[2], 'utf8')), ok = +(process.argv[3] || 0.5);
const legs = [...new Set(cells.map((c) => c.legName))], hulls = [...new Set(cells.map((c) => c.hull))];
const short = { sloop: 'sloop', brig: 'brig', xebec: 'xebec', merchantman: 'merch', galley: 'galley', flagship: 'flag' };
let bad = 0;
for (const leg of legs) {
  const mine = cells.filter((c) => c.legName === leg), routes = [...new Set(mine.map((c) => c.routeName))];
  const rate = (c) => c.results.filter((r) => r.win).length / c.results.length;
  console.log(`\n${leg}`);
  console.log('  ' + 'route'.padEnd(12) + hulls.map((h) => short[h].padStart(7)).join(''));
  for (const rn of routes) console.log('  ' + rn.padEnd(12) + hulls.map((h) => { const c = mine.find((x) => x.hull === h && x.routeName === rn); return (c ? Math.round(rate(c) * 100) + '%' : '-').padStart(7); }).join(''));
  const hullsOk = hulls.filter((h) => mine.some((c) => c.hull === h && rate(c) >= ok)), routesOk = routes.filter((rn) => mine.some((c) => c.routeName === rn && rate(c) >= ok));
  const best = hulls.map((h) => Math.max(...mine.filter((c) => c.hull === h).map(rate)));
  const flags = [];
  if (hullsOk.length < 3) flags.push('FEWER THAN 3 SHIPS CAN WIN');
  if (routesOk.length < 3) flags.push('FEWER THAN 3 ROUTES WIN');
  if (best.every((b) => b >= 0.95)) flags.push('no ship is ever in doubt');
  for (const rn of routes) if (hulls.every((h) => { const c = mine.find((x) => x.hull === h && x.routeName === rn); return !c || rate(c) >= 0.95; }) && routes.length > 1) flags.push(`route "${rn}" always works`);
  if (flags.some((f) => f === f.toUpperCase())) bad++;
  console.log(`  ships that can win: ${hullsOk.map((h) => short[h]).join(' ') || 'none'} · routes that win: ${routesOk.join(' ') || 'none'}${flags.length ? '\n  !! ' + flags.join('; ') : ''}`);
}
console.log(`\n${legs.length} legs, ${bad} failing the three-ways rule`);
