import * as THREE from 'three';
import { Batch, GLOW, shade, mulberry, wrap } from './geo.js';
import { makeIsland, palm, tree } from './land.js';
import { Figures } from './crew.js';

// Port Halcyon: the home harbour. Built once, shown on the title screen and between fights.
const STONE = 0x8d8676, WOOD = 0x6b4a2c, DARK = 0x3a2412, IRON = 0x1c1c1e, LAMP = 0xffd98a, PLANK = 0x8a6a44, ROPE = 0xb09a6a, CRATE = 0x9a7a4a;
const QY = 2.2; // top of the quay

// a gabled roof over a w x d footprint whose eaves sit at height y; the ridge runs along x unless `front`
function roof(B, w, d, y, rh, colour, wall, front) {
  const ov = 0.55, a = front ? d / 2 + ov : w / 2 + ov, b = front ? w / 2 : d / 2;
  const p = (along, across, up) => (front ? [across, y + up, along] : [along, y + up, across]);
  for (const s of [-1, 1]) {
    B.quad(p(-a, s * (b + ov), -0.25), p(a, s * (b + ov), -0.25), p(a, 0, rh), p(-a, 0, rh), s > 0 ? colour : shade(colour, 0.86));
    B.tri(p(s * (a - ov), -b, 0), p(s * (a - ov), b, 0), p(s * (a - ov), 0, rh * (b / (b + ov))), wall);
  }
}
function house(B, G, w, h, d, wall, roofCol, o = {}) {
  const rows = o.rows || 1, door = o.door !== false, trim = o.trim || shade(roofCol, 0.75), n = Math.max(2, Math.round(w / 3)), mid = Math.floor(n / 2);
  B.box(w + 0.4, 4.5, d + 0.4, shade(STONE, 0.85), 0, -1.75, 0); // footing, deep enough for a slope
  B.box(w, h, d, wall, 0, h / 2, 0);
  const rh = (o.front ? w : d) * 0.36 + 0.8;
  roof(B, w, d, h, rh, roofCol, wall, o.front);
  if (o.chimney !== false) { B.box(0.9, rh + 1.2, 0.9, shade(STONE, 0.95), w * 0.28, h + rh * 0.55, -d * 0.18); B.box(1.1, 0.2, 1.1, DARK, w * 0.28, h + rh * 1.05 + 0.55, -d * 0.18); }
  const win = (x, y, z, ry) => B.at(x, y, z, ry, () => {
    B.box(1.25, 1.45, 0.1, DARK, 0, 0, 0); G.box(0.95, 1.15, 0.16, LAMP, 0, 0, 0);
    B.box(1.25, 0.08, 0.2, DARK, 0, 0, 0.02); B.box(0.08, 1.45, 0.2, DARK, 0, 0, 0.02);
    B.box(1.5, 0.12, 0.3, STONE, 0, -0.78, 0.06);
    for (const s of [-1, 1]) B.box(0.4, 1.45, 0.08, trim, s * 0.85, 0, 0.03);
  });
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < n; i++) if (!(door && r === 0 && i === mid)) win(-w / 2 + (w * (i + 0.5)) / n, 2.1 + r * 2.9, d / 2, 0);
    for (const s of [-1, 1]) win(s * w / 2, 2.1 + r * 2.9, 0, s * Math.PI / 2);
  }
  if (rows > 1) B.box(w + 0.16, 0.22, d + 0.16, trim, 0, 3.55, 0);
  if (door) {
    const x = -w / 2 + (w * (mid + 0.5)) / n;
    B.box(1.7, 2.6, 0.12, trim, x, 1.3, d / 2); B.box(1.3, 2.3, 0.2, DARK, x, 1.15, d / 2);
    B.box(2.2, 0.25, 0.9, STONE, x, 0.12, d / 2 + 0.4);
  }
}
function barrel(B, x, y, z, s = 1) { B.cyl(0.62 * s, 0.7 * s, 1.3 * s, 0x7a5632, x, y + 0.65 * s, z, 8); for (const k of [0.3, 1.0]) B.cyl(0.72 * s, 0.72 * s, 0.1 * s, IRON, x, y + k * s, z, 8); }
function crate(B, x, y, z, s, ry = 0) { B.box(s, s, s, CRATE, x, y + s / 2, z, 0, ry); B.box(s * 1.04, s * 0.14, s * 1.04, shade(CRATE, 0.75), x, y + s * 0.5, z, 0, ry); }
function lamp(B, G, x, y, z) {
  B.cyl(0.1, 0.14, 4.4, IRON, x, y + 2.2, z, 5); B.box(0.9, 0.1, 0.1, IRON, x + 0.4, y + 4.3, z);
  G.box(0.5, 0.6, 0.5, LAMP, x + 0.8, y + 3.85, z); B.cyl(0, 0.42, 0.3, IRON, x + 0.8, y + 4.3, z, 4, 0, Math.PI / 4);
}
// hanging shop sign on a bracket
function sign(B, x, y, z, colour) { B.box(0.1, 0.1, 1.9, IRON, x, y + 0.75, z + 0.9); B.box(0.12, 1.1, 1.5, colour, x, y, z + 1.0); B.box(0.16, 0.5, 0.7, 0xe8d9a8, x, y, z + 1.0); }
function rowboat(B, x, z, ry, colour) {
  B.at(x, 0.05, z, ry, () => {
    const rr = [];
    for (let k = 0; k <= 6; k++) { const u = k / 6, hw = 0.95 * Math.sin(Math.PI * (0.1 + u * 0.82)) ** 0.6, zz = (u - 0.5) * 5.4; rr.push([[-hw, 0.75, zz], [-hw * 0.75, 0.1, zz], [0, -0.25, zz], [hw * 0.75, 0.1, zz], [hw, 0.75, zz]]); }
    B.loft(rr, [colour, shade(colour, 0.7), shade(colour, 0.7), colour]);
    for (const zz of [-1.2, 0.2, 1.4]) B.box(1.6, 0.1, 0.4, PLANK, 0, 0.5, zz);
    B.bar([-0.3, 0.6, -1.6], [-0.5, 0.75, 1.9], 0.06, PLANK, 4); B.bar([0.3, 0.6, -1.6], [0.5, 0.75, 1.9], 0.06, PLANK, 4);
  });
}

export function buildHarbor() {
  const g = new THREE.Group(), G = new Batch(), B = new Batch(G), rnd = mulberry(77);
  // the hill behind the town: a shelf is cut for the quay and a gentle slope for the streets above it
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const shape = (lx, lz, y) => {
    const wz = lz - 268, k = smooth(108, 88, Math.abs(lx)) * smooth(-150, -128, wz);
    if (!k) return y;
    const town = wz > -86 ? 1.6 : 2.4 + (-86 - wz) * 0.3;
    return y + (Math.min(y, town) - y) * k;
  };
  const inTown = (lx, lz) => Math.abs(lx) < 100 && lz - 268 > -132;
  const hill = makeIsland(215, 46, rnd, 0, -268, { detail: 4, shape, trees: 1.3, soften: 0.2, clear: (lx, lz) => inTown(lx, lz) || lz < 40 });
  const point = makeIsland(26, 9, rnd, 108, 6, { clear: (lx, lz) => Math.hypot(lx, lz) < 9 });
  g.add(hill, point);
  const ground = hill.userData.height;

  // stone quay: paving, kerb stones, weed along the waterline, bollards, steps, lamps
  B.box(176, 7, 46, STONE, 0, QY - 3.5, -63);
  for (let i = 0; i < 22; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) B.box(7.9, 0.06, 7.5, shade(STONE, 0.9 + rnd() * 0.08), -84 + i * 8, QY + 0.02, -44.5 - j * 7.6);
  for (let i = 0; i < 44; i++) B.box(3.9, 0.45, 1.5, shade(STONE, 0.72 + rnd() * 0.12), -86 + i * 4, QY + 0.2, -40.8);
  B.box(176.1, 1.5, 0.1, 0x4f5a48, 0, 0.1, -39.98); B.box(176.1, 0.12, 0.1, shade(STONE, 0.7), 0, 1.3, -39.97);
  for (let x = -80; x <= 80; x += 20) if (Math.abs(x) > 5) { B.cyl(0.4, 0.5, 1.0, IRON, x, QY + 0.9, -41, 8); B.cyl(0.62, 0.62, 0.2, IRON, x, QY + 1.45, -41, 8); }
  for (let i = 0; i < 6; i++) B.box(5, 0.5, 0.9, shade(STONE, 0.8), -24, QY - 0.25 - i * 0.45, -39.6 + i * 0.8);
  for (const x of [-48, -14, 14, 48, 80]) lamp(B, G, x, QY, -43.5);

  // timber pier: planks, piles with rope between them, a light at the end
  for (let z = -39.5; z < 22; z++) B.box(6.3, 0.26, 0.9, shade(PLANK, 0.85 + rnd() * 0.22), 0, 1.87, z);
  for (const x of [-2.6, 2.6]) B.box(0.4, 0.5, 62, shade(WOOD, 0.8), x, 1.5, -9);
  const piles = [];
  for (let z = -38; z <= 22; z += 10) for (const x of [-3.2, 3.2]) { B.cyl(0.32, 0.38, 7.2, 0x4a3826, x, -0.3, z, 7); B.cyl(0.44, 0.44, 0.16, shade(WOOD, 0.6), x, 3.36, z, 7); if (x < 0) piles.push(z); }
  for (let i = 0; i < piles.length - 1; i++) { const z0 = piles[i], z1 = piles[i + 1], m = [-3.2, 2.55, (z0 + z1) / 2]; B.bar([-3.2, 3.1, z0], m, 0.06, ROPE, 4).bar(m, [-3.2, 3.1, z1], 0.06, ROPE, 4); }
  lamp(B, G, -2.4, 2, 21);
  crate(B, -1.6, 2, 15, 1.4, 0.3); crate(B, -1.5, 2, 13.2, 1.1, 0.1); barrel(B, 1.6, 2, 17.5); barrel(B, -1.8, 2, -22, 0.9);
  B.add(new THREE.TorusGeometry(0.55, 0.16, 4, 8), ROPE, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(1.5, 2.1, 8));
  rowboat(B, -9, -33, 0.4, 0x8a3a2a); rowboat(B, -15, -36.5, 1.5, 0x2f5a7a); rowboat(B, 27, -36.8, 1.62, 0xd8cfb8); rowboat(B, -58, -36.4, 1.5, 0x5a7a4a);

  const spots = [];
  const shop = (x, z, id, name, h, fn) => { B.at(x, QY, z, 0, fn); spots.push({ id, name, pos: new THREE.Vector3(x, QY + h + 4, z) }); };

  // shipwright: open shed with a hull in frame on the stocks
  shop(-60, -60, 'wright', 'Shipwright', 10, () => {
    for (const [x, z] of [[-6.5, -4.5], [6.5, -4.5], [-6.5, 4.5], [6.5, 4.5], [0, -4.5], [0, 4.5]]) B.cyl(0.32, 0.36, 7, WOOD, x, 3.5, z, 6);
    roof(B, 14, 10, 7, 3.4, 0x7a4a2e, 0x7a4a2e, false);
    B.box(14, 0.3, 0.3, WOOD, 0, 6.9, -4.5).box(14, 0.3, 0.3, WOOD, 0, 6.9, 4.5);
    B.box(0.5, 0.5, 11, DARK, 0, 1.2, 0); // keel on the blocks
    for (const z of [-4, 0, 4]) B.box(3, 0.9, 0.6, WOOD, 0, 0.45, z);
    for (let i = -4; i <= 4; i++) { const hw = 2.4 * Math.cos((i / 4.6) * 1.35) ** 0.6, z = i * 1.15; for (const s of [-1, 1]) B.bar([0, 1.3, z], [s * hw * 0.8, 1.9, z], 0.12, 0xb08f5c, 4).bar([s * hw * 0.8, 1.9, z], [s * hw, 3.6, z], 0.12, 0xb08f5c, 4); }
    for (const s of [-1, 1]) B.box(0.14, 0.2, 9.4, 0xb08f5c, s * 2.2, 3.5, 0);
    for (let i = 0; i < 5; i++) B.box(0.5, 0.25, 7, 0xb89a66, 9.5 + (i % 3) * 0.6, 0.15 + Math.floor(i / 3) * 0.28, 2); // planks stacked outside
    B.box(2.2, 0.15, 0.9, WOOD, -9.5, 1.1, 3); for (const s of [-1, 1]) B.box(0.15, 1.1, 0.8, WOOD, -9.5 + s * 0.9, 0.55, 3);
    sign(B, 7.2, 5.2, 4.5, 0x2f4a6b);
  });
  // sailmaker: cottage with canvas drying on a line and bolts of cloth at the door
  shop(-30, -62, 'sails', 'Sailmaker', 9, () => {
    house(B, G, 10, 6, 8, 0xe6dcc4, 0x8a4a3a, { trim: 0x4a6a7a });
    for (const x of [6.8, 14]) B.cyl(0.14, 0.16, 5.2, WOOD, x, 2.6, 5.5, 5);
    B.bar([6.8, 5.1, 5.5], [14, 5.1, 5.5], 0.05, ROPE, 4);
    [0xf3ead2, 0xe9dfc4, 0xf3ead2].forEach((c, i) => { B.box(1.9, 2.7 - i * 0.3, 0.06, c, 8.2 + i * 2.2, 3.75 + i * 0.15, 5.5, 0, 0.12 * (i - 1)); });
    B.box(0.5, 1.5, 0.08, 0x27558f, 10.4, 3.9, 5.56).box(1.3, 0.45, 0.08, 0x27558f, 10.4, 4.1, 5.56);
    for (let i = 0; i < 3; i++) B.cyl(0.35, 0.35, 2.4, i % 2 ? 0xe9dfc4 : 0xd9ceb0, -6.2 - (i % 2) * 0.5, 0.4 + Math.floor(i / 2) * 0.6, 4.6 + (i % 2) * 0.7, 7, Math.PI / 2, 0.2);
    sign(B, -5.2, 4.6, 4, 0xe9dfc4);
  });
  // tavern: two storeys, a gable to the street, every window lit, tables outside
  shop(0, -64, 'tavern', 'Tavern', 14, () => {
    house(B, G, 13, 9, 10, 0xc9a26b, 0x5a3320, { rows: 2, front: true, trim: 0x4a2a18 });
    for (const x of [-6.5, 6.5]) B.box(0.35, 9, 0.35, 0x4a2a18, x, 4.5, 5.02);
    sign(B, 6.9, 6.2, 5, 0x8a2a22); G.box(0.5, 0.6, 0.3, LAMP, -1.9, 3.3, 5.3);
    barrel(B, -8, 0, 4); barrel(B, -9.5, 0, 2.8); barrel(B, -8.6, 1.3, 3.4, 0.8);
    for (const x of [4.5, 9]) { B.box(2.4, 0.14, 1.3, WOOD, x, 1.05, 8).box(0.2, 1, 0.2, WOOD, x - 0.9, 0.5, 8).box(0.2, 1, 0.2, WOOD, x + 0.9, 0.5, 8); for (const s of [-1, 1]) B.box(2.4, 0.12, 0.45, WOOD, x, 0.6, 8 + s * 1.2).box(0.15, 0.6, 0.4, WOOD, x - 0.9, 0.3, 8 + s * 1.2).box(0.15, 0.6, 0.4, WOOD, x + 0.9, 0.3, 8 + s * 1.2); B.cyl(0.14, 0.14, 0.3, 0xb8b0a0, x + 0.4, 1.27, 8.1, 6); }
  });
  // gunsmith: squat stone magazine with a gun on its carriage and shot piled outside
  shop(30, -62, 'guns', 'Gunsmith', 8, () => {
    house(B, G, 10, 5, 9, 0x8f8f93, 0x45484f, { trim: 0x2c2f36 });
    B.bar([7, 1.2, 4.2], [8.1, 1.7, 7.3], 0.42, IRON, 8, 0.3);
    B.box(1.5, 0.6, 2.2, 0x6b3524, 7.4, 0.55, 5.2, 0, 0.34); for (const [dx, dz] of [[-0.9, -0.6], [0.6, -1], [-0.3, 1], [1.2, 0.6]]) B.cyl(0.36, 0.36, 0.25, DARK, 7.4 + dx, 0.36, 5.2 + dz, 8, 0, 0.34, Math.PI / 2);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - l; i++) for (let j = 0; j < 3 - l; j++) B.add(new THREE.IcosahedronGeometry(0.36, 0), IRON, new THREE.Matrix4().makeTranslation(10.6 + (i + l * 0.5) * 0.72, 0.36 + l * 0.55, 5.4 + (j + l * 0.5) * 0.72));
    for (let i = 0; i < 3; i++) B.bar([-6.4 - i * 0.7, 0.2, 4.9], [-6.4 - i * 0.7, 2.3, 4.4], 0.16, IRON, 6, 0.11);
    B.box(2.6, 0.15, 0.3, WOOD, -7.1, 2.0, 4.4);
    sign(B, 5.2, 4.1, 4.5, 0x2c2f36);
  });
  // chandler: warehouse with a hoist over its doors, crates, kegs and sacks
  shop(60, -60, 'stores', 'Chandler', 9, () => {
    house(B, G, 14, 6, 9, 0xb5764a, 0x3f5a6b, { trim: 0x2c4350, chimney: false });
    B.box(1.9, 0.3, 0.3, WOOD, 0, 7.6, 5.4, 0, Math.PI / 2); B.bar([0, 7.5, 6.2], [0, 4.4, 6.2], 0.05, ROPE, 4); crate(B, 0, 3.3, 6.2, 1.1, 0.4);
    for (const [x, y, z, s] of [[-9, 0, 5.2, 1.6], [-9, 1.6, 5.2, 1.2], [-11, 0, 5.8, 1.4], [9.5, 0, 5.6, 1.6], [-7.2, 0, 6.6, 1.0]]) crate(B, x, y, z, s, x * 0.3);
    barrel(B, 11.5, 0, 5, 0.9); barrel(B, 10.6, 0, 6.6, 0.9);
    for (let i = 0; i < 4; i++) B.add(new THREE.DodecahedronGeometry(0.6, 0), 0xcbb98a, new THREE.Matrix4().makeTranslation(5.5 + (i % 2) * 1.0, 0.35 + Math.floor(i / 2) * 0.55, 5.8 + (i % 2) * 0.3).scale(new THREE.Vector3(1, 0.6, 1.3)));
    sign(B, -7.2, 4.6, 4.5, 0x3f5a6b);
  });
  // market stalls under striped awnings
  for (const [x, c] of [[-14.5, 0xb8372b], [16, 0x2f6a8a]]) B.at(x, QY, -50, 0, () => {
    for (const [px, pz] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) B.cyl(0.08, 0.08, pz < 0 ? 3.4 : 2.6, WOOD, px, pz < 0 ? 1.7 : 1.3, pz, 4);
    for (let i = 0; i < 6; i++) B.quad([-2.3 + i * 0.77, 3.45, -1.5], [-2.3 + (i + 1) * 0.77, 3.45, -1.5], [-2.3 + (i + 1) * 0.77, 2.55, 1.6], [-2.3 + i * 0.77, 2.55, 1.6], i % 2 ? 0xf1ece0 : c);
    B.box(4, 0.15, 1.6, WOOD, 0, 1.1, 0).box(3.8, 1, 0.1, shade(c, 0.7), 0, 0.55, 0.8);
    [0xd8862a, 0xb8372b, 0x6f9a3a, 0xe2c24a].forEach((k, i) => B.box(0.75, 0.3, 1.1, k, -1.4 + i * 0.93, 1.33, 0));
  });
  barrel(B, -40, QY, -45); barrel(B, -41.4, QY, -44.4); crate(B, 38, QY, -45, 1.5, 0.2); crate(B, 39.8, QY, -44.6, 1.2, 0.7); crate(B, 38.6, QY + 1.5, -45, 1.0, 0.5);
  // handcart
  B.at(70, QY, -46, 0.5, () => { B.box(1.6, 0.15, 2.6, WOOD, 0, 0.95, 0).box(1.6, 0.5, 0.1, WOOD, 0, 1.25, -1.3); for (const s of [-1, 1]) { B.cyl(0.7, 0.7, 0.14, DARK, s * 0.92, 0.7, -0.2, 9, 0, 0, Math.PI / 2); B.bar([s * 0.7, 0.95, 1.3], [s * 0.7, 1.05, 2.8], 0.06, WOOD, 4); } crate(B, 0, 1.03, -0.3, 1.0); });
  // flagstaff at the west end of the quay
  B.cyl(0.12, 0.2, 14, 0xe8e2d0, -84, QY + 7, -44, 6); B.cyl(0.9, 1.1, 0.6, STONE, -84, QY + 0.3, -44, 8); B.box(3.4, 2, 0.08, 0x2b62b8, -82.2, QY + 12.6, -44).box(3.4, 0.36, 0.1, 0xece6d4, -82.2, QY + 12.6, -44).box(0.36, 2, 0.1, 0xece6d4, -83, QY + 12.6, -44);

  // the rest of the town climbs the hill behind the quay
  const walls = [0xe6dcc4, 0xd9c9a8, 0xcfa98a, 0xe0d2b8, 0xd8b89a, 0xead9c0], roofs = [0x8a4a3a, 0x7a3f33, 0x5a6b7a, 0x9a5a3a, 0xa0583c];
  const lots = [];
  for (let i = 0; i < 9; i++) lots.push([-76 + i * 19 + rnd() * 6, -77 - rnd() * 2, 6 + rnd() * 3, 4 + rnd() * 2]);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9 - row; i++) {
    const x = -78 + row * 9 + i * 18.5 + rnd() * 7, z = -93 - row * 13 - rnd() * 4;
    if (Math.hypot(x + 46, z + 112) > 15) lots.push([x, z, 5.5 + rnd() * 3.5, 3.8 + rnd() * 2.6]);
  }
  lots.forEach(([x, z, w, h], i) => B.at(x, z > -86 ? QY : ground(x, z) + 0.2, z, (rnd() - 0.5) * 0.3, () => house(B, G, w, h, 6, walls[i % walls.length], roofs[(i * 3) % roofs.length], { door: z < -86, rows: h > 5.8 ? 2 : 1, front: i % 4 === 1 })));
  // church with a bell tower
  B.at(-46, ground(-46, -112) + 0.3, -112, 0, () => {
    house(B, G, 8, 7.5, 14, 0xf1ece0, 0x8a4a3a, { front: true, chimney: false, door: true });
    B.box(4.6, 15, 4.6, 0xf1ece0, -6, 5.5, 5.5); B.box(4.9, 0.3, 4.9, STONE, -6, 10.5, 5.5);
    for (const [dx, dz, w, d] of [[0, 2.32, 1.3, 0.1], [0, -2.32, 1.3, 0.1], [2.32, 0, 0.1, 1.3], [-2.32, 0, 0.1, 1.3]]) B.box(w, 2, d, DARK, -6 + dx, 11.8, 5.5 + dz);
    B.cyl(0, 3.6, 6, 0x5a6b7a, -6, 16, 5.5, 4, 0, Math.PI / 4);
    B.box(0.16, 2, 0.16, 0xe2c24a, -6, 19.8, 5.5).box(1.1, 0.16, 0.16, 0xe2c24a, -6, 20.2, 5.5);
  });
  // palms along the front, trees between the houses
  for (const [x, z, h] of [[-80, -46, 9], [-74, -52, 7], [80, -52, 8], [44, -45, 7], [-14, -44.5, 8], [22, -45, 6.5], [-52, -46, 7.5]]) palm(B, x, QY, z, h, rnd);
  for (let i = 0; i < 26; i++) {
    const x = -92 + rnd() * 184, z = -88 - rnd() * 42;
    if (lots.every((l) => Math.hypot(l[0] - x, l[1] - z) > 8) && Math.hypot(x + 48, z + 110) > 13) (i % 3 ? tree : palm)(B, x, ground(x, z), z, i % 3 ? 0.9 + rnd() * 0.7 : 6 + rnd() * 3, rnd);
  }

  // lighthouse on the point, with the keeper's cottage beside it
  const py = point.userData.height(108, 6);
  B.at(108, py - 0.4, 6, 0, () => {
    B.cyl(3.5, 3.9, 1.6, STONE, 0, 0.8, 0, 12);
    for (let i = 0; i < 4; i++) B.cyl(2.6 - i * 0.35, 3 - i * 0.35, 5, i % 2 ? 0xb8372b : 0xf1ece0, 0, 4.1 + i * 5, 0, 12);
    B.box(1.3, 2.4, 0.3, DARK, 0, 2.6, 2.95); for (const [y, a] of [[8, 0.9], [13, -0.6], [17.5, 0.3]]) B.box(0.7, 1, 0.3, DARK, Math.sin(a) * (2.75 - y * 0.06), y, Math.cos(a) * (2.75 - y * 0.06), 0, a);
    B.cyl(2.9, 2.5, 0.4, 0x45484f, 0, 21.8, 0, 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, b = ((i + 1) / 12) * 6.283; B.box(0.1, 1.1, 0.1, IRON, Math.sin(a) * 2.75, 22.5, Math.cos(a) * 2.75); B.bar([Math.sin(a) * 2.75, 23, Math.cos(a) * 2.75], [Math.sin(b) * 2.75, 23, Math.cos(b) * 2.75], 0.05, IRON, 4); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; B.box(0.12, 2.4, 0.12, IRON, Math.sin(a) * 1.55, 23.2, Math.cos(a) * 1.55); }
    G.cyl(1.45, 1.45, 2.3, 0xfff0b0, 0, 23.2, 0, 8); B.cyl(0, 2.2, 2, 0x45484f, 0, 25.4, 0, 12); B.add(new THREE.IcosahedronGeometry(0.3, 0), 0xe2c24a, new THREE.Matrix4().makeTranslation(0, 26.6, 0));
  });
  B.at(100, point.userData.height(100, 10), 10, 0.5, () => house(B, G, 5, 3.2, 4.5, 0xf1ece0, 0x8a4a3a, {}));

  g.add(B.mesh(), G.mesh(GLOW));

  // townsfolk: some stand talking, some walk the quay and the pier
  const SHIRTS = [0x8a3a2a, 0x2f4a6b, 0xd8cfb8, 0x5a6b3a, 0x6b4a6b, 0xb5764a, 0x3a3a40, 0xc9a24a];
  const idle = [[-33, -55.5, 0.4], [-31.4, -54.4, -2.4], [3, -56.5, 2.8], [4.6, -57.6, -0.6], [6.5, -55.2, -2], [27, -55, 0.2], [57, -53.4, 2.6], [58.4, -54.6, -0.9], [-14.5, -51.6, 0], [-15.6, -48, 3.1], [16, -51.6, 0], [17, -47.8, 3.2], [-60, -53, 3], [1.4, 19.6, 0.3], [-1.2, 4, 1.6], [70.6, -44, 2.6]];
  const walks = [[-70, -47, 66, -46.5, QY], [50, -49, -55, -49.5, QY], [-8, -45.5, 76, -44.5, QY], [0.8, -37, 0.6, 17, 2], [-1, 12, -1.2, -36, 2], [-78, -52, -20, -53, QY], [40, -52.5, 74, -51, QY]];
  const folk = new Figures(idle.length + walks.length, 1.25);
  idle.forEach((p, i) => folk.dress(i, SHIRTS[i % SHIRTS.length], i * 3 + 1));
  const walkers = walks.map(([x0, z0, x1, z1, y], i) => { folk.dress(idle.length + i, SHIRTS[(i * 3 + 2) % SHIRTS.length], i * 5 + 2); return { x0, z0, x1, z1, y, len: Math.hypot(x1 - x0, z1 - z0), d: rnd() * 40, dir: 1, face: 0, v: 1.5 + rnd() * 0.8 }; });
  g.add(folk.mesh);
  let time = 0;
  const update = (dt) => {
    time += dt;
    idle.forEach((p, i) => { const talk = Math.sin(time * 0.6 + i * 2.1) > 0.55; folk.put(i, p[0], p[1] > -39 ? 2 : QY, p[1], p[2], 1, 0, Math.sin(time * 1.1 + i) * 0.06, talk ? -1.1 + Math.sin(time * 5 + i) * 0.35 : 0.05); });
    walkers.forEach((w, i) => {
      w.d += w.dir * w.v * dt;
      if (w.d > w.len || w.d < 0) { w.dir = -w.dir; w.d = Math.max(0, Math.min(w.len, w.d)); }
      const k = w.d / w.len, leg = Math.sin(w.d * 3.3) * 0.6;
      w.face += wrap(Math.atan2((w.x1 - w.x0) * w.dir, (w.z1 - w.z0) * w.dir) - w.face) * Math.min(1, dt * 5);
      folk.put(idle.length + i, w.x0 + (w.x1 - w.x0) * k, w.y + Math.abs(Math.sin(w.d * 3.3)) * 0.05, w.z0 + (w.z1 - w.z0) * k, w.face, 1, leg, -leg * 0.8, leg * 0.8);
    });
    folk.commit();
  };
  update(0);

  return {
    group: g, spots, update,
    berth: { x: 8.2, z: -6, heading: 0 },
    moorings: [[-34, 30, 1.9], [-78, 58, 2.3], [38, 62, -2.2], [-18, 98, 0.7], [84, 100, -1.2]],
    focus: new THREE.Vector3(0, 7, -26),
  };
}
