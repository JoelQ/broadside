import * as THREE from 'three';
import { Batch, GLOW, SOLID, shade, mulberry, xf } from './geo.js';
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
// A harbour mole: a broad stone arm with a working quay on the harbour side and a high sea wall on the
// other, the sea wall's foot armoured with tumbled blocks. Round gun platforms stand out from it at its
// bends (m.platforms), with a sentry box on each. m.path is the centre line, m.basin a point in the harbour.
const ROCK = new THREE.DodecahedronGeometry(1, 0), WEED = 0x4f5a48;
export function mole(B, G, m, opts = {}) {
  const P = m.path, n = P.length, top = m.top, hw = m.w / 2, H = top + (m.parapet ?? 0) + 1, bas = m.basin ?? [0, 0], rnd = mulberry(opts.seed ?? 7);
  // tangents and the seaward normal at every point of the path
  const S = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; });
  let sg = 0; P.forEach((p, i) => (sg += S[i][0] * (p[0] - bas[0]) + S[i][1] * (p[1] - bas[1])));
  if (sg < 0) for (const v of S) { v[0] = -v[0]; v[1] = -v[1]; }
  const pt = (i, off, y) => [P[i][0] + S[i][0] * off, y, P[i][1] + S[i][1] * off];
  // a strip along the whole mole between two (offset, height) lines; flip turns it to face the other way
  const strip = (o0, y0, o1, y1, col, every) => {
    for (let i = 0; i < n - 1; i++) { const c = every ? shade(col, 0.9 + ((i * 7) % 5) * 0.035) : col; B.quad(pt(i, o0, y0), pt(i + 1, o0, y0), pt(i + 1, o1, y1), pt(i, o1, y1), c); }
  };
  const QUAY = shade(STONE, 0.94), SEAW = 0xbfae8c, FOOT = shade(STONE, 0.6), sw = 3.2;
  strip(-hw - 2, -4.5, -hw, -0.8, FOOT); // the quay's footing
  strip(-hw, -0.8, -hw, 0.7, WEED); strip(-hw, 0.7, -hw, top - 0.4, QUAY); strip(-hw - 0.4, top - 0.4, -hw - 0.4, top, shade(STONE, 1.04)); strip(-hw - 0.4, top, -hw, top, shade(STONE, 1.04)); // quay face and its coping
  strip(-hw, top, hw - sw, top, 0xa89a7a, true); // the walkway, paved in courses
  strip(hw - sw, top, hw - sw, H, shade(SEAW, 0.85)); // back of the sea wall
  strip(hw - sw - 0.3, H, hw + 0.5, H, shade(SEAW, 0.8)); // its rounded coping
  strip(hw + 0.5, H, hw + 0.5, H - 0.5, shade(SEAW, 0.92));
  strip(hw + 0.5, H - 0.5, hw + 1.4, 0.7, SEAW); // the battered face
  strip(hw + 1.4, 0.7, hw + 1.6, -0.6, WEED); strip(hw + 1.6, -0.6, hw + 4.5, -4.5, FOOT);
  strip(hw + 0.95, H - 3.4, hw + 1.25, H - 3.4, shade(SEAW, 1.08)); strip(hw + 1.25, H - 3.4, hw + 1.05, H - 2.9, shade(SEAW, 1.08)); // the cordon
  // the ends of the strip: closed off with masonry where no fort stands
  for (const i of [0, n - 1]) { const a = pt(i, -hw - 2, -4.5), c = P[i]; B.cyl(hw + 1.5, hw + 2.5, top + 5, shade(STONE, 0.85), c[0], (top - 5) / 2, c[1], 12); }
  // along the length: what stands on the quay and against the sea wall
  let run = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const at = (t, off) => [a[0] + (b[0] - a[0]) * t + S[i][0] * off, a[1] + (b[1] - a[1]) * t + S[i][1] * off];
    for (let k = 0; k < 5; k++) { // tumbled blocks at the foot of the sea wall
      const [x, z] = at(rnd(), hw + 2 + rnd() * 3.2), r = 0.9 + rnd() * 1.2;
      B.add(ROCK, shade(0x9a9180, 0.7 + rnd() * 0.35), new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)).setPosition(x, -0.6 + rnd() * 1.2, z).scale(new THREE.Vector3(r * 1.3, r * 0.8, r)));
    }
    const r0 = run; run += len;
    for (let d = Math.ceil(r0 / 16) * 16; d < run; d += 16) { const [x, z] = at((d - r0) / len, -hw + 0.9); B.cyl(0.32, 0.42, 0.9, IRON, x, top + 0.45, z, 7); } // bollards
    for (let d = Math.ceil(r0 / 34) * 34; d < run; d += 34) { const [x, z] = at((d - r0) / len, hw + 1.2); B.box(2.6, H - 0.4, 2.2, shade(SEAW, 0.95), x, (H - 0.4) / 2 - 0.2, z, 0, ry); } // buttresses
    for (let d = Math.ceil((r0 + 20) / 48) * 48 - 20; d < run; d += 48) { // lamps on iron brackets along the sea wall
      const [x, z] = at((d - r0) / len, hw - sw - 0.4);
      B.bar([x, top, z], [x, top + 4.6, z], 0.12, IRON, 4); G.box(0.7, 0.9, 0.7, 0xffd98a, x, top + 5, z); B.cyl(0, 0.6, 0.5, IRON, x, top + 5.7, z, 4);
    }
    for (let d = Math.ceil((r0 + 60) / 140) * 140 - 60; d < run; d += 140) { // water stairs down the quay face, a boat at the foot
      const t = (d - r0) / len;
      for (let st = 0; st < 5; st++) { const [x, z] = at(t + (st * 1.4) / len, -hw - 0.7); B.box(1.6, 0.6, 1.6, shade(STONE, 0.85 - st * 0.03), x, top - 0.6 - st * 0.62, z, 0, ry); }
      const [bx, bz] = at(t + 6 / len, -hw - 2.4); rowboat(B, bx, bz, ry + 0.1, [0x8a3a2a, 0x2e4a5c, 0x6a5a2a][Math.floor(d) % 3]);
    }
    for (let d = Math.ceil((r0 + 100) / 150) * 150 - 100; d < run; d += 150) { // a coaster made fast alongside
      const [x, z] = at((d - r0) / len, -hw - 3.1); tartane(B, x, z, ry + (Math.floor(d / 150) % 2 ? Math.PI : 0), Math.floor(d));
      const [cx, cz] = at((d - r0) / len, -hw + 1.6); crane(B, cx, top, cz, ry - Math.PI / 2 * Math.sign(S[i][0] * Math.cos(ry) - S[i][1] * Math.sin(ry) || 1));
    }
    for (let d = Math.ceil((r0 + 30) / 90) * 90 - 30; d < run; d += 90) { // cargo landed on the quay
      const [x, z] = at((d - r0) / len, -hw + 3 + rnd() * 3);
      for (let q = 0; q < 4; q++) (q % 2 ? barrel(B, x + (rnd() - 0.5) * 4, top, z + (rnd() - 0.5) * 4) : crate(B, x + (rnd() - 0.5) * 4, top, z + (rnd() - 0.5) * 4, 1.2 + rnd() * 0.6, rnd()));
    }
  }
  // the gun platforms: round bulwarks with a parapet, guns looking out to sea and a sentry box on the point
  for (const [x, z, r] of m.platforms ?? []) {
    const ox = x - bas[0], oz = z - bas[1], ol = Math.hypot(ox, oz), out = Math.atan2(ox / ol, oz / ol);
    B.cyl(r + 3, r + 6, 4, FOOT, x, -2.6, z, 14);
    B.cyl(r + 0.6, r + 1.6, top + 4.6, SEAW, x, (top - 4.6) / 2 + 0.3, z, 14);
    B.cyl(r, r, 0.3, 0xa89a7a, x, top + 0.35, z, 14);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, rel = Math.abs(((a - out + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (rel > 1.7) continue; // open to the mole behind
      if (k % 2 && rel < 1.2) continue; // an embrasure
      B.box(2 * r * Math.sin(Math.PI / 14) + 0.3, 1.6, 1.4, shade(SEAW, 0.92), x + Math.sin(a) * (r + 0.1), top + 1.1, z + Math.cos(a) * (r + 0.1), 0, a);
    }
    for (const da of [-0.9, 0, 0.9]) { // three guns on their carriages
      const a = out + da + Math.PI / 14, gx = x + Math.sin(a) * (r - 3.2), gz = z + Math.cos(a) * (r - 3.2);
      B.box(1.6, 0.8, 2.4, 0x5a3a22, gx, top + 0.8, gz, 0, a); B.bar([gx, top + 1.4, gz], [gx + Math.sin(a) * 3.4, top + 1.6, gz + Math.cos(a) * 3.4], 0.32, IRON, 6, 0.24);
    }
    for (let q = 0; q < 6; q++) B.add(new THREE.IcosahedronGeometry(0.34, 0), IRON, new THREE.Matrix4().makeTranslation(x - Math.sin(out) * 2 + (q % 3) * 0.7, top + 0.8 + Math.floor(q / 3) * 0.5, z - Math.cos(out) * 2));
    const sx = x + Math.sin(out) * (r + 0.6), sz = z + Math.cos(out) * (r + 0.6); // the sentry box
    B.cyl(1.5, 0.3, 2.2, SEAW, sx, top + 0.7, sz, 8); B.cyl(1.5, 1.5, 3, shade(SEAW, 1.05), sx, top + 3.3, sz, 8); B.cyl(0, 1.8, 2.2, 0x8c6a4a, sx, top + 5.9, sz, 8);
    for (let k = 0; k < 10; k++) { const a = out + (rnd() - 0.5) * 2.6, d = r + 2 + rnd() * 3.5, rr = 0.9 + rnd() * 1.2; B.add(ROCK, shade(0x9a9180, 0.7 + rnd() * 0.35), new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)).setPosition(x + Math.sin(a) * d, -0.6 + rnd() * 1.2, z + Math.cos(a) * d).scale(new THREE.Vector3(rr * 1.3, rr * 0.8, rr))); }
  }
}
// a small lateen-rigged coaster lying at a quay
export function tartane(B, x, z, ry, seed = 1) {
  const rnd = mulberry(seed), hull = [0x5d4630, 0x3c3a36, 0x6a3a26][seed % 3];
  B.at(x, 0, z, ry, () => {
    const rr = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8, hw = 2.3 * Math.sin(Math.PI * (0.06 + u * 0.88)) ** 0.55, zz = (u - 0.5) * 17, sh = 1.6 + Math.abs(u - 0.5) * 1.4; rr.push([[-hw, sh, zz], [-hw * 0.8, -0.2, zz], [0, -1, zz], [hw * 0.8, -0.2, zz], [hw, sh, zz]]); }
    B.loft(rr, [hull, shade(hull, 0.7), shade(hull, 0.7), hull]);
    B.box(4, 0.15, 15, PLANK, 0, 1.6, 0);
    B.bar([0, 1.6, 2.5], [0, 14, 2.9], 0.22, WOOD, 5); // the mast, raked forward
    B.bar([0, 13, 8], [0, 7, -6], 0.12, WOOD, 4); // the lateen yard, sail furled along it
    B.bar([0.1, 12.4, 6.6], [0.1, 7.6, -4.6], 0.32, 0xe0d4b4, 5);
    B.bar([0, 1.8, 8.5], [0, 2.6, 11.5], 0.12, WOOD, 4); // bowsprit
    for (let k = 0; k < 3; k++) (k % 2 ? barrel : (B2, a, b, c) => crate(B2, a, b, c, 1.3, rnd()))(B, (rnd() - 0.5) * 2, 1.7, -5 + k * 2.6);
  });
}
// a timber crane on a quay, its jib out over the water
export function crane(B, x, y, z, ry) {
  B.at(x, y, z, ry, () => {
    B.box(3, 0.6, 3, WOOD, 0, 0.3, 0); B.bar([0, 0.6, 0], [0, 9, 0], 0.35, WOOD, 6);
    B.bar([0, 8.5, -1.5], [0, 11, 7], 0.25, WOOD, 5); B.bar([0, 3, 0], [0, 8.5, 5], 0.18, WOOD, 4);
    B.bar([0, 11, 7], [0, 5, 7], 0.04, 0x222222, 3); B.box(1.2, 0.8, 1.2, 0x9a7a4a, 0, 4.6, 7);
    B.cyl(1.4, 1.4, 1, PLANK, 0, 2, -1.6, 8, 0, 0, Math.PI / 2);
  });
}
// a lighthouse on a mole: a square stone tower with a gallery and a lit lantern
export function lantern(B, G, x, y, z, h = 20) {
  B.box(6, h, 6, 0xd8c8a6, x, y + h / 2, z); B.box(7.4, 0.6, 7.4, shade(0xd8c8a6, 0.85), x, y + h * 0.55, z);
  B.box(8, 0.7, 8, shade(0xd8c8a6, 0.8), x, y + h + 0.35, z);
  for (const [dx, dz] of [[-3.7, 0], [3.7, 0], [0, -3.7], [0, 3.7]]) B.box(dx ? 0.3 : 7.6, 1, dz ? 0.3 : 7.6, IRON, x + dx, y + h + 1.2, z + dz);
  G.cyl(1.9, 1.9, 3.2, 0xfff0b0, x, y + h + 2.3, z, 8);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.bar([x + Math.sin(a) * 2, y + h + 0.7, z + Math.cos(a) * 2], [x + Math.sin(a) * 2, y + h + 3.9, z + Math.cos(a) * 2], 0.1, IRON, 3); }
  B.cyl(0, 2.6, 2.2, 0x45484f, x, y + h + 5, z, 8); B.cyl(0.3, 0.3, 1.4, IRON, x, y + h + 6.6, z, 4);
  for (let k = 0; k < 3; k++) G.box(0.6, 1.2, 0.1, 0xffd98a, x, y + 5 + k * 5, z - 3.05);
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

// a hull hove down on a beach for scraping: heeled over on her side, masts struck to stumps, tackles to the shore
export function careened(B, x, z, ry, heel = 0.5) {
  B.at(x, 0.4, z, ry, () => {
    const old = B.base; B.base = old.clone().multiply(xf(0, 0, 0, 0, 0, -heel)); if (B.twin) B.twin.base = B.base;
    const rr = [], hull = 0x4a3a2c;
    for (let k = 0; k <= 10; k++) { const u = k / 10, hw = 3.4 * Math.sin(Math.PI * (0.05 + u * 0.9)) ** 0.5, zz = (u - 0.5) * 26, sh = 2.6 + Math.abs(u - 0.5) * 1.6; rr.push([[-hw, sh, zz], [-hw * 0.85, -0.6, zz], [0, -1.8, zz], [hw * 0.85, -0.6, zz], [hw, sh, zz]]); }
    B.loft(rr, [hull, 0x6b5a3a, 0x6b5a3a, hull]); // the bottom she shows is foul with weed
    B.box(6, 0.2, 22, PLANK, 0, 2.4, 0);
    for (const mz of [5, -4]) B.bar([0, 2.4, mz], [0, 9, mz], 0.3, WOOD, 5);
    B.base = old; if (B.twin) B.twin.base = old;
    for (const mz of [5, -4]) B.bar([-8.5 * Math.sin(heel), 8.5 * Math.cos(heel), mz], [-22, 0.6, mz * 1.3], 0.06, 0x2a2218, 3);
    for (const mz of [5, -4]) B.cyl(0.35, 0.35, 2.2, WOOD, -22, 1, mz * 1.3, 5); // the posts the tackles are made fast to
  });
}
// a camp of tents on the shore
export function tents(B, ground, x, z, n = 5, rnd = Math.random) {
  for (let i = 0; i < n; i++) { const tx = x + (rnd() - 0.5) * 34, tz = z + (rnd() - 0.5) * 16, y = ground(tx, tz); if (y > 1) B.cyl(0, 3.4, 3.8, i % 3 ? 0xe2d6b8 : 0x9a3a2a, tx, y + 1.8, tz, 7); }
}

// ---------- a city under siege ----------
// smoke standing over a fire: puffs stacked and drifting downwind, in one translucent mesh
const SMOKE = new THREE.MeshLambertMaterial({ color: 0x2b2826, transparent: true, opacity: 0.32, depthWrite: false, flatShading: true });
export function smoke(group, x, y, z, h = 90, lean = [0.35, 0.1], seed = 1, size = 1) {
  const rnd = mulberry(seed), S = new Batch(), blob = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 26; i++) {
    const k = Math.pow(i / 25, 0.8), r = (4 + k * 26 + rnd() * 6) * size, yy = y + 2 + k * h + (rnd() - 0.5) * 8 * size, d = k * k * h, sp = (4 + k * 22) * size;
    S.add(blob, 0xffffff, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)).setPosition(x + lean[0] * d + (rnd() - 0.5) * sp, yy, z + lean[1] * d + (rnd() - 0.5) * sp).scale(new THREE.Vector3(r, r * (0.6 + rnd() * 0.3), r * (0.8 + rnd() * 0.4))));
  }
  const m = S.mesh(SMOKE); m.renderOrder = 4; group.add(m);
}
// a burning house: glowing windows and flames through the roof (G is the lit batch)
export function blaze(B, G, x, y, z, s = 1, rnd = Math.random) {
  B.box(8 * s, 6 * s, 7 * s, 0x3a302a, x, y + 3 * s, z);
  for (let i = 0; i < 4; i++) G.add(new THREE.ConeGeometry(1.8 * s, (5 + rnd() * 5) * s, 5), i % 2 ? 0xff8a2a : 0xffc04a, new THREE.Matrix4().makeTranslation(x + (rnd() - 0.5) * 6 * s, y + (8.5 + rnd() * 2) * s, z + (rnd() - 0.5) * 5 * s));
  for (const sd of [-1, 1]) G.box(5 * s, 2 * s, 0.2, 0xff7a20, x, y + 3 * s, z + sd * 3.55 * s);
}
// a palazzo: a tall block with an arcade on the ground floor, rows of windows and a flat parapet
export function palazzo(B, G, w, h, d, wall, glass) {
  B.box(w, h + 3, d, wall, 0, (h - 3) / 2, 0);
  B.box(w + 0.6, 0.6, d + 0.6, shade(wall, 0.8), 0, h + 0.3, 0);
  B.box(w * 0.9, 1.6, d * 0.9, 0x9a5a3a, 0, h + 0.8, 0);
  const n = Math.max(2, Math.round(w / 3.4));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    B.box(2.2, 3.6, 0.3, 0x2a2218, x, 1.8, d / 2 + 0.05); // arcade
    for (let r = 1; r < Math.floor(h / 3.3); r++) G.box(1.0, 1.6, 0.15, glass, x, 1.6 + r * 3.3, d / 2 + 0.05);
  }
}
// a basilica: nave, aisles, a dome over the crossing and a campanile beside it
export function basilica(B, x, y, z, ry, k = 1, col = 0xe8dcc4) {
  B.at(x, y, z, ry, () => {
    B.box(16 * k, 15 * k, 44 * k, col, 0, 7.5 * k - 2, 0);
    for (const s of [-1, 1]) { B.box(7 * k, 9 * k, 40 * k, shade(col, 0.92), s * 11 * k, 4.5 * k - 2, 0); B.quad([s * 8 * k, 13 * k - 2, -22 * k], [s * 8 * k, 13 * k - 2, 22 * k], [0, 19 * k - 2, 22 * k], [0, 19 * k - 2, -22 * k], 0x9a5a3a); }
    B.tri([-8 * k, 13 * k - 2, 22.02 * k], [8 * k, 13 * k - 2, 22.02 * k], [0, 19 * k - 2, 22.02 * k], col);
    B.add(new THREE.SphereGeometry(9 * k, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), 0x6f7f88, new THREE.Matrix4().makeTranslation(0, 20 * k - 2, -6 * k));
    B.cyl(9.2 * k, 9.2 * k, 5 * k, col, 0, 17 * k - 2, -6 * k, 14);
    B.cyl(0, 1.2 * k, 3 * k, 0xd8b04a, 0, 30 * k - 2, -6 * k, 6);
    B.box(4 * k, 6 * k, 0.4, 0x2a2218, 0, 3 * k - 2, 22.1 * k);
  });
  campanile(B, x + Math.cos(ry) * 18 * k + Math.sin(ry) * 14 * k, y, z - Math.sin(ry) * 18 * k + Math.cos(ry) * 14 * k, 46 * k, 0xe0d0b0, 1.9 * k);
}
