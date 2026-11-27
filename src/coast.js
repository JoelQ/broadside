import * as THREE from 'three';
import { Batch, mulberry, clamp } from './geo.js';
import { groundColour, palm, tree, boulder } from './land.js';
import { coastLand, hash } from './shore.js';

// Coastlines drawn: the land of a coast (see shore.js, which works out its shape, its heights and what ships hit) as
// one mesh, with trees and rocks on it. The mesh follows the same height grid as the ground lookup, so shot meets
// exactly the land you see.
export { roughen, Shape, molePieces, smoothPath, segDist, makeShoal, oval, ribbon, coastLand } from './shore.js';

const SNOW = new THREE.Color(0xf4f2ec), BARE = new THREE.Color(0x9a948a);

// a coast's land and its mesh: { mesh, shape, ground, height, pieces }
export function makeCoast(def) { return coastMesh(coastLand(def), def); }
export function coastMesh(land, def) {
  const { shape, ground } = land, { x0, z0, nx, nz, C, F, cy, fine, fineH, H } = land.grid;
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
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const f = fine[j * nx + i];
    if (!f) continue;
    const X = x0 + i * C, Z = z0 + j * C;
    if (f === 1) {
      const a = [X, cyAt(i, j), Z], b = [X + C, cyAt(i + 1, j), Z], c = [X + C, cyAt(i + 1, j + 1), Z + C], d = [X, cyAt(i, j + 1), Z + C];
      if ((i + j) % 2) { face(a, c, b); face(a, d, c); } else { face(a, d, b); face(b, d, c); }
      continue;
    }
    const ys = fineH.get(j * nx + i), s = C / F;
    for (let v = 0; v < F; v++) for (let u = 0; u < F; u++) {
      const P = (uu, vv) => [X + uu * s, ys[vv * (F + 1) + uu], Z + vv * s];
      const a = P(u, v), b = P(u + 1, v), c = P(u + 1, v + 1), d = P(u, v + 1);
      if ((u + v) % 2) { face(a, c, b); face(a, d, c); } else { face(a, d, b); face(b, d, c); }
    }
  }
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
  return { ...land, mesh };
}
