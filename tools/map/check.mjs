// Checks a leg's layout for the mistakes that are easy to make by hand and only show once you sail
// there: ships that start on land or aground, zones on land, and places a hull can't get to.
// Each finding is { level: 'error' | 'warn' | 'note', msg, at?: [x, z] }. Errors fail the command.
import { PLAYER_HULLS, hullStats } from './scenes.mjs';

const CELL = 8; // metres per cell of the reachability grid

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pt = (p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : p);
const where = (p) => `(${Math.round(p.x)}, ${Math.round(p.z)})`;

// A grid of where a ship of this beam and draught can be. A ship keeps a beam's width off the land and
// off any bank she would stick on, which is about what she needs to turn and to pass another ship.
export function waterGrid(sc, B, D, box) {
  const nx = Math.ceil((box.x1 - box.x0) / CELL) + 1, nz = Math.ceil((box.z1 - box.z0) / CELL) + 1;
  const free = new Uint8Array(nx * nz).fill(1), clear = B;
  const stamp = (cx, cz, r) => {
    const i0 = Math.max(0, Math.floor((cx - r - box.x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((cx + r - box.x0) / CELL));
    const j0 = Math.max(0, Math.floor((cz - r - box.z0) / CELL)), j1 = Math.min(nz - 1, Math.ceil((cz + r - box.z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(box.x0 + i * CELL - cx, box.z0 + j * CELL - cz) < r) free[j * nx + i] = 0;
  };
  for (const l of sc.land) stamp(l.x, l.z, l.hit + clear);
  for (const s of sc.shoals) if (D > s.depth) stamp(s.x, s.z, s.r + clear * 0.5);
  const cell = (p) => [Math.round((p.x - box.x0) / CELL), Math.round((p.z - box.z0) / CELL)];
  return { nx, nz, free, cell, at: (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && free[j * nx + i] === 1 };
}

// every cell reachable from a start, by flood fill; a start just inside a margin snaps to open water
function flood(g, from) {
  let [si, sj] = g.cell(from);
  if (!g.at(si, sj)) {
    let best = null;
    for (let r = 1; r <= 6 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (!best && g.at(si + di, sj + dj)) best = [si + di, sj + dj];
    if (!best) return null;
    [si, sj] = best;
  }
  const seen = new Uint8Array(g.nx * g.nz), q = [si + sj * g.nx];
  seen[q[0]] = 1;
  while (q.length) {
    const k = q.pop(), i = k % g.nx, j = (k / g.nx) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (g.at(a, b) && !seen[a + b * g.nx]) { seen[a + b * g.nx] = 1; q.push(a + b * g.nx); }
    }
  }
  return (p, r = 0) => {
    // near enough: any reached cell within r of the point (a zone, or a waypoint's arrival radius)
    const [ci, cj] = g.cell(p), n = Math.max(1, Math.ceil(r / CELL));
    for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
      const a = ci + di, b = cj + dj;
      if (a >= 0 && b >= 0 && a < g.nx && b < g.nz && seen[a + b * g.nx] && Math.hypot(di, dj) * CELL <= Math.max(r, CELL)) return true;
    }
    return false;
  };
}

export function bounds(sc) {
  const xs = [sc.player.x], zs = [sc.player.z];
  const add = (x, z, r = 0) => { xs.push(x - r, x + r); zs.push(z - r, z + r); };
  for (const l of sc.land) add(l.x, l.z, l.r);
  for (const s of sc.shoals) add(s.x, s.z, s.r);
  for (const z of [...sc.zones, ...sc.laterZones]) add(z.x, z.z, z.r);
  for (const s of [...sc.ships, ...sc.arrivals]) { add(s.x, s.z, s.L); if (s.o.goTo) add(s.o.goTo[0], s.o.goTo[1]); }
  for (const r of Object.values(sc.routes)) for (const st of r) if (Array.isArray(st.go)) add(st.go[0], st.go[1]);
  const m = 120;
  return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
}

export function check(sc) {
  const out = [], box = bounds(sc);
  const say = (level, msg, at) => out.push({ level, msg, ...(at ? { at: [Math.round(at.x), Math.round(at.z)] } : {}) });
  const onLand = (p, pad = 0) => sc.land.find((l) => !l.fort && dist(p, l) < l.hit + pad);
  const shoalFor = (p, D) => sc.shoals.find((s) => D > s.depth && dist(p, s) < s.r);
  const hulls = PLAYER_HULLS.map(hullStats);
  const label = (s) => `${s.id} (${s.cls}${s.t ? `, arrives at ${s.t}s` : ''})`;

  // the player's start, for every hull she might sail
  const p = sc.player;
  if (onLand(p, 6)) say('error', `player starts on land ${where(p)}`, p);
  const stuck = hulls.filter((h) => shoalFor(p, h.D));
  if (stuck.length) say(stuck.length === hulls.length ? 'error' : 'warn', `player starts aground in a ${stuck.map((h) => h.hull).join(', ')}`, p);

  // the other ships
  const all = [...sc.ships, ...sc.arrivals];
  for (const s of all) {
    if (s.fixed) continue;
    const l = onLand(s, s.B * 0.5);
    if (l) say('error', `${label(s)} starts on land ${where(s)}`, s);
    const sh = shoalFor(s, s.D);
    if (sh) say('error', `${label(s)} starts aground: draws ${s.D}, bank is ${sh.depth} deep ${where(s)}`, s);
    if (dist(s, p) < s.L * 0.5 + 25) say('warn', `${label(s)} starts on top of the player`, s);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.t !== b.t || (a.fixed && b.fixed)) continue;
    if (dist(a, b) < (a.L + b.L) * 0.5) say('warn', `${label(a)} and ${label(b)} start overlapping`, a);
  }
  // zones
  for (const z of [...sc.zones, ...sc.laterZones]) if (onLand(z)) say('error', `zone "${z.name}" is centred on land ${where(z)}`, z);

  // where each hull can get to from the player's start
  const reach = {};
  for (const h of hulls) reach[h.hull] = flood(waterGrid(sc, h.B, h.D, box), p);
  const who = (q, r) => hulls.filter((h) => reach[h.hull] && reach[h.hull](q, r)).map((h) => h.hull);
  const can = (list) => (list.length === hulls.length ? 'every hull' : list.length ? list.join(', ') : 'no hull');
  for (const z of [...sc.zones, ...sc.laterZones]) {
    const ok = who(z, z.r);
    say(ok.length ? (ok.length < hulls.length ? 'note' : 'note') : 'error', `zone "${z.name}" reachable by ${can(ok)}`, z);
  }
  // the balance routes' waypoints: a moved coast can leave a route pointing at the land
  for (const [name, steps] of Object.entries(sc.routes)) {
    const pts = steps.filter((st) => Array.isArray(st.go));
    if (!pts.length) continue;
    let ok = hulls.map((h) => h.hull);
    for (const st of pts) {
      const q = pt(st.go);
      if (onLand(q)) say('error', `route "${name}" has a waypoint on land ${where(q)}`, q);
      const here = who(q, st.r || 30);
      ok = ok.filter((h) => here.includes(h));
    }
    say(ok.length ? 'note' : 'warn', `route "${name}" waypoints reachable by ${can(ok)}`, pt(pts[pts.length - 1].go));
  }
  // where the ships are sent
  for (const s of all) if (s.o.goTo && !s.fixed) {
    const g = flood(waterGrid(sc, s.B, s.D, box), s), q = pt(s.o.goTo);
    if (g && !g(q, 40)) say('warn', `${label(s)} is sent to ${where(q)} but can't get there`, q);
  }
  return out;
}
