import * as THREE from 'three';
import { Batch, mulberry, clamp } from './geo.js';

// Islands: a seeded height field, coloured by height and slope, with trees and rocks on it.
const SAND = 0xd8c690, WET = 0xb9a877, ROCK = 0x77716a, CLIFF = 0x5c554d, GRASS = 0x55813c, LUSH = 0x3f6d34, DRY = 0x8b9148;
const mix = (a, b, k, out) => out.copy(a).lerp(b, clamp(k, 0, 1));
const C = (h) => new THREE.Color(h);
const cSand = C(SAND), cWet = C(WET), cRock = C(ROCK), cCliff = C(CLIFF), cGrass = C(GRASS), cLush = C(LUSH), cDry = C(DRY), _c = C(0);
const BLOB = new THREE.DodecahedronGeometry(1, 0);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

export function palm(B, x, y, z, h, rnd) {
  const lean = rnd() * 6.28, bend = 0.5 + rnd() * 1.4, pts = [];
  for (let i = 0; i <= 4; i++) { const k = i / 4; pts.push([x + Math.sin(lean) * bend * k * k, y - 0.3 + h * k, z + Math.cos(lean) * bend * k * k]); }
  for (let i = 0; i < 4; i++) B.bar(pts[i], pts[i + 1], 0.34 - i * 0.045, i % 2 ? 0x8a6a48 : 0x7a5a3a, 5, 0.3 - i * 0.045);
  const top = pts[4], n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rnd(), ax = Math.sin(a), az = Math.cos(a), len = 3 + rnd() * 1.4, px = az * 0.55, pz = -ax * 0.55, green = i % 2 ? 0x3f8a3a : 0x357a36;
    const mid = [top[0] + ax * len * 0.55, top[1] + len * 0.22, top[2] + az * len * 0.55], tip = [top[0] + ax * len, top[1] - len * 0.38, top[2] + az * len];
    B.quad([top[0] - px * 0.5, top[1], top[2] - pz * 0.5], [top[0] + px * 0.5, top[1], top[2] + pz * 0.5], [mid[0] + px, mid[1], mid[2] + pz], [mid[0] - px, mid[1], mid[2] - pz], green);
    B.tri([mid[0] - px, mid[1], mid[2] - pz], [mid[0] + px, mid[1], mid[2] + pz], tip, green);
  }
  B.add(BLOB, 0x4a3a22, new THREE.Matrix4().makeTranslation(top[0], top[1] - 0.25, top[2]).scale(new THREE.Vector3(0.42, 0.42, 0.42)));
}
export function tree(B, x, y, z, s, rnd) {
  B.bar([x, y - 0.4, z], [x, y + 2.2 * s, z], 0.28 * s, 0x5d4630, 5, 0.18 * s);
  const n = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const r = (1.9 - i * 0.35) * s * (0.85 + rnd() * 0.3);
    B.add(BLOB, [0x3c6e32, 0x4a7d3a, 0x355f2e][Math.floor(rnd() * 3)], new THREE.Matrix4().makeRotationY(rnd() * 6).setPosition(x + (i ? (rnd() - 0.5) * 1.6 * s : 0), y + (2.6 + i * 1.1) * s, z + (i ? (rnd() - 0.5) * 1.6 * s : 0)).scale(new THREE.Vector3(r, r * 0.8, r)));
  }
}
export function boulder(B, x, y, z, s, rnd) {
  B.add(BLOB, rnd() < 0.5 ? ROCK : CLIFF, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)).setPosition(x, y, z).scale(new THREE.Vector3(s, s * 0.7, s * 1.2)));
}

// r: radius of the land, H: its height. `rnd` is drawn from exactly as the first version of the
// game drew from it, so every island still stands where the fights were balanced around it.
// opts.shape(x, z, y) may reshape the ground (the harbour flattens a shelf for its town);
// opts.clear(x, z) keeps trees off a spot; opts.soften (0-1) is how far the peaks are rounded off. Returns the mesh, with userData.height(x, z).
export function makeIsland(r, H, rnd, x, z, opts = {}) {
  const seg = 22, N = seg + 1, size = r * 2.3, cell = size / seg, hs = new Float32Array(N * N);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = -size / 2 + i * cell, pz = -size / 2 + j * cell, d = Math.hypot(px, pz) / r;
    const n = 0.55 + 0.25 * Math.sin(px * 0.21 + ph[0]) * Math.cos(pz * 0.17 + ph[1]) + 0.2 * Math.sin(px * 0.5 + pz * 0.43 + ph[2]) + (rnd() - 0.5) * 0.18;
    let y = (1 - d * d) * H * n * 1.5;
    if (d > 1) y = -3 - (d - 1) * 20;
    hs[j * N + i] = y;
    if (y >= 1.6) rnd();
  }
  // soften the peaks: each dry point leans toward its neighbours
  const soft = opts.soften ?? 0.55, raw = hs.slice(), g0 = (i, j) => Math.max(0, raw[clamp(j, 0, seg) * N + clamp(i, 0, seg)]);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (raw[j * N + i] > 0) hs[j * N + i] = raw[j * N + i] * (1 - soft) + (g0(i - 1, j) + g0(i + 1, j) + g0(i, j - 1) + g0(i, j + 1)) * soft * 0.25;
  // smooth surface through the coarse grid, with a little roughness on dry land
  const at = (i, j) => hs[clamp(j, 0, seg) * N + clamp(i, 0, seg)];
  const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  const rough = Math.min(cell * 0.1, 1.2);
  const height = (lx, lz) => {
    const u = (lx + size / 2) / cell, v = (lz + size / 2) / cell, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const row = (jj) => cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), fu);
    let y = cr(row(j - 1), row(j), row(j + 1), row(j + 2), fv);
    if (y > 0.8) y += (hash(Math.round(lx * 3), Math.round(lz * 3)) - 0.5) * rough * Math.min(1, (y - 0.8) / 3);
    return opts.shape ? opts.shape(lx, lz, y) : y;
  };
  const M = seg * (opts.detail || 2), step = size / M, B = new Batch(), ys = new Float32Array((M + 1) * (M + 1));
  for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) ys[j * (M + 1) + i] = height(-size / 2 + i * step, -size / 2 + j * step);
  const P = (i, j) => [-size / 2 + i * step, ys[j * (M + 1) + i], -size / 2 + j * step];
  const face = (a, b, c) => {
    const top = Math.max(a[1], b[1], c[1]);
    if (top < -1.5) return; // far under water
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, up = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const y = (a[1] + b[1] + c[1]) / 3, k = hash(a[0] + c[0], a[2] + b[2]);
    if (y < 2.1) mix(cWet, cSand, (y + 0.2) / 1.2, _c).multiplyScalar(0.94 + k * 0.1);
    else if (up < 0.66) mix(cCliff, cRock, k * 1.3 + (up - 0.5), _c);
    else { mix(cLush, cGrass, y / (H * 0.55) + k * 0.5 - 0.25, _c); if (y > H * 0.62) mix(_c, cDry, (y - H * 0.62) / (H * 0.3), _c); if (y < 3.2) mix(cSand, _c, (y - 2.1) / 1.1, _c); _c.multiplyScalar(0.9 + k * 0.2); }
    B.tri(a, b, c, _c);
  };
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    if ((i + j) % 2) { face(a, c, b); face(a, d, c); } else { face(a, d, b); face(b, d, c); }
  }
  // trees and rocks, from a generator of their own
  const rn = mulberry(Math.floor(ph[0] * 1e6) + 17), want = Math.min(260, Math.round(r * r * 0.016 * (opts.trees ?? 1)));
  const slope = (lx, lz) => Math.hypot(height(lx + 1, lz) - height(lx - 1, lz), height(lx, lz + 1) - height(lx, lz - 1)) / 2;
  for (let i = 0, placed = 0; i < want * 6 && placed < want; i++) {
    const a = rn() * 6.28, d = Math.sqrt(rn()) * r * 0.97, lx = Math.sin(a) * d, lz = Math.cos(a) * d, y = height(lx, lz);
    if (y < 1.4 || (opts.clear && opts.clear(lx, lz))) continue;
    const sl = slope(lx, lz);
    if (y < 6.5 && sl < 0.6) palm(B, lx, y, lz, 5.5 + rn() * 4, rn);
    else if (sl < 0.75 && y < H * 0.8) tree(B, lx, y, lz, 0.9 + rn() * 0.9, rn);
    else if (rn() < 0.4 && y < H * 0.5) boulder(B, lx, y, lz, 1 + rn() * 1.6, rn);
    else continue;
    placed++;
  }
  for (let i = 0, n = Math.round(4 + r * 0.12); i < n; i++) {
    const a = rn() * 6.28, d = r * (0.9 + rn() * 0.12), lx = Math.sin(a) * d, lz = Math.cos(a) * d, y = height(lx, lz);
    if (y > -2.2 && y < 1.6 && !(opts.clear && opts.clear(lx, lz))) boulder(B, lx, y + 0.2, lz, 0.9 + rn() * 1.8, rn);
  }
  const m = B.mesh();
  m.position.set(x, -0.6, z);
  m.userData.height = (wx, wz) => height(wx - x, wz - z) - 0.6;
  return m;
}
