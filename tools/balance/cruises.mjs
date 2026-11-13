// Whole missions: every mission x side x hull, each leg sailed by the route that did best for that
// hull in a legs run (pass its JSON as BEST=...). Damage carries between legs and the watches are
// spent, so this shows whether a cruise can be finished, not just each fight from a fresh ship.
//   BEST=/tmp/legs.json node tools/balance/run.mjs tools/balance/cruises.mjs 4
import { readFileSync } from 'fs';
import { LEGS, HULLS } from './legs.mjs';
const TITLE = { brothers: 'The brothers', leeShore: 'A lee shore', coveRaid: 'The careenage', landing: 'The landing', islets: 'Among the islets', falseColours: 'False colours' };
const best = process.env.BEST ? JSON.parse(readFileSync(process.env.BEST, 'utf8')) : null;
const rate = (c) => c.results.filter((r) => r.win).length / c.results.length - c.results.reduce((a, r) => a + (r.win ? 1 - r.hull : 0), 0) / c.results.length / 10;
const hulls = process.env.HULLS ? process.env.HULLS.split(',') : HULLS, cells = [];
for (const [mission, sides] of [['m1', ['venice', 'ottoman']], ['m2', ['venice']], ['m3', ['venice']], ['m4', ['venice', 'ottoman']], ['m5', ['venice', 'ottoman']]]) for (const side of sides) for (const hull of hulls) {
  const routes = {}, names = {};
  for (const L of LEGS) {
    if (L.mission !== mission || (typeof L.leg === 'number' && L.side !== side && !(mission === 'm5' && L.name === 'm5 The harbour') && mission !== 'm3' && mission !== 'm2')) continue;
    const title = typeof L.leg === 'string' ? TITLE[L.leg] : L.name.replace(/^m\d[VO]? /, '');
    let rn = Object.keys(L.routes)[0];
    if (best) { const mine = best.filter((c) => c.legName === L.name && c.hull === hull).sort((a, b) => rate(b) - rate(a)); if (mine.length) rn = mine[0].routeName; }
    routes[title] = L.routes[rn]; names[title] = rn;
  }
  cells.push({ label: `${mission} ${side.slice(0, 3)} | ${hull}`, mission, side, hull, routes, routeNames: names });
}
export default cells;
