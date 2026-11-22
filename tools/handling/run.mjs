// How the ships handle, compared side by side: standard manoeuvres sailed by every hull in three winds, drawn
// from above with all the tracks laid over each other, plus polar roses and a chase table.
//   node tools/handling/run.mjs [manoeuvre,...] [--hulls a,b] [--winds light,breeze,gale] [--out dir] [--png]
//                               [--no-polar] [--no-chase]
// Runs on dist/index.html (npm run build first); DIST=<html> runs another build. GHOST=<html> also runs a second
// build (say a copy of dist from before a change) and draws its tracks dashed under this one's, with its numbers
// in brackets, so a rules change shows as the gap between the solid and the dashed line.
// Writes <out>/<manoeuvre>-<wind>.svg, polar-<wind>.svg, chase.html, index.html (everything on one page) and
// data.json; --png also writes PNGs and contact.png. Prints the numbers as tables. See README.md.
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2), flag = (n) => args.includes('--' + n), opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const valued = new Set(['--out', '--hulls', '--winds']);
const only = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const HULLS = opt('hulls', 'galliot,sloop,galley,xebec,brig,merchantman,flagship').split(',');
const ALLWINDS = { light: 0.5, breeze: 1, gale: 1.6 };
const WINDS = opt('winds', 'light,breeze,gale').split(',').map((w) => [w, ALLWINDS[w] ?? +w]);
const out = path.resolve(opt('out', 'out/handling'));
// one colour per hull, lightest to heaviest (the reference categorical palette, dark-surface steps); every track
// also carries its hull's name at its end, so no line is told apart by colour alone
const COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const colOf = (h) => COL[HULLS.indexOf(h) % COL.length];

// what each manoeuvre is and which numbers matter for it (key, label, unit, better: +1 more is better, -1 less)
const ABOUT = {
  tack: ['Tack', 'Close-hauled at full way, helm hard over through the wind, close-hauled on the other tack. 40 s.', [['done', 'round in', 's', -1], ['vmin', 'slowest', 'yd/s', 1], ['upwind', 'to windward', 'yd', 1]]],
  wear: ['Wear', 'The same change of tack turning away from the wind, through dead downwind. 40 s.', [['done', 'round in', 's', -1], ['vmin', 'slowest', 'yd/s', 1], ['upwind', 'to windward', 'yd', 1]]],
  circle: ['Full circle', 'Helm hard over from a beam reach at full way until she has turned 360°.', [['done', 'circle in', 's', -1], ['width', 'width', 'yd', -1], ['vmin', 'slowest', 'yd/s', 1]]],
  irons: ['In irons', 'Head to wind with no way on, helm hard over until she pays off and settles close-hauled. 40 s.', [['done', 'free in', 's', -1], ['drift', 'fell back', 'yd', 1]]],
  beat: ['Beat to windward', 'Close-hauled, tacking every 30 s, for 90 s.', [['upwind', 'to windward', 'yd', 1], ['vmg', 'made good', 'yd/s', 1]]],
  gather: ['Gather way', 'From rest on a beam reach, for 30 s.', [['done', '90% speed in', 's', -1], ['dist', 'covered', 'yd', 1]]],
  chainTack: ['Tack, sails shot away', 'The tack with only 40% of her canvas, as chain shot leaves it. 40 s.', [['done', 'round in', 's', -1], ['vmin', 'slowest', 'yd/s', 1], ['upwind', 'to windward', 'yd', 1]]],
  leeShore: ['Claw off a lee shore', 'Lying beam-on with no way on and rocks 40 yd to leeward, she makes sail and comes up close-hauled. 45 s.', [['closest', 'closest', 'yd', 1]]],
};
const NAMES = only ? only.split(',') : Object.keys(ABOUT);

// ---- run the simulations in one build
async function sample(file) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await page.waitForTimeout(600);
  for (const f of [path.join(here, '../balance/harness.js'), path.join(here, 'sim.js')]) await page.addScriptTag({ content: readFileSync(f, 'utf8') });
  const res = { man: {}, polar: {}, chase: {} };
  for (const [w, str] of WINDS) {
    for (const name of NAMES) for (const hull of HULLS) res.man[`${name}|${w}|${hull}`] = await page.evaluate(([h, s, n]) => HS.manoeuvre(h, s, n), [hull, str, name]);
    if (!flag('no-polar')) for (const hull of HULLS) res.polar[`${w}|${hull}`] = (await page.evaluate(([h, s]) => HS.polar(h, s), [hull, str])).polar;
    if (!flag('no-chase')) for (const how of ['upwind', 'abeam', 'downwind']) for (const a of HULLS) for (const b of HULLS) if (a !== b) res.chase[`${how}|${w}|${a}|${b}`] = await page.evaluate(([a, b, s, how]) => HS.chase(a, b, s, how), [a, b, str, how]);
    process.stderr.write(`  ${path.basename(file)} ${w} done\n`);
  }
  await browser.close();
  return res;
}
const dist = process.env.DIST || path.join(here, '../../dist/index.html'), ghostFile = process.env.GHOST;
const [cur, ghost] = await Promise.all([sample(dist), ghostFile ? sample(ghostFile) : null]);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'data.json'), JSON.stringify({ dist, ghost: ghostFile || null, hulls: HULLS, winds: WINDS, cur, ghostData: ghost }));

// ---- drawing
const fmt = (v) => (v == null ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : Math.abs(v) >= 100 ? Math.round(v) : v);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const delta = (v, g, better) => { // the ghost's number, coloured by whether this build is better
  if (g === undefined) return '';
  if (v == null || g == null || typeof v !== 'number') return ` <tspan class="g">(${fmt(g)})</tspan>`;
  const d = v - g, cls = Math.abs(d) < 0.15 ? 'g' : d * better > 0 ? 'up' : 'down';
  return ` <tspan class="${cls}">(${fmt(g)})</tspan>`;
};
const STYLE = `<style>text{font:12px system-ui,sans-serif;fill:#cde}.t{font-size:15px;font-weight:600}.s{fill:#8aa}.g{fill:#789}.up{fill:#6c6}.down{fill:#f77}.lab{font-size:10px;paint-order:stroke;stroke:#0a1c28;stroke-width:3px}</style>`;

// a manoeuvre in one wind, every hull's track over each other; north (the wind's eye) up
function manSvg(name, w) {
  const [title, blurb, keys] = ABOUT[name], str = WINDS.find((x) => x[0] === w)[1];
  const runs = HULLS.map((h) => ({ h, r: cur.man[`${name}|${w}|${h}`], g: ghost?.man[`${name}|${w}|${h}`] }));
  const pts = runs.flatMap((x) => [...x.r.track, ...(x.g?.track || [])]);
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1]));
  if (name === 'leeShore') z0 = Math.min(z0, -55);
  const span = Math.max(x1 - x0, z1 - z0, 60) * 1.12, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const S = 620, k = S / span, X = (x) => 20 + S / 2 + (x - cx) * k, Y = (z) => 70 + S / 2 - (z - cz) * k;
  const step = [10, 25, 50, 100, 200, 500].find((s) => span / s <= 12) || 1000;
  let g = `<rect x="20" y="70" width="${S}" height="${S}" fill="#0f2a3b"/>`;
  for (let v = Math.ceil((cx - span / 2) / step) * step; v < cx + span / 2; v += step) g += `<line x1="${X(v)}" x2="${X(v)}" y1="70" y2="${70 + S}" stroke="#18384b"/>`;
  for (let v = Math.ceil((cz - span / 2) / step) * step; v < cz + span / 2; v += step) g += `<line y1="${Y(v)}" y2="${Y(v)}" x1="20" x2="${20 + S}" stroke="#18384b"/>`;
  g += `<text x="26" y="${66 + S}" class="s">grid ${step} yd</text>`;
  if (name === 'leeShore') g += `<rect x="20" y="${Y(-40)}" width="${S}" height="${70 + S - Y(-40)}" fill="#6b5a3a" opacity="0.5"/><text x="${24}" y="${Y(-40) + 14}" class="s">rocks</text>`;
  // wind arrow, from the north
  g += `<g transform="translate(${S - 10},96)"><line y1="-18" y2="14" stroke="#cde" stroke-width="2"/><path d="M-6 8 L0 18 L6 8z" fill="#cde"/><text x="-12" y="34" text-anchor="middle" class="s">wind ${str}</text></g>`;
  g += `<circle cx="${X(0)}" cy="${Y(0)}" r="4" fill="none" stroke="#cde"/>`;
  const line = (tr, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="${dash ? 1.5 : 2}" ${dash ? 'stroke-dasharray="5 4" opacity="0.55"' : ''} stroke-linejoin="round" points="${tr.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/>`;
  // a small hull every 2 s shows which way her bow points, so sliding sideways shows against the track
  const bows = (tr, col) => tr.filter((_, i) => i % 8 === 0).map((p) => `<path d="M0 -6 L2.6 3 L-2.6 3z" fill="${col}" transform="translate(${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}) rotate(${((p[2] * 180) / Math.PI).toFixed(0)})"/>`).join('');
  for (const x of runs) if (x.g) g += line(x.g.track, colOf(x.h), true);
  for (const x of runs) g += line(x.r.track, colOf(x.h)) + bows(x.r.track, colOf(x.h));
  for (const x of runs) { const p = x.r.track[x.r.track.length - 1]; g += `<text class="lab" x="${X(p[0]) + 5}" y="${Y(p[1]) + 3}" style="fill:${colOf(x.h)}">${x.h}</text>`; }
  // legend: the numbers, this build (ghost in brackets)
  const L = 20 + S + 20;
  let leg = `<text x="${L}" y="92" class="s">${ghost ? 'this build (before)' : ''}</text>`;
  keys.forEach(([, lab, unit], i) => (leg += `<text x="${L + 116 + i * 92}" y="110" class="s">${lab}${unit ? ` ${unit}` : ''}</text>`));
  runs.forEach((x, j) => {
    const y = 132 + j * 22;
    leg += `<line x1="${L}" x2="${L + 18}" y1="${y - 4}" y2="${y - 4}" stroke="${colOf(x.h)}" stroke-width="3"/><text x="${L + 24}" y="${y}">${x.h}</text>`;
    keys.forEach(([key, , , better], i) => (leg += `<text x="${L + 116 + i * 92}" y="${y}">${fmt(x.r.metrics[key])}${x.g ? delta(x.r.metrics[key], x.g.metrics[key], better) : ''}</text>`));
  });
  const W = L + 116 + keys.length * 92 + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(W, 900)} ${S + 90}" width="${Math.max(W, 900)}" height="${S + 90}">${STYLE}<rect width="100%" height="100%" fill="#0a1c28"/>
<text x="20" y="28" class="t">${esc(title)} · ${w}</text><text x="20" y="50" class="s">${esc(blurb)}</text>${g}${leg}</svg>`;
}

// polar rose: speed (yd/s) by angle off the wind for every hull; the wind blows from the top
function polarSvg(w) {
  const str = WINDS.find((x) => x[0] === w)[1], all = HULLS.flatMap((h) => [...cur.polar[`${w}|${h}`], ...(ghost?.polar[`${w}|${h}`] || [])]);
  const vmax = Math.max(...all.map((p) => p.v), 1), R = 300, cx = 340, cy = 370;
  // off is measured from dead downwind: downwind at the bottom, head to wind at the top
  const Q = (off, v) => [cx + Math.sin((off * Math.PI) / 180) * (v / vmax) * R, cy + Math.cos((off * Math.PI) / 180) * (v / vmax) * R];
  let g = '';
  const ring = [2, 4, 5, 8, 10, 15, 20].find((s) => vmax / s <= 6);
  for (let v = ring; v <= vmax; v += ring) g += `<path d="M${cx} ${cy - (v / vmax) * R} A${(v / vmax) * R} ${(v / vmax) * R} 0 0 1 ${cx} ${cy + (v / vmax) * R}" fill="none" stroke="#18384b"/><text x="${cx - 4}" y="${cy - (v / vmax) * R + 4}" text-anchor="end" class="s">${v}</text>`;
  for (let d = 0; d <= 180; d += 30) { const [x, y] = Q(d, vmax); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#18384b"/><text x="${x + (d % 180 ? 6 : 0)}" y="${y + (d === 0 ? 16 : d === 180 ? -6 : 4)}" class="s">${180 - d}°</text>`; }
  const line = (pl, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="${dash ? 1.5 : 2}" ${dash ? 'stroke-dasharray="5 4" opacity="0.55"' : ''} points="${pl.map((p) => Q(p.off, p.v).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  for (const h of HULLS) if (ghost) g += line(ghost.polar[`${w}|${h}`], colOf(h), true);
  for (const h of HULLS) g += line(cur.polar[`${w}|${h}`], colOf(h));
  let leg = '';
  HULLS.forEach((h, j) => {
    const pl = cur.polar[`${w}|${h}`], best = pl.reduce((a, p) => (p.v > a.v ? p : a)), vmg = Math.max(...pl.map((p) => -p.v * Math.cos((p.off * Math.PI) / 180)));
    const lw = Math.max(0, ...pl.map((p) => p.leeway || 0)), y = 110 + j * 22;
    leg += `<line x1="700" x2="718" y1="${y - 4}" y2="${y - 4}" stroke="${colOf(h)}" stroke-width="3"/><text x="724" y="${y}">${h}</text><text x="810" y="${y}">${best.v} at ${180 - best.off}°</text><text x="920" y="${y}">${vmg.toFixed(1)}</text><text x="1010" y="${y}">${lw}°</text>`;
  });
  leg = `<text x="810" y="88" class="s">best speed</text><text x="920" y="88" class="s">upwind vmg</text><text x="1010" y="88" class="s">most leeway</text>` + leg;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 700" width="1120" height="700">${STYLE}<rect width="100%" height="100%" fill="#0a1c28"/>
<text x="20" y="28" class="t">Speed by point of sail · ${w} (${str})</text><text x="20" y="50" class="s">Settled speed over the ground (yd/s) at each angle from the wind's eye (0° head to wind, at the top). ${ghost ? 'Dashed: before.' : ''}</text>${g}${leg}</svg>`;
}

// chase table: who catches whom from 300 yd in 4 minutes, and how long it takes
function chaseHtml() {
  const HOW = { upwind: 'Quarry to windward, beating away', abeam: 'Quarry abeam, reaching away across the wind', downwind: 'Quarry to leeward, running off on a broad reach' };
  let h = '';
  for (const [w] of WINDS) for (const how of Object.keys(HOW)) {
    if (!cur.chase[`${how}|${w}|${HULLS[0]}|${HULLS[1]}`]) continue;
    h += `<h3>${HOW[how]} · ${w}</h3><table><tr><th>chaser ↓ quarry →</th>${HULLS.map((b) => `<th>${b}</th>`).join('')}</tr>`;
    for (const a of HULLS) {
      h += `<tr><th>${a}</th>`;
      for (const b of HULLS) {
        if (a === b) { h += '<td class="x"></td>'; continue; }
        const r = cur.chase[`${how}|${w}|${a}|${b}`], gr = ghost?.chase[`${how}|${w}|${a}|${b}`];
        const txt = r.caught ? `${r.t}s` : `${r.gap}yd`, was = gr ? (gr.caught ? `${gr.t}s` : `${gr.gap}yd`) : null;
        const changed = gr && (gr.caught !== r.caught || Math.abs((gr.t ?? 0) - (r.t ?? 0)) > 8);
        h += `<td class="${r.caught ? 'c' : 'n'}${changed ? ' ch' : ''}">${txt}${was && changed ? `<small> (${was})</small>` : ''}</td>`;
      }
      h += '</tr>';
    }
    h += '</table>';
  }
  return `<h2>Chases</h2><p>Each chaser starts 300 yd from a quarry that sails away and never turns to fight; seconds to close within 100 yd, or the gap left after 4 minutes. Galleys row. ${ghost ? 'Brackets: before, where it changed.' : ''}</p>${h}`;
}

const files = [];
for (const [w] of WINDS) for (const name of NAMES) { const f = `${name}-${w}.svg`; writeFileSync(path.join(out, f), manSvg(name, w)); files.push(f); }
if (!flag('no-polar')) for (const [w] of WINDS) { const f = `polar-${w}.svg`; writeFileSync(path.join(out, f), polarSvg(w)); files.push(f); }
const chase = flag('no-chase') ? '' : chaseHtml();
const CSS = `body{background:#0d2433;color:#cde;font:13px system-ui,sans-serif;margin:12px}h1{font-size:16px}h2{font-size:15px;margin-top:28px}h3{font-size:13px;margin:16px 0 4px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:12px}figure{margin:0}figure svg{width:100%;height:auto;display:block;border-radius:6px}
table{border-collapse:collapse}td,th{padding:3px 8px;border:1px solid #18384b;text-align:right}th{color:#8aa;font-weight:500}td.c{color:#cde}td.n{color:#678}td.x{background:#0a1c28}td.ch{outline:1px solid #c98500}small{color:#8aa}.guide{max-width:900px;background:#0a1c28;border-radius:6px;padding:8px 14px;margin-bottom:12px}.guide summary{cursor:pointer;font-weight:600}.guide li{margin:3px 0}`;
writeFileSync(path.join(out, 'chase.html'), `<!doctype html><meta charset="utf-8"><title>Broadside chases</title><style>${CSS}</style>${chase}`);
writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadside handling</title><style>${CSS}</style>
<h1>Broadside handling · ${HULLS.length} hulls · ${WINDS.map((w) => w[0]).join(', ')}${ghost ? ' · dashed lines and brackets are the build before' : ''}</h1>
<details open class="guide"><summary>How to read this page</summary>
<p><b>Tracks.</b> Every test is one ship alone in open water. The wind blows from the top of each picture. Each coloured line is one ship's path from the small circle. The little triangles show where her bow pointed every 2 seconds, so a line running at an angle to its triangles means she is sliding sideways (leeway).${ghost ? ' Solid lines are this build, dashed lines the build before; numbers in brackets are the build before, green where this build does better and red where worse.' : ''}</p>
<ul><li><b>Tack, wear, beat:</b> the higher a line ends, the more ground she made to windward. The hook is the turn; a wide hook means she lost ground turning.</li>
<li><b>Irons:</b> a short hook means she got free fast. A line that first sags downward means she was pushed astern while stuck.</li>
<li><b>Circle:</b> the size of the loop is her turning circle. <b>Gather:</b> how far she gets from a standing start.</li>
<li><b>Lee shore:</b> how close each line comes to the brown band (the rocks).</li></ul>
<p><b>Polar roses</b> (the half-circles): her speed at each angle to the wind. Head to wind is at the top, dead downwind at the bottom. The empty slice at the top is where she cannot sail; a curve that reaches further up and out sails better to windward.</p>
<p><b>Chase tables</b> (at the bottom): rows chase columns. A time means the chaser closed within 100 yd that fast; a distance is the gap left after 4 minutes, so she never caught her. Speed and steering only, no guns.</p></details>
<main>${files.map((f) => `<figure>${readFileSync(path.join(out, f), 'utf8')}</figure>`).join('\n')}</main>${chase}`);

// ---- the numbers, as text
for (const [w] of WINDS) {
  console.log(`\n== ${w}`);
  for (const name of NAMES) {
    const keys = ABOUT[name][2];
    console.log(`${name.padEnd(10)} ${keys.map(([, l]) => l.padStart(16)).join('')}`);
    for (const h of HULLS) {
      const m = cur.man[`${name}|${w}|${h}`].metrics, gm = ghost?.man[`${name}|${w}|${h}`].metrics;
      console.log(`  ${h.padEnd(12)}${keys.map(([k]) => `${fmt(m[k])}${gm ? ` (${fmt(gm[k])})` : ''}`.padStart(16)).join('')}`);
    }
  }
}

if (flag('png')) {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  for (const f of files) { await page.goto(pathToFileURL(path.join(out, f)).href); await page.locator('svg').screenshot({ path: path.join(out, f.replace(/\.svg$/, '.png')) }); }
  await page.setViewportSize({ width: 1800, height: 1000 }); await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await page.screenshot({ path: path.join(out, 'contact.png'), fullPage: true });
  await browser.close();
}
console.log(`\n${files.length} pictures in ${path.relative(process.cwd(), out) || '.'}/ (index.html has them all${flag('no-chase') ? '' : ', with the chase tables'})`);
