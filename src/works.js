import * as THREE from 'three';
import { Batch, GLOW, SOLID, shade, mulberry } from './geo.js';
import { barrel, crate, rowboat } from './harbor.js';

// Shore works: the stone and timber a map is built from. Each takes a Batch (B, plus G for lit
// windows) and the world's ground(x, z), so a wall follows the hill it stands on. None of this
// changes how a fight plays; it is what makes a place read as the place it is.
const STONE = 0xc4b393, DARK = 0x8f8268, WOOD = 0x6b4a2c, IRON = 0x1c1c1e, PLANK = 0x8a6a44, WHITE = 0xece3cf;

export function works(fn, lit) {
  const G = new Batch(), B = new Batch(G), g = new THREE.Group();
  fn(B, G);
  g.add(B.mesh());
  if (!G.empty) g.add(G.mesh(lit ? GLOW : SOLID));
  return g;
}

// a curtain wall along a path, standing on the ground, with merlons and a tower at every corner
export function wall(B, ground, path, o = {}) {
  const h = o.h ?? 7, w = o.w ?? 3, col = o.col ?? STONE, top = shade(col, 0.88);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 10)), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, x = a[0] + (b[0] - a[0]) * (t0 + t1) / 2, z = a[1] + (b[1] - a[1]) * (t0 + t1) / 2, l = len / n;
      const g0 = Math.max(o.floor ?? -1, Math.min(ground(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), ground(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1), ground(x, z)));
      const y1 = Math.max(o.floor ?? -1, ground(x, z)) + h;
      B.box(w, y1 - g0 + 2, l + 0.3, col, x, (g0 - 2 + y1) / 2, z, 0, ry);
      B.box(w + 0.5, 0.5, l + 0.3, top, x, y1, z, 0, ry);
      if (o.merlons !== false) for (let m = 0; m < Math.floor(l / 2.6); m++) { const tm = (m + 0.5) / Math.floor(l / 2.6) - 0.5; B.box(0.6, 1.3, 1.3, col, x + Math.sin(ry) * tm * l + Math.cos(ry) * w * 0.4 * (o.out ?? 1), y1 + 0.85, z + Math.cos(ry) * tm * l - Math.sin(ry) * w * 0.4 * (o.out ?? 1), 0, ry); }
    }
    if (o.towers !== false && i > 0) tower(B, ground, a[0], a[1], o.towerR ?? w * 1.3, h + 2.5, col, o.floor);
  }
  if (o.ends) for (const q of [path[0], path[path.length - 1]]) tower(B, ground, q[0], q[1], o.towerR ?? w * 1.3, h + 2.5, col, o.floor);
}
export function tower(B, ground, x, z, r, h, col = STONE, floor = -1, cap) {
  const y0 = Math.max(floor, ground(x, z));
  B.cyl(r, r * 1.08, h + 3, col, x, y0 + (h - 3) / 2, z, 10);
  B.cyl(r * 1.08, r * 1.08, 0.6, shade(col, 0.85), x, y0 + h, z, 10);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.box(r * 0.5, 1.3, 0.8, col, x + Math.sin(a) * r * 0.92, y0 + h + 0.9, z + Math.cos(a) * r * 0.92, 0, a); }
  if (cap) B.cyl(0, r * 1.2, r * 1.3, cap, x, y0 + h + 0.3 + r * 0.65, z, 10);
}
// a pentagonal artillery bastion pointing along `ry`, its face rising from the sea or the ditch
export function bastion(B, ground, x, z, ry, s = 22, h = 10, col = STONE, floor = -1) {
  const y0 = Math.max(floor, ground(x, z)) + h;
  const pts = [[0, s], [s * 0.75, s * 0.15], [s * 0.6, -s * 0.6], [-s * 0.6, -s * 0.6], [-s * 0.75, s * 0.15]];
  const c = Math.cos(ry), sn = Math.sin(ry), P = (p, y) => [x + p[0] * c + p[1] * sn, y, z - p[0] * sn + p[1] * c];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    B.quad(P(a, -3), P(b, -3), P(b, y0), P(a, y0), i % 2 ? col : shade(col, 0.92));
    B.quad(P(a, y0), P(b, y0), P(b, y0 + 1.2), P(a, y0 + 1.2), shade(col, 0.85));
  }
  const c0 = [0, s * 0.05];
  for (let i = 0; i < pts.length; i++) B.tri(P(c0, y0 + 0.2), P(pts[i], y0 + 0.2), P(pts[(i + 1) % pts.length], y0 + 0.2), shade(col, 0.78));
  B.cyl(1.6, 1.8, 3.2, shade(col, 0.95), P(pts[0], 0)[0], y0 + 1.6, P(pts[0], 0)[2], 6); // a sentry box on the point
}
export function minaret(B, x, y, z, h = 22) {
  B.cyl(1.3, 1.5, h, WHITE, x, y + h / 2, z, 10);
  B.cyl(2.0, 1.4, 0.9, WHITE, x, y + h * 0.78, z, 10);
  B.cyl(0, 1.35, 4.5, 0x5a6b7a, x, y + h + 2.2, z, 10);
}
export function dome(B, x, y, z, r, col = WHITE, roofCol = 0x8c9aa2) {
  B.box(r * 2.1, r * 1.1, r * 2.1, col, x, y + r * 0.55, z);
  B.add(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), roofCol, new THREE.Matrix4().makeTranslation(x, y + r * 1.1, z));
}
export function campanile(B, x, y, z, h = 20, col = 0xd8c8a6, k = 1) {
  B.at(x, y, z, 0, () => campanile0(B, 0, 0, 0, h, col, k));
}
function campanile0(B, x, y, z, h, col, k) {
  const a = 2 * k;
  B.box(a * 2, h, a * 2, col, x, y + h / 2, z); B.box(a * 2.2, 0.4 * k, a * 2.2, STONE, x, y + h * 0.8, z);
  for (const [dx, dz] of [[0, a + 0.02], [0, -a - 0.02], [a + 0.02, 0], [-a - 0.02, 0]]) B.box(dx ? 0.1 : 1.3 * k, 2 * k, dz ? 0.1 : 1.3 * k, 0x2a2218, x + dx, y + h * 0.88, z + dz);
  B.cyl(0, 3.1 * k, 5 * k, 0x9a5a3a, x, y + h + 2.5 * k, z, 4, 0, Math.PI / 4);
}
// a house seen from the sea: walls, a tiled roof, a door and a few windows, in a few dozen triangles
function cottage(B, G, w, h, d, wall, roofCol, rnd, glass) {
  B.box(w, h + 3, d, wall, 0, (h - 3) / 2, 0);
  const rh = d * 0.38 + 0.6, ov = 0.4;
  for (const s of [-1, 1]) B.quad([-w / 2 - ov, h - 0.2, s * (d / 2 + ov)], [w / 2 + ov, h - 0.2, s * (d / 2 + ov)], [w / 2 + ov, h + rh, 0], [-w / 2 - ov, h + rh, 0], s > 0 ? roofCol : shade(roofCol, 0.85));
  for (const s of [-1, 1]) B.tri([s * w / 2, h, -d / 2], [s * w / 2, h, d / 2], [s * w / 2, h + rh, 0], wall);
  const n = Math.max(1, Math.round(w / 3.2)), rows = h > 5.5 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) if (rnd() < 0.75) for (const s of [-1, 1]) G.box(0.9, 1.2, 0.12, glass, -w / 2 + (w * (i + 0.5)) / n, 1.9 + r * 2.6, s * (d / 2 + 0.02));
  B.box(1.2, 2.2, 0.14, 0x3a2412, 0, 1.1, d / 2 + 0.03);
}
// a town: lots scattered over an area, each house on the ground and turned a little; skips water and steep ground
export function town(B, G, ground, o) {
  const rnd = mulberry(o.seed || 5), out = [], walls = o.walls || [0xe6dcc4, 0xd9c9a8, 0xcfa98a, 0xe0d2b8, 0xd8b89a, 0xf0e8d8], roofs = o.roofs || [0x8a4a3a, 0x9a5a3a, 0xa0583c, 0x7a3f33];
  for (let i = 0, n = 0; i < o.n * 6 && n < o.n; i++) {
    const x = o.x + (rnd() - 0.5) * o.w, z = o.z + (rnd() - 0.5) * o.d;
    if (o.inside && !o.inside(x, z)) continue;
    const sz = o.size || 1, y = ground(x, z), w = (5 + rnd() * 4) * sz, d = (5 + rnd() * 3) * sz;
    if (y < (o.minY ?? 2.2)) continue;
    const sl = Math.abs(ground(x + 4, z) - ground(x - 4, z)) + Math.abs(ground(x, z + 4) - ground(x, z - 4));
    if (sl > (o.steep ?? 6) || out.some((q) => Math.abs(q[0] - x) < (q[2] + w) / 2 + 1.2 && Math.abs(q[1] - z) < (q[3] + d) / 2 + 1.2)) continue;
    out.push([x, z, w, d]); n++;
    const yy = Math.min(y, ground(x + w / 2, z), ground(x - w / 2, z), ground(x, z + d / 2), ground(x, z - d / 2));
    B.at(x, yy + 0.1, z, (o.ry || 0) + (rnd() - 0.5) * 0.25 + (rnd() < 0.5 ? Math.PI / 2 : 0), () => cottage(B, G, w, (3.6 + rnd() * 3.4) * sz, d, walls[(rnd() * walls.length) | 0], roofs[(rnd() * roofs.length) | 0], rnd, o.glass ?? 0x7d6a48));
  }
  return out;
}
// a stone mole: a walkway on a battered foundation, a parapet on the seaward side, bollards on the harbour side
export function mole(B, m, ground) {
  const { path, w, top } = m, side = m.sea ?? 1;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const nx = Math.cos(ry) * side, nz = -Math.sin(ry) * side; // seaward
    B.box(w + 3, 4, len + 1.5, shade(STONE, 0.7), x, top - 4.6, z, 0, ry); // footing, wider below the water
    B.box(w, 3, len + 1.2, STONE, x, top - 1.5, z, 0, ry);
    for (let k = 0; k < Math.floor(len / 4.2); k++) { const t = (k + 0.5) / Math.floor(len / 4.2) - 0.5; B.box(w * 0.96, 0.08, 4, shade(STONE, 0.86 + ((k * 7) % 5) * 0.025), x + Math.sin(ry) * t * len, top + 0.02, z + Math.cos(ry) * t * len, 0, ry); }
    B.box(1.4, 1.6, len + 1.2, shade(STONE, 0.92), x + nx * (w / 2 - 0.7), top + 0.8, z + nz * (w / 2 - 0.7), 0, ry);
    for (let k = 0; k < Math.floor(len / 14); k++) { const t = (k + 0.5) / Math.floor(len / 14) - 0.5; B.cyl(0.35, 0.45, 0.9, IRON, x + Math.sin(ry) * t * len - nx * (w / 2 - 1), top + 0.45, z + Math.cos(ry) * t * len - nz * (w / 2 - 1), 7); }
    B.box(w + 0.2, 0.9, len + 1.3, 0x4f5a48, x, 0.05, z, 0, ry); // weed at the waterline
  }
  for (const q of path.slice(1, -1)) B.cyl(w / 2 + 0.3, w / 2 + 0.6, 3, STONE, q[0], top - 1.5, q[1], 10);
}
// the Venetian arsenal: vaulted sheds side by side, open to the water, a hull on the stocks in one
export function arsenal(B, x, y, z, ry, n = 5) {
  B.at(x, y, z, ry, () => {
    for (let i = 0; i < n; i++) {
      const cx = (i - (n - 1) / 2) * 13, L = 40;
      B.box(0.9, 9, L, STONE, cx - 6.3, 4.5, -L / 2 + 2);
      if (i === n - 1) B.box(0.9, 9, L, STONE, cx + 6.3, 4.5, -L / 2 + 2);
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI, nx = Math.cos(a) * 6.2, ny = 9 + Math.sin(a) * 3.2, a2 = ((k + 1) / 8) * Math.PI; if (k < 8) B.quad([cx + nx, ny, 2.2], [cx + Math.cos(a2) * 6.2, 9 + Math.sin(a2) * 3.2, 2.2], [cx + Math.cos(a2) * 6.2, 9 + Math.sin(a2) * 3.2, -L + 2], [cx + nx, ny, -L + 2], k % 2 ? 0x9a5a3a : 0x8a4a33); }
      B.box(12.6, 2.4, 0.6, STONE, cx, 10.4, 2.2); // the arch head
      B.box(12.6, 9, 0.6, shade(STONE, 0.75), cx, 4.5, -L + 2);
      if (i === 1) { B.box(0.5, 0.5, 22, 0x3a2412, cx, 1.2, -14); for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) B.bar([cx, 1.3, -14 + k * 2.4], [cx + sd * 3 * Math.cos(k / 5), 4.4, -14 + k * 2.4], 0.15, 0xb08f5c, 4); }
    }
  });
}
// a slipway with a hull in frame, timber stacked beside it, and a quay
export function yard(B, ground, x, z, ry) {
  const y = Math.max(1.2, ground(x, z));
  B.at(x, y, z, ry, () => {
    B.box(10, 1.2, 44, shade(STONE, 0.8), 0, -0.4, -6);
    B.box(0.6, 0.6, 30, 0x3a2412, 0, 0.6, -4);
    for (let k = -6; k <= 6; k++) { const hw = 3.6 * Math.cos((k / 7) * 1.3) ** 0.6; for (const sd of [-1, 1]) B.bar([0, 0.7, -4 + k * 2.2], [sd * hw * 0.8, 2, -4 + k * 2.2], 0.16, 0xb08f5c, 4).bar([sd * hw * 0.8, 2, -4 + k * 2.2], [sd * hw, 5.5, -4 + k * 2.2], 0.16, 0xb08f5c, 4); }
    for (let i = 0; i < 6; i++) B.box(0.6, 0.35, 9, 0xb89a66, 9 + (i % 3) * 0.7, 0.2 + Math.floor(i / 3) * 0.36, -12);
    for (const [cx, cz] of [[-8, -20], [8, -20], [-8, -2], [8, -2]]) B.cyl(0.3, 0.35, 9, WOOD, cx, 4, cz, 6);
    B.bar([-8, 8.5, -20], [8, 8.5, -20], 0.25, WOOD, 5).bar([-8, 8.5, -2], [8, 8.5, -2], 0.25, WOOD, 5);
    for (let i = 0; i < 4; i++) barrel(B, -10 - (i % 2) * 1.5, 0, 6 + Math.floor(i / 2) * 1.5);
    crate(B, 11, 0, 4, 1.6, 0.2); crate(B, 11.4, 1.6, 4.2, 1.1, 0.6);
  });
}
// lighters and boats lying about a ship fitting out
export function lighters(B, x, z, ry, n = 3, seed = 3) {
  const rnd = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const a = ry + (i - (n - 1) / 2) * 0.9 + (rnd() - 0.5) * 0.3, d = 20 + rnd() * 6, lx = x + Math.sin(a) * d, lz = z + Math.cos(a) * d, h = a + Math.PI / 2;
    B.at(lx, 0.1, lz, h, () => {
      B.box(5, 1.4, 12, 0x5d4630, 0, 0.3, 0); B.box(4.4, 0.2, 11.2, PLANK, 0, 1.0, 0);
      for (let k = 0; k < 3; k++) crate(B, (rnd() - 0.5) * 2.4, 1.1, -3 + k * 3, 1.2 + rnd() * 0.6, rnd());
      B.bar([0, 1, 5], [0, 7, 5], 0.12, WOOD, 4);
    });
  }
  rowboat(B, x - 14, z + 26, ry + 0.8, 0x8a3a2a);
}
