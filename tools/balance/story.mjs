// Reads a run made with STORY=1 and says how its fights were won and lost: what did the decisive damage, how long
// each side had the other under its guns, and how long nobody could fire. Draws the first few fights of each cell.
//   STORY=1 SEED=1000 node tools/balance/run.mjs <jobs.mjs> 6 /tmp/run.json
//   node tools/balance/story.mjs /tmp/run.json [--only <label-regex>] [--fights 3] [--out out/story]
// The decisive damage is her crew for a capture, her hull for a sinking or a striking, and ours for a loss.
// Causes are the four shots, burning (a fire's damage), boarding (the deck fight, swivels included) and other
// (rocks, collisions). "Alone" counts the fights where one cause did at least 80% of the decisive damage.
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
if (!pos[0]) { console.error('usage: story.mjs <run.json> [--only <label-regex>] [--fights 3] [--out out/story]'); process.exit(2); }
let cells = JSON.parse(readFileSync(pos[0], 'utf8'));
if (flags.only) cells = cells.filter((c) => new RegExp(flags.only).test(c.label));
const perCell = +flags.fights || 3, out = path.resolve(flags.out || 'out/story');
const fightsOf = (c) => (c.results || c.runs || []).filter((x) => x.story);
if (!cells.some((c) => fightsOf(c).length)) { console.error('no fight records in this file: run it with STORY=1'); process.exit(2); }

const CAUSES = ['round', 'chain', 'grape', 'fire', 'burning', 'boarding', 'other'];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (x) => `${Math.round(x * 100)}%`;
const won = (f) => f.win || ['struck', 'sunk', 'captured', 'won'].includes(f.o);

const rows = cells.map((c) => {
  const fs = fightsOf(c), wins = fs.filter(won), losses = fs.filter((f) => !won(f) && f.o !== 'timeout');
  // mean share of the decisive damage by cause, over wins and over losses
  const mix = (list) => Object.fromEntries(CAUSES.map((k) => [k, mean(list.map((f) => f.story.share[won(f) ? 'dealt' : 'taken'][f.story.decisive]?.[k] || 0))]).filter(([, v]) => v >= 0.01));
  const alone = {};
  for (const f of wins) { const sh = f.story.share.dealt[f.story.decisive] || {}; for (const [k, v] of Object.entries(sh)) if (v >= 0.8) alone[k] = (alone[k] || 0) + 1; }
  const arcs = Object.fromEntries(['mine', 'hers', 'both', 'neither', 'boarding'].map((k) => [k, mean(fs.map((f) => f.story.arcs[k] || 0))]));
  return { label: c.label, n: fs.length, wins: wins.length, losses: losses.length, timeouts: fs.filter((f) => f.o === 'timeout').length, winMix: mix(wins), lossMix: mix(losses), alone, arcs, lull: mean(fs.map((f) => f.story.longestLull)), fights: fs };
});

const mixStr = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(', ') || '-';
for (const r of rows) {
  console.log(`\n${r.label}  (${r.n} fights: ${r.wins} won, ${r.losses} lost${r.timeouts ? `, ${r.timeouts} timed out` : ''})`);
  if (r.wins) console.log(`  wins decided by   ${mixStr(r.winMix)}${Object.keys(r.alone).length ? `   | alone: ${Object.entries(r.alone).map(([k, v]) => `${k} ${v}/${r.wins}`).join(', ')}` : ''}`);
  if (r.losses) console.log(`  losses decided by ${mixStr(r.lossMix)}`);
  console.log(`  guns bearing      ours only ${pct(r.arcs.mine)}, hers only ${pct(r.arcs.hers)}, both ${pct(r.arcs.both)}, neither ${pct(r.arcs.neither)}, boarding ${pct(r.arcs.boarding)} · longest lull ${Math.round(r.lull)}s`);
}

// ---------- page ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const C = { hull: '#257de0', sails: '#f47230', crew: '#00b894' };
const CAUSE_C = { round: '#257de0', chain: '#f47230', grape: '#00b894', fire: '#f2a600', burning: '#ee7fac', boarding: '#6a4ce2', other: '#9a9a9a' };
const ARC_C = { mine: '#257de0', hers: '#ec4647', both: '#6a4ce2', neither: '#e6e6e6', boarding: '#191919' };
const AMMO_C = { round: '#9ab8dc', chain: '#f47230', grape: '#00b894', fire: '#f2a600' };

function bar(m) { // a stacked bar of a cause mix, 100% wide
  let x = 0, s = '';
  for (const [k, v] of Object.entries(m).sort((a, b) => CAUSES.indexOf(a[0]) - CAUSES.indexOf(b[0]))) { s += `<rect x="${x}" y="0" width="${Math.max(0, v * 200 - 2)}" height="14" rx="2" fill="${CAUSE_C[k]}"><title>${k} ${pct(v)}</title></rect>`; x += v * 200; }
  return `<svg width="200" height="14">${s}</svg>`;
}
function strip(f) { // one fight: our ship and the nearest foe, hull/sails/crew over time, with what bore and what was loaded
  const S = f.story.samples; if (!S.length) return '';
  const W = 640, ph = 70, gap = 18, T = S[S.length - 1].t || 1, x = (t) => 40 + (t / T) * (W - 50);
  const crew0 = f.story.start.me?.crew || Math.max(...S.map((s) => s.me[2])), foeCrew0 = {};
  for (const fo of f.story.start.foes || []) foeCrew0[fo.id] = fo.crew;
  const panel = (y0, who, label) => {
    let s = `<text x="0" y="${y0 + 12}" class="ax">${label}</text><line x1="40" x2="${W - 10}" y1="${y0 + ph}" y2="${y0 + ph}" class="grid"/><line x1="40" x2="${W - 10}" y1="${y0}" y2="${y0}" class="grid"/>`;
    for (const [i, k] of ['hull', 'sails', 'crew'].entries()) {
      const pts = S.filter((p) => p[who]).map((p) => { const v = i < 2 ? p[who][i] : p[who][2] / ((who === 'me' ? crew0 : foeCrew0[p.foeId]) || p[who][2] || 1); return `${x(p.t).toFixed(1)},${(y0 + ph - Math.min(1, v) * ph).toFixed(1)}`; });
      s += `<polyline fill="none" stroke="${C[k]}" stroke-width="2" points="${pts.join(' ')}"/>`;
    }
    return s;
  };
  let svg = `<svg viewBox="0 0 ${W} ${ph * 2 + gap + 50}" width="${W}">`;
  svg += panel(0, 'me', 'ours') + panel(ph + gap, 'foe', 'hers');
  const yb = ph * 2 + gap + 8;
  for (let i = 0; i < S.length; i++) {
    const a = S[i], b = S[i + 1] || { t: T }, w = Math.max(0.5, x(b.t) - x(a.t));
    svg += `<rect x="${x(a.t)}" y="${yb}" width="${w}" height="10" fill="${ARC_C[a.arc]}"><title>${a.t}s ${a.arc}, ${a.d} yd</title></rect>`;
    svg += `<rect x="${x(a.t)}" y="${yb + 14}" width="${w}" height="10" fill="${AMMO_C[a.ammo] || '#ccc'}"><title>${a.t}s loaded ${a.ammo}</title></rect>`;
  }
  svg += `<text x="0" y="${yb + 9}" class="ax">guns</text><text x="0" y="${yb + 23}" class="ax">shot</text><text x="${W - 10}" y="${yb + 38}" text-anchor="end" class="ax">${T}s</text></svg>`;
  return `<div class="fight"><div class="cause">seed ${f.seed} · ${esc(f.story.cause)}</div>${svg}</div>`;
}
const legend = (m) => Object.entries(m).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('');
const html = `<!doctype html><meta charset="utf-8"><title>Fight stories</title>
<style>body{font:14px system-ui,sans-serif;color:#191919;margin:24px;max-width:1000px}h1{font-size:18px}h2{font-size:15px;margin:32px 0 4px}
.note{color:#666}.grid{stroke:#e6e6e6}.ax{fill:#666;font-size:11px}.legend{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0;color:#444;font-size:12px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}table{border-collapse:collapse}td,th{padding:4px 8px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
.fight{margin:10px 0 18px}.cause{font-size:12px;color:#444;margin-bottom:2px}</style>
<h1>Fight stories</h1>
<p class="note">From ${esc(path.basename(pos[0]))}. The decisive damage is her crew for a capture, her hull for a sinking or a striking, ours for a loss. "Alone" is the wins where one cause did at least 80% of it.</p>
<div class="legend"><b>causes</b>${legend(CAUSE_C)}</div>
<table><tr><th>cell</th><th>won</th><th>wins decided by</th><th>alone</th><th>losses decided by</th><th>neither side's guns bear</th><th>longest lull</th></tr>
${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.wins}/${r.n}</td><td>${r.wins ? bar(r.winMix) : ''}</td><td>${Object.entries(r.alone).map(([k, v]) => `${k} ${v}`).join(', ')}</td><td>${r.losses ? bar(r.lossMix) : ''}</td><td>${pct(r.arcs.neither)}</td><td>${Math.round(r.lull)}s</td></tr>`).join('')}</table>
<h2>Fights</h2>
<div class="legend"><b>lines</b>${legend(C)} <span>crew as a share of what she started with</span></div>
<div class="legend"><b>guns</b>${legend({ 'ours bear': ARC_C.mine, 'hers bear': ARC_C.hers, both: ARC_C.both, neither: ARC_C.neither, boarding: ARC_C.boarding })}</div>
<div class="legend"><b>shot loaded</b>${legend(AMMO_C)}</div>
${rows.map((r) => `<h2>${esc(r.label)}</h2>${r.fights.slice(0, perCell).map(strip).join('')}`).join('')}`;
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'index.html'), html);
console.error(`\nwrote ${path.relative(process.cwd(), out)}/index.html`);
