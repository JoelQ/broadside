import * as THREE from 'three';
import { Batch, mulberry, clamp } from './geo.js';
import { groundColour, palm, tree, boulder } from './land.js';

// Coastlines: land drawn as a shape rather than a circle. A coast is a closed outline of authored
// points, roughened into an irregular shore, from which three things are made that always agree:
//   - a height field (beach, then hills rising inland), drawn as one mesh,
//   - a chain of circles inscribed along the shore, which is what ships run into,
//   - a ground(x, z) lookup, which is what shot hits and the camera stays above.
// A mole is a stone breakwater along a path: a strip of masonry with the same three things.
// Nothing here is a new rule: land stops ships and shot exactly as an island always has.

const SNOW = new THREE.Color(0xf4f2ec), BARE = new THREE.Color(0x9a948a);
const CELL = 40, CAP = 160; // segment grid cell; distance inland beyond which the shore no longer matters

// ---------- outline ----------
// points: [[x, z, rough?], ...] in order around the land. rough (yards) is how far the shore may wander
// from the line between authored points; 0 keeps a stretch straight (a quay, a castle's footing).
export function roughen(points, rough = 14, seed = 1, step = 9) {
  const rnd = mulberry(seed), ph = [rnd() * 99, rnd() * 99, rnd() * 99, rnd() * 99], out = [];
  let s = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], ra = a[2] ?? rough, rb = b[2] ?? rough;
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), k = Math.max(1, Math.round(len / step));
    const nx = dz / (len || 1), nz = -dx / (len || 1);
    for (let j = 0; j < k; j++) {
      const t = j / k, r = ra + (rb - ra) * t, at = s + len * t;
      const w = 0.55 * Math.sin(at / 41 + ph[0]) + 0.3 * Math.sin(at / 19 + ph[1]) + 0.15 * Math.sin(at / 8.3 + ph[2]) + 0.08 * Math.sin(at / 3.7 + ph[3]);
      out.push([a[0] + dx * t + nx * w * r, a[1] + dz * t + nz * w * r]);
    }
    s += len;
  }
  return out;
}
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };

// Signed distance to a closed outline, positive inside, capped at CAP. Segments are binned in a grid
// so a query only looks at the shore near it; far from any shore, a coarse inside test decides.
export class Shape {
  constructor(pts) {
    if (area(pts) < 0) pts = pts.slice().reverse();
    this.pts = pts; this.n = pts.length; this.grid = new Map();
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
    this.box = [x0, z0, x1, z1];
    for (let i = 0; i < this.n; i++) {
      const a = pts[i], b = pts[(i + 1) % this.n];
      const gx0 = Math.floor(Math.min(a[0], b[0]) / CELL), gx1 = Math.floor(Math.max(a[0], b[0]) / CELL), gz0 = Math.floor(Math.min(a[1], b[1]) / CELL), gz1 = Math.floor(Math.max(a[1], b[1]) / CELL);
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const k = gx * 100003 + gz; let c = this.grid.get(k); if (!c) this.grid.set(k, (c = [])); c.push(i); }
    }
  }
  inside(x, z) { // even-odd ray test against every edge: only used far from the shore
    let c = false; const p = this.pts;
    for (let i = 0, j = this.n - 1; i < this.n; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  }
  sdf(x, z) {
    const p = this.pts, gx = Math.floor(x / CELL), gz = Math.floor(z / CELL), R = Math.ceil(CAP / CELL);
    let best = CAP * CAP, bi = -1, bt = 0;
    const seen = new Set();
    for (let ox = -R; ox <= R; ox++) for (let oz = -R; oz <= R; oz++) {
      const c = this.grid.get((gx + ox) * 100003 + gz + oz);
      if (!c) continue;
      for (const i of c) {
        if (seen.has(i)) continue; seen.add(i);
        const a = p[i], b = p[(i + 1) % this.n], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1), ex = a[0] + dx * t - x, ez = a[1] + dz * t - z, d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; bi = i; bt = t; }
      }
    }
    if (bi < 0) return this.inside(x, z) ? CAP : -CAP;
    // which side: the nearest segment's own side, or at a corner the side of both segments that meet there
    const side = (i) => { const a = p[i], b = p[(i + 1) % this.n]; return (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); };
    let s = side(bi);
    if (bt <= 0 || bt >= 1) { const j = bt <= 0 ? (bi - 1 + this.n) % this.n : (bi + 1) % this.n, s2 = side(j); const a = p[bt <= 0 ? bi : j], q = p[(bt <= 0 ? j : bi)], r = p[(bt <= 0 ? bi + 1 : j + 1) % this.n]; const convex = (a[0] - q[0]) * (r[1] - a[1]) - (a[1] - q[1]) * (r[0] - a[0]) > 0; s = convex ? Math.min(s, s2) : Math.max(s, s2); }
    const d = Math.sqrt(best);
    return s > 0 ? d : -d;
  }
}

// value noise, for hills
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), f = x - i, g = z - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; };
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.28 + vnoise(x * 4.3 + 9.1, z * 4.3 + 7.7) * 0.17;

// ---------- a coast ----------
// def: { outline: [[x, z, rough?]...], rough, seed, H (hill height), rise (yards inland to reach it), beach (yards of sand),
//        scale (yards per hill), shape(x, z, y) -> y (flatten a town), clear(x, z) (no trees), trees (density), dry (0-1, a summer-burnt palette),
//        snow (height above which the peaks are white), extent (how far from the centre the land is drawn), tint(x, z, colour, y, level) (recolour, in place) }
export function makeCoast(def) {
  const shape = new Shape(roughen(def.outline, def.rough ?? 14, def.seed || 7));
  const H = def.H ?? 30, rise = def.rise ?? 70, beach = def.beach ?? 9, sc = def.scale ?? 150, ph = (def.seed || 7) * 13.37;
  const raw = (x, z, d) => {
    if (d < 0) return Math.max(-14, -1.6 + d * 0.3);
    if (d < beach) return -1.6 + (d / beach) * 3.4;
    const hill = 0.45 + 0.75 * fbm(x / sc + ph, z / sc - ph);
    return 1.8 + (H - 1.8) * (1 - Math.exp(-(d - beach) / rise)) * hill;
  };
  const height = (x, z) => { const y = raw(x, z, shape.sdf(x, z)); return def.shape ? def.shape(x, z, y) : y; };

  // mesh: a coarse grid, each cell near the shore split finer; edges next to a coarse cell follow it, so there are no cracks
  const [bx0, bz0, bx1, bz1] = shape.box, lim = def.extent ?? 1700, C = 24, F = 3;
  const x0 = Math.max(bx0 - 20, -lim), z0 = Math.max(bz0 - 20, -lim), nx = Math.ceil((Math.min(bx1 + 20, lim) - x0) / C), nz = Math.ceil((Math.min(bz1 + 20, lim) - z0) / C);
  const cd = new Float32Array((nx + 1) * (nz + 1)), cy = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * C, z = z0 + j * C, d = shape.sdf(x, z); cd[j * (nx + 1) + i] = d; const y = raw(x, z, d); cy[j * (nx + 1) + i] = def.shape ? def.shape(x, z, y) : y; }
  const fine = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = [cd[j * (nx + 1) + i], cd[j * (nx + 1) + i + 1], cd[(j + 1) * (nx + 1) + i], cd[(j + 1) * (nx + 1) + i + 1]];
    const cx = x0 + (i + 0.5) * C, cz = z0 + (j + 0.5) * C, near = Math.hypot(cx, cz) < (def.fineR ?? 1250);
    fine[j * nx + i] = Math.max(...k) < -30 ? 0 : (near && Math.min(...k.map(Math.abs)) < 60) || (near && def.fineAt && def.fineAt(cx, cz)) || (Math.min(...k) < 0 && Math.max(...k) > 0) ? 2 : 1;
  }
  const B = new Batch();
  const face = (a, b, c) => {
    if (Math.max(a[1], b[1], c[1]) < -1.5) return;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx_ = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz_ = ux * vy - uy * vx, up = Math.abs(ny) / (Math.hypot(nx_, ny, nz_) || 1);
    const y = (a[1] + b[1] + c[1]) / 3, col = groundColour(y, up, hash(a[0] + c[0], a[2] + b[2]), H, def.dry || 0);
    if (def.snow && y > def.snow * 0.4) col.lerp(BARE, clamp((y - def.snow * 0.4) / (def.snow * 0.5), 0, 1) * 0.7); // the high ground bare limestone
    if (def.snow && y > def.snow) col.lerp(SNOW, clamp((y - def.snow) / 60 + hash(a[2], c[0]) * 0.4 - 0.2, 0, 1) * (up > 0.55 ? 0.95 : 0.55)); // snow lies on the peaks, thinner on the crags
    if (def.tint && y > 1.2) def.tint((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, col, y, up); // a town's streets and yards
    B.tri(a, b, c, col);
  };
  const cyAt = (i, j) => cy[j * (nx + 1) + i];
  const fineH = new Map(); // fine heights, kept for ground()
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const f = fine[j * nx + i];
    if (!f) continue;
    const X = x0 + i * C, Z = z0 + j * C;
    if (f === 1) {
      const a = [X, cyAt(i, j), Z], b = [X + C, cyAt(i + 1, j), Z], c = [X + C, cyAt(i + 1, j + 1), Z + C], d = [X, cyAt(i, j + 1), Z + C];
      if ((i + j) % 2) { face(a, c, b); face(a, d, c); } else { face(a, d, b); face(b, d, c); }
      continue;
    }
    const coarseN = (di, dj) => { const ii = i + di, jj = j + dj; return ii < 0 || jj < 0 || ii >= nx || jj >= nz || fine[jj * nx + ii] < 2; };
    const left = coarseN(-1, 0), right = coarseN(1, 0), down = coarseN(0, -1), upN = coarseN(0, 1), s = C / F, ys = [];
    for (let v = 0; v <= F; v++) for (let u = 0; u <= F; u++) {
      let y;
      const lerp = (p, q, t) => p + (q - p) * t;
      if (v === 0 && down) y = lerp(cyAt(i, j), cyAt(i + 1, j), u / F);
      else if (v === F && upN) y = lerp(cyAt(i, j + 1), cyAt(i + 1, j + 1), u / F);
      else if (u === 0 && left) y = lerp(cyAt(i, j), cyAt(i, j + 1), v / F);
      else if (u === F && right) y = lerp(cyAt(i + 1, j), cyAt(i + 1, j + 1), v / F);
      else if ((u === 0 || u === F) && (v === 0 || v === F)) y = cyAt(i + u / F, j + v / F);
      else y = height(X + u * s, Z + v * s);
      ys.push(y);
    }
    fineH.set(j * nx + i, ys);
    for (let v = 0; v < F; v++) for (let u = 0; u < F; u++) {
      const P = (uu, vv) => [X + uu * s, ys[vv * (F + 1) + uu], Z + vv * s];
      const a = P(u, v), b = P(u + 1, v), c = P(u + 1, v + 1), d = P(u, v + 1);
      if ((u + v) % 2) { face(a, c, b); face(a, d, c); } else { face(a, d, b); face(b, d, c); }
    }
  }
  // ground lookup that matches the mesh exactly
  const ground = (x, z) => {
    const u = (x - x0) / C, v = (z - z0) / C, i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return -20;
    const ys = fineH.get(j * nx + i);
    let fu = u - i, fv = v - j, a, b, c, d;
    if (ys) { const uu = Math.min(F - 1, Math.floor(fu * F)), vv = Math.min(F - 1, Math.floor(fv * F)); a = ys[vv * (F + 1) + uu]; b = ys[vv * (F + 1) + uu + 1]; c = ys[(vv + 1) * (F + 1) + uu]; d = ys[(vv + 1) * (F + 1) + uu + 1]; fu = fu * F - uu; fv = fv * F - vv; }
    else { a = cyAt(i, j); b = cyAt(i + 1, j); c = cyAt(i, j + 1); d = cyAt(i + 1, j + 1); }
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv - 0.6;
  };
  // trees and rocks, sparser far from the water
  const rn = mulberry((def.seed || 7) * 7919 + 3), want = def.trees ?? 1;
  if (want > 0) for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) {
    if (!fine[j * nx + i]) continue;
    const X = x0 + (i + rn()) * C, Z = z0 + (j + rn()) * C, far = Math.hypot(X, Z) > 1300;
    if (rn() > want * (far ? 0.012 : 0.06)) continue;
    const y = ground(X, Z) + 0.6;
    if (y < 1.6 || (def.clear && def.clear(X, Z))) continue;
    const sl = Math.hypot(ground(X + 1.5, Z) - ground(X - 1.5, Z), ground(X, Z + 1.5) - ground(X, Z - 1.5)) / 3;
    if (y < 5 && sl < 0.5 && !def.dry) palm(B, X, y, Z, 5.5 + rn() * 3.5, rn);
    else if (sl < 0.8 && y < H * 0.85) { tree(B, X, y, Z, 0.9 + rn() * 1.0, rn); if (rn() < 0.5) tree(B, X + (rn() - 0.5) * 9, ground(X, Z) + 0.6, Z + (rn() - 0.5) * 9, 0.8 + rn() * 0.7, rn); }
    else if (rn() < 0.5) boulder(B, X, y, Z, 1.2 + rn() * 2, rn);
  }
  // rocks along the shore
  for (let i = 0; i < shape.n; i += 3) {
    if (rn() > 0.18) continue;
    const p = shape.pts[i];
    if (Math.hypot(p[0], p[1]) > 1300 || (def.clear && def.clear(p[0], p[1]))) continue;
    boulder(B, p[0] + (rn() - 0.5) * 6, -0.2 + rn() * 0.6, p[1] + (rn() - 0.5) * 6, 0.9 + rn() * 1.8, rn);
  }
  const mesh = B.mesh();
  mesh.position.y = -0.6;
  return { mesh, shape, ground, height: (x, z) => height(x, z) - 0.6, pieces: shorePieces(shape, def.pieceR ?? 32) };
}

// Circles inscribed along the shore, every few yards: together they are the edge a ship runs into.
// Each is the largest circle that touches the shore at that point and stays on land.
function shorePieces(shape, R, far = 1150) {
  const out = [], p = shape.pts;
  for (let i = 0; i < shape.n; i++) {
    const a = p[i];
    if (Math.hypot(a[0], a[1]) > far) continue;
    const prev = p[(i - 1 + shape.n) % shape.n], next = p[(i + 1) % shape.n], tx = next[0] - prev[0], tz = next[1] - prev[1], tl = Math.hypot(tx, tz) || 1;
    const ix = -tz / tl, iz = tx / tl; // inward (the outline runs anticlockwise)
    let lo = 1.5, hi = R;
    for (let k = 0; k < 10; k++) { const r = (lo + hi) / 2; if (shape.sdf(a[0] + ix * r, a[1] + iz * r) >= r * 0.97) lo = r; else hi = r; }
    if (lo > 2) out.push({ x: a[0] + ix * lo, z: a[1] + iz * lo, r: lo });
  }
  return out;
}

// ---------- a mole ----------
// path: [[x, z], ...]; w: width; top: height of the walkway. Returns circles along it and a ground lookup.
export function molePieces(path, w) {
  const out = [], r = w / 2;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / (r * 0.7)));
    for (let j = 0; j <= k; j++) out.push({ x: a[0] + ((b[0] - a[0]) * j) / k, z: a[1] + ((b[1] - a[1]) * j) / k, r });
  }
  return out;
}
// a path through the given points, rounded at the corners (Catmull-Rom), in steps of about `step` yards
export function smoothPath(pts, step = 12) {
  const out = [], P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
export function segDist(path, x, z) {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
  }
  return best;
}

// ---------- a shoal ----------
// A bank or a reef drawn as a shape, the way a coast is: def { outline: [[x, z, rough?], ...], depth, rough?, seed? }.
// The outline is roughened into a ragged edge; a ship that draws more than `depth` sticks anywhere inside it.
// A depth under 2 is a reef, which grounds anything. Returns plain numbers and the shape, so tools can use it:
//   at(x, z): how far inside the bank a point is (negative outside), cheap far from it
//   x, z: the point furthest inside, where the soundings are written; inner: how far inside that is
//   pieces: circles inscribed along the edge, which the AI steers round as it does a coast
export function makeShoal(def) {
  if (def.shape) return def; // already made
  if (!def.outline) throw new Error('a shoal is a shape: give it an outline (see makeShoal in coast.js)');
  const o = def.outline, seed = def.seed ?? (Math.abs(Math.round(o[0][0] * 7 + o[0][1] * 13)) % 9973) + 1;
  const shape = new Shape(roughen(o, def.rough ?? 8, seed, 6)), [x0, z0, x1, z1] = shape.box;
  const at = (x, z) => {
    const ox = Math.max(x0 - x, x - x1, 0), oz = Math.max(z0 - z, z - z1, 0);
    return ox || oz ? Math.min(-Math.hypot(ox, oz), shape.sdf(x, z)) : shape.sdf(x, z);
  };
  let inner = -1e9, lx = (x0 + x1) / 2, lz = (z0 + z1) / 2;
  const st = Math.max(3, Math.min(x1 - x0, z1 - z0) / 14);
  for (let x = x0 + st / 2; x < x1; x += st) for (let z = z0 + st / 2; z < z1; z += st) { const d = shape.sdf(x, z); if (d > inner) { inner = d; lx = x; lz = z; } }
  return { depth: def.depth, shape, box: shape.box, at, x: lx, z: lz, inner, area: Math.abs(area(shape.pts)), pieces: shorePieces(shape, 30, 1e9), name: def.name };
}
// an outline for a small rock or bank: centre, half-length, half-width, and the heading its length lies along
// (0 runs north-south, as a ship's heading does). The roughening makes it ragged; author anything bigger by hand.
export function oval(x, z, a, b, ang = 0, n = 9) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2, u = Math.cos(t) * a, v = Math.sin(t) * b; return [Math.round(x + u * s + v * c), Math.round(z + u * c - v * s)]; });
}
// an outline round a spine, for a spit, a bar or a reef running off a point: [[x, z, half-width], ...] from one
// end to the other, with rounded ends. Most banks are this: a line the sea has laid down, wider in places.
export function ribbon(spine) {
  const n = spine.length, L = [], R = [], cap = (p, ux, uz, w, from) => { const out = []; for (let k = 1; k < 4; k++) { const a = from + (k / 4) * Math.PI, c = Math.cos(a), s = Math.sin(a); out.push([Math.round(p[0] + (ux * c - uz * s) * w), Math.round(p[1] + (uz * c + ux * s) * w)]); } return out.reverse(); };
  const dir = (i) => { const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  for (let i = 0; i < n; i++) { const [x, z, w] = spine[i], [ux, uz] = dir(i); L.push([Math.round(x - uz * w), Math.round(z + ux * w)]); R.push([Math.round(x + uz * w), Math.round(z - ux * w)]); }
  const [ex, ez] = dir(n - 1), [sx, sz] = dir(0);
  // the caps turn from the left side round the end to the right side
  return [...L, ...cap(spine[n - 1], -ez, ex, spine[n - 1][2], -Math.PI), ...R.reverse(), ...cap(spine[0], ez, -ex, spine[0][2], -Math.PI)];
}
