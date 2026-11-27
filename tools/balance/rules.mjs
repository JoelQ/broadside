// Checks the campaign's design rules (docs/campaign.md) against a legs run, and says which ones a change broke.
//   node tools/balance/rules.mjs <after.json> [before.json] [--strict] [--md]
// The run is run.mjs's output for legs.mjs. With before.json (the same jobs on the same seeds before a change) it
// also lists the rules each leg newly breaks and newly keeps. --md prints a Markdown table for a job summary;
// --strict exits 1 when any rule marked "fail" is broken (warnings never fail).
// A route "wins" a leg for a hull when it wins at least WIN of its fights (default 0.5, WIN=<x> to change).
// Rules that need fight records (STORY=1 or STORY=lite) are skipped when the run has none.
import { readFileSync } from 'fs';

const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--')), md = args.includes('--md'), strict = args.includes('--strict');
if (!pos[0]) { console.error('usage: rules.mjs <after.json> [before.json] [--strict] [--md]'); process.exit(2); }
const WIN = +(process.env.WIN || 0.5);
const HEAVY = ['merchantman', 'flagship'], NIMBLE = ['sloop', 'xebec'], BOARDING_ROUTES = /board|prep|rush|storm/i;

// Each rule looks at one leg's cells and returns null (kept) or a short reason (broken).
const RULES = [
  { id: 'three-ships', level: 'fail', text: 'Winnable by at least three kinds of ship (rule 1)',
    check: (L) => { const h = L.hulls.filter((x) => L.wins(x)); return h.length >= 3 ? null : `only ${h.join(', ') || 'none'}`; } },
  { id: 'three-routes', level: 'fail', text: 'Winnable by at least three different routes (rule 1)',
    check: (L) => { const r = L.routes.filter((x) => L.hulls.some((h) => L.rate(h, x) >= WIN)); return r.length >= 3 ? null : `only ${r.join(', ') || 'none'}`; } },
  { id: 'heavy-nimble-oared', level: 'fail', text: 'A route for a heavy ship, a nimble one and an oared or boarding one (rule 5)',
    check: (L) => {
      const miss = [];
      if (!HEAVY.some((h) => L.wins(h))) miss.push('heavy');
      if (!NIMBLE.some((h) => L.wins(h))) miss.push('nimble');
      if (!L.wins('galley') && !L.hulls.some((h) => L.routes.some((r) => BOARDING_ROUTES.test(r) && L.rate(h, r) >= WIN))) miss.push('oared or boarding');
      return miss.length ? `no ${miss.join(', ')} win` : null;
    } },
  { id: 'running-not-only', level: 'fail', text: 'Running is never the only answer (rule 5)',
    check: (L) => (L.routes.includes('run') && !L.routes.some((r) => r !== 'run' && L.hulls.some((h) => L.rate(h, r) >= WIN)) ? 'only running wins' : null) },
  { id: 'no-sure-route', level: 'warn', text: 'No route works for every ship every time',
    check: (L) => { const r = L.routes.filter((x) => L.routes.length > 1 && L.hulls.every((h) => L.rate(h, x) == null || L.rate(h, x) >= 0.95)); return r.length ? `${r.join(', ')} always works` : null; } },
  { id: 'some-doubt', level: 'warn', text: 'Some ship is in doubt',
    check: (L) => (L.hulls.every((h) => L.best(h) >= 0.95) ? 'every ship always wins' : null) },
  { id: 'fights-end', level: 'warn', text: 'Fights end: under 10% of a leg\'s fights time out',
    check: (L) => { const n = L.fights.length, t = L.fights.filter((f) => f.o === 'timeout').length; return n && t / n >= 0.1 ? `${t} of ${n} timed out` : null; } },
  { id: 'no-lone-shot', level: 'warn', story: true, text: 'Grape and chain set up wins, never finish them alone',
    check: (L) => {
      const w = L.fights.filter((f) => f.win && f.story), bad = {};
      for (const f of w) for (const k of ['grape', 'chain']) if ((f.story.share.dealt[f.story.decisive]?.[k] || 0) >= 0.8) bad[k] = (bad[k] || 0) + 1;
      const r = Object.entries(bad).filter(([, n]) => n / (w.length || 1) >= 0.2);
      return r.length ? r.map(([k, n]) => `${k} alone in ${n} of ${w.length} wins`).join(', ') : null;
    } },
];

function evaluate(file) {
  const cells = JSON.parse(readFileSync(file, 'utf8'));
  if (!cells.length || !cells[0].legName) { console.error(`${file} is not a legs run (run.mjs with legs.mjs)`); process.exit(2); }
  const hasStory = cells.some((c) => (c.results || []).some((r) => r.story));
  const out = {};
  for (const leg of [...new Set(cells.map((c) => c.legName))]) {
    const mine = cells.filter((c) => c.legName === leg);
    const L = {
      hulls: [...new Set(mine.map((c) => c.hull))], routes: [...new Set(mine.map((c) => c.routeName))], fights: mine.flatMap((c) => c.results || []),
      rate: (h, r) => { const c = mine.find((x) => x.hull === h && x.routeName === r); return c ? c.results.filter((x) => x.win).length / c.results.length : null; },
    };
    L.best = (h) => Math.max(0, ...L.routes.map((r) => L.rate(h, r) ?? 0));
    L.wins = (h) => L.best(h) >= WIN;
    out[leg] = Object.fromEntries(RULES.filter((r) => !r.story || hasStory).map((r) => [r.id, r.check(L)]));
  }
  return { legs: out, hasStory };
}

const A = evaluate(pos[0]), Bf = pos[1] ? evaluate(pos[1]) : null;
const rules = RULES.filter((r) => !r.story || A.hasStory), legs = Object.keys(A.legs);
const broken = (E, r) => legs.filter((l) => E.legs[l]?.[r.id]);
let fails = 0;
const rows = rules.map((r) => {
  const b = broken(A, r), was = Bf ? broken(Bf, r) : null;
  if (r.level === 'fail') fails += b.length;
  const newly = was ? b.filter((l) => !was.includes(l)) : [], fixed = was ? was.filter((l) => !b.includes(l) && A.legs[l]) : [];
  return { r, b, newly, fixed };
});
const mark = (x) => (x.b.length ? (x.r.level === 'fail' ? 'FAIL' : 'warn') : 'ok');
if (md) {
  console.log(`| Rule | Status | Legs breaking it${Bf ? ' | Change' : ''} |\n| --- | --- | --- |${Bf ? ' --- |' : ''}`);
  for (const x of rows) console.log(`| ${x.r.text} | ${mark(x)} | ${x.b.map((l) => `${l} (${A.legs[l][x.r.id]})`).join('<br>') || '-'}${Bf ? ` | ${[...x.newly.map((l) => `newly broken: ${l}`), ...x.fixed.map((l) => `now kept: ${l}`)].join('<br>') || '-'}` : ''} |`);
  if (!A.hasStory) console.log('\nRules that need fight records were skipped (run with STORY=lite).');
} else {
  for (const x of rows) {
    console.log(`${mark(x).padEnd(5)} ${x.r.text}`);
    for (const l of x.b) console.log(`        ${l}: ${A.legs[l][x.r.id]}${x.newly.includes(l) ? '  << newly broken' : ''}`);
    for (const l of x.fixed) console.log(`        ${l}: now kept`);
  }
  if (!A.hasStory) console.log('\n(rules that need fight records were skipped: run with STORY=lite)');
}
console.log(`\n${legs.length} legs, ${fails} broken "fail" rules${Bf ? `, ${rows.reduce((s, x) => s + x.newly.length, 0)} newly broken, ${rows.reduce((s, x) => s + x.fixed.length, 0)} now kept` : ''}`);
if (strict && fails) process.exit(1);
