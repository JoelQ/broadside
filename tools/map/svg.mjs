// Draws a leg from above as an SVG: land (islands, coasts, moles), banks by depth, zones, ships with their headings, the wind,
// the current, the balance routes, and anything the checker found. North (+z) is up, east (+x) right.
import { bounds } from './check.mjs';

const SIDE = { player: '#f2c14e', 0: '#6fb3ff', 1: '#ff6b5e' };
const ROUTE = ['#f2c14e', '#b48cff', '#5fe0b5', '#ff9e57', '#ff7fc8', '#9fd85a', '#7fd4ff', '#e8e8e8'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n) => Math.round(n * 10) / 10;

export function svg(sc, findings = [], { width = 1100 } = {}) {
  const b = bounds(sc), W = b.x1 - b.x0, H = b.z1 - b.z0;
  const k = W / width; // metres per pixel, for sizing marks and text so they read at any map size
  const X = (x) => f(x - b.x0), Y = (z) => f(b.z1 - z);
  const px = (n) => f(n * k);
  const o = [];
  const text = (x, y, s, size = 12, fill = '#fff', anchor = 'middle', extra = '') =>
    o.push(`<text x="${f(x)}" y="${f(y)}" font-size="${px(size)}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`);

  // water and a 100 m grid
  o.push(`<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="#18435e"/>`);
  for (let x = Math.ceil(b.x0 / 100) * 100; x <= b.x1; x += 100) o.push(`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${f(H)}" stroke="#fff" stroke-opacity="${x % 500 ? 0.05 : 0.14}" stroke-width="${px(1)}"/>`);
  for (let z = Math.ceil(b.z0 / 100) * 100; z <= b.z1; z += 100) o.push(`<line x1="0" y1="${Y(z)}" x2="${f(W)}" y2="${Y(z)}" stroke="#fff" stroke-opacity="${z % 500 ? 0.05 : 0.14}" stroke-width="${px(1)}"/>`);
  for (let x = Math.ceil(b.x0 / 500) * 500; x <= b.x1; x += 500) text(X(x) + px(3), H - px(6), x, 10, '#9cc', 'start', 'opacity="0.7"');
  for (let z = Math.ceil(b.z0 / 500) * 500; z <= b.z1; z += 500) text(px(4), Y(z) - px(3), z, 10, '#9cc', 'start', 'opacity="0.7"');

  // the current, as arrows on a grid
  if (sc.current) {
    const step = Math.max(60, Math.round(Math.max(W, H) / 24 / 10) * 10);
    for (let x = Math.ceil(b.x0 / step) * step; x <= b.x1; x += step) for (let z = Math.ceil(b.z0 / step) * step; z <= b.z1; z += step) {
      const [vx, vz] = sc.current(x, z), v = Math.hypot(vx, vz);
      if (v < 0.05) continue;
      const len = Math.min(step * 0.8, 14 * v + 8) * 1, ux = vx / v, uz = vz / v;
      arrow(o, X(x), Y(z), X(x + ux * len), Y(z + uz * len), '#7fd4ff', px(1.2), px(5), 0.35 + Math.min(0.5, v * 0.25));
    }
  }

  // banks: their ragged shapes, pale water, deeper the darker; a reef (under 2 deep) grounds anything. Drawn under the land, which hides
  // whatever of a bank runs under the shore; the soundings are written after the land
  for (const s of [...sc.shoals].sort((a, c) => c.depth - a.depth)) {
    const reef = s.depth < 2, col = reef ? '#b9a877' : s.depth < 3 ? '#5fa8a8' : '#3f8592';
    const d = s.shape.pts.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x)},${Y(z)}`).join('') + 'Z';
    o.push(`<path d="${d}" fill="${col}" fill-opacity="${reef ? 0.75 : 0.5}" stroke="#d8f2ee" stroke-opacity="0.5" stroke-width="${px(1)}" stroke-dasharray="${px(4)} ${px(3)}"/>`);
  }
  // coasts: the roughened shore the game builds, a band of beach and the land behind it
  for (const c of sc.coasts) {
    const d = c.shape.pts.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x)},${Y(z)}`).join('') + 'Z';
    o.push(`<path d="${d}" fill="#55813c" stroke="#d8c690" stroke-width="${f(Math.max(6, px(3)))}" stroke-linejoin="round"/>`);
  }
  // moles: the walkway at its true width, gun platforms and the forts on their heads
  for (const m of sc.moles) {
    o.push(`<polyline points="${m.path.map(([x, z]) => `${X(x)},${Y(z)}`).join(' ')}" fill="none" stroke="#a49a80" stroke-width="${f(m.w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    for (const [x, z, r] of [...m.platforms, ...m.blocks]) o.push(`<circle cx="${X(x)}" cy="${Y(z)}" r="${f(r)}" fill="#a49a80"/>`);
  }
  // land: what you see, and inside it the line a ship hits
  for (const l of sc.land) {
    if (l.fort) continue;
    o.push(`<circle cx="${X(l.x)}" cy="${Y(l.z)}" r="${f(l.r)}" fill="#d8c690"/>`);
    o.push(`<circle cx="${X(l.x)}" cy="${Y(l.z)}" r="${f(l.hit)}" fill="#55813c" stroke="#3a5a29" stroke-width="${px(1)}"/>`);
  }
  for (const s of sc.shoals) { const reef = s.depth < 2; text(X(s.x), Y(s.z) + px(4), reef ? `reef ${s.depth}` : s.depth.toFixed(1), 11, reef ? '#3b2f17' : '#e8fffb'); }
  // zones
  for (const z of [...sc.zones, ...sc.laterZones]) {
    o.push(`<circle cx="${X(z.x)}" cy="${Y(z.z)}" r="${f(z.r)}" fill="#f2c14e" fill-opacity="0.12" stroke="#f2c14e" stroke-width="${px(2)}" stroke-dasharray="${px(8)} ${px(5)}"/>`);
    text(X(z.x), Y(z.z) - z.r - px(5), z.name + (z.t ? ` (at ${z.t}s)` : ''), 12, '#f2c14e');
  }

  // routes from the balance grid: the player's start, then each waypoint
  const routes = Object.entries(sc.routes).filter(([, r]) => r.some((st) => Array.isArray(st.go) || (typeof st.go === 'string' && st.go.startsWith('zone:'))));
  routes.forEach(([name, steps], ri) => {
    const col = ROUTE[ri % ROUTE.length];
    let pts = [[sc.player.x, sc.player.z]];
    for (const st of steps) {
      if (Array.isArray(st.go)) pts.push(st.go);
      else if (typeof st.go === 'string' && st.go.startsWith('zone:')) { const z = sc.zones.find((q) => q.name === st.go.slice(5)); if (z) pts.push([z.x, z.z]); }
    }
    o.push(`<polyline points="${pts.map(([x, z]) => `${X(x)},${Y(z)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${px(2)}" stroke-opacity="0.85" stroke-dasharray="${px(2)} ${px(4)}" stroke-linecap="round"/>`);
    pts.slice(1).forEach(([x, z]) => o.push(`<circle cx="${X(x)}" cy="${Y(z)}" r="${px(3.5)}" fill="${col}"/>`));
    const [lx, lz] = pts[pts.length - 1];
    text(X(lx) + px(6), Y(lz) - px(6), name, 11, col, 'start');
  });

  // where ships are sent
  for (const s of [...sc.ships, ...sc.arrivals]) if (s.o.goTo) {
    o.push(`<line x1="${X(s.x)}" y1="${Y(s.z)}" x2="${X(s.o.goTo[0])}" y2="${Y(s.o.goTo[1])}" stroke="${SIDE[s.side]}" stroke-opacity="0.5" stroke-width="${px(1.2)}" stroke-dasharray="${px(1)} ${px(4)}"/>`);
    o.push(`<circle cx="${X(s.o.goTo[0])}" cy="${Y(s.o.goTo[1])}" r="${px(4)}" fill="none" stroke="${SIDE[s.side]}" stroke-width="${px(1.2)}"/>`);
  }
  // forts and their reach
  for (const s of [...sc.ships, ...sc.arrivals]) if (s.fixed) {
    if (s.range) o.push(`<circle cx="${X(s.x)}" cy="${Y(s.z)}" r="${f(s.range)}" fill="#ff6b5e" fill-opacity="0.05" stroke="#ff6b5e" stroke-opacity="0.45" stroke-width="${px(1)}" stroke-dasharray="${px(6)} ${px(4)}"/>`);
    o.push(`<rect x="${X(s.x - s.L / 2)}" y="${Y(s.z + s.L / 2)}" width="${f(s.L)}" height="${f(s.L)}" fill="#8a8178" stroke="${SIDE[s.side]}" stroke-width="${px(2)}"/>`);
    text(X(s.x), Y(s.z) - s.L / 2 - px(5), s.name, 11, SIDE[s.side]);
  }
  // ships: true length, drawn at least 14 px long so a sloop still shows on a big map
  const ship = (s, col, label, later) => {
    const len = Math.max(s.L, px(14)), beam = Math.max(s.B, len * 0.28), hx = Math.sin(s.h), hz = Math.cos(s.h);
    const P = (a, c) => `${X(s.x + hx * a + hz * c)},${Y(s.z + hz * a - hx * c)}`;
    const pts = [P(len * 0.55, 0), P(len * 0.15, beam / 2), P(-len * 0.45, beam * 0.42), P(-len * 0.45, -beam * 0.42), P(len * 0.15, -beam / 2)].join(' ');
    const idle = s.o && (s.o.idle || s.o.anchored);
    o.push(`<polygon points="${pts}" fill="${later || idle ? 'none' : col}" fill-opacity="0.95" stroke="${col}" stroke-width="${px(later ? 1.5 : 1.2)}" ${later ? `stroke-dasharray="${px(3)} ${px(2)}"` : ''}/>`);
    text(X(s.x), Y(s.z) + len * 0.5 + px(14), label, 11, col, 'middle', 'paint-order="stroke" stroke="#18435e" stroke-width="' + px(3) + '"');
  };
  for (const s of sc.ships) if (!s.fixed) ship(s, SIDE[s.side], `${s.id}${s.o.idle ? ' (at anchor)' : s.o.anchored ? ' (anchored)' : ''}`);
  for (const s of sc.arrivals) if (!s.fixed) ship(s, SIDE[s.side], `${s.id} at ${s.t}s`, true);
  ship({ ...sc.player, L: 30, B: 8, o: {} }, SIDE.player, 'you');

  // findings
  for (const fd of findings) if (fd.at && fd.level !== 'note') {
    const [x, z] = fd.at, r = px(9), col = fd.level === 'error' ? '#ff3b30' : '#ffcc00';
    o.push(`<g stroke="${col}" stroke-width="${px(3)}"><line x1="${X(x) - r}" y1="${Y(z) - r}" x2="${X(x) + r}" y2="${Y(z) + r}"/><line x1="${X(x) - r}" y1="${Y(z) + r}" x2="${X(x) + r}" y2="${Y(z) - r}"/></g>`);
  }

  // title, wind, scale, legend
  const pad = px(12);
  o.push(`<rect x="0" y="0" width="${f(W)}" height="${px(44)}" fill="#000" fill-opacity="0.45"/>`);
  text(pad, px(19), `${sc.name}`, 16, '#fff', 'start', 'font-weight="bold"');
  const wname = sc.wind.str < 0.3 ? 'calm' : sc.wind.str < 0.65 ? 'light airs' : sc.wind.str <= 1.25 ? 'breeze' : 'gale';
  text(pad, px(36), `${sc.title} · ${sc.side || 'prologue'} · ${sc.env} · wind ${wname}${sc.wind.steady ? ', steady' : ''}${sc.windShifts.length ? `, changes at ${sc.windShifts.map((w) => w.t + 's').join(', ')}` : ''}${sc.current ? ' · current' : ''}`, 11, '#cde', 'start');
  // wind arrow: points where the wind blows to
  const cx = W - px(46), cy = px(92), L = px(30), wx = Math.sin(sc.wind.dir), wz = Math.cos(sc.wind.dir);
  o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${px(36)}" fill="#000" fill-opacity="0.4"/>`);
  arrow(o, f(cx - wx * L), f(cy + wz * L), f(cx + wx * L), f(cy - wz * L), '#fff', px(3), px(9), 1);
  text(cx, cy + px(50), 'wind', 10, '#fff');
  text(cx, cy - px(40), 'N', 10, '#9cc');
  // a 100 m scale bar
  const sx = pad, sy = H - px(26);
  o.push(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(sx + 100)}" y2="${f(sy)}" stroke="#fff" stroke-width="${px(3)}"/>`);
  text(sx + 50, sy - px(5), '100 m', 10, '#fff');
  const legend = [['you', SIDE.player], ['friend', SIDE[0]], ['foe', SIDE[1]], ['hollow: at anchor · dashed: arrives later', '#cde']];
  legend.forEach(([s, c], i) => text(W - pad, H - px(10 + 14 * (legend.length - 1 - i)), s, 10, c, 'end'));

  const hpx = Math.round((H / W) * width);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${width}" height="${hpx}" font-family="system-ui, sans-serif">\n${o.join('\n')}\n</svg>\n`;
}

function arrow(o, x1, y1, x2, y2, col, w, head, op) {
  const a = Math.atan2(y2 - y1, x2 - x1), h1 = [x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5)], h2 = [x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5)];
  o.push(`<g stroke="${col}" stroke-width="${w}" stroke-opacity="${op}" fill="${col}" fill-opacity="${op}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><polygon stroke="none" points="${x2},${y2} ${f(h1[0])},${f(h1[1])} ${f(h2[0])},${f(h2[1])}"/></g>`);
}
