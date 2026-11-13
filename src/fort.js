import * as THREE from 'three';
import { Batch } from './geo.js';
import { flagTexture } from './model.js';

// A shore battery or sea fort, built to answer the same questions as a ship model: where its
// muzzles are, how tall it is, what flag it flies. spec.B is the width of its footprint,
// spec.D the height of the gun platform, spec.bow the battery (it fires "ahead", along its heading).
const STONE = 0xb9ab8c, DARK = 0x8f8268, IRON = 0x1c1c1e;
export function buildFortModel(spec) {
  const group = new THREE.Group(), S = new Batch();
  const R = spec.B / 2, H = spec.D, n = spec.bow.n, arc = spec.bow.arc || 0.8, sq = spec.shape === 'square';
  // rock footing, walls, platform
  S.cyl(R * 1.25, R * 1.5, 2.4, 0x7d7462, 0, 0, 0, 10);
  if (sq) { S.box(R * 2, H, R * 2, STONE, 0, H / 2, 0); S.box(R * 2.08, 0.6, R * 2.08, DARK, 0, H * 0.72, 0); }
  else { S.cyl(R * 0.94, R, H, STONE, 0, H / 2, 0, 14); S.cyl(R * 0.97, R * 0.97, 0.6, DARK, 0, H * 0.72, 0, 14); }
  // parapet with merlons all round, guns through the embrasures facing ahead
  const m = sq ? 16 : 18;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2, k = sq ? 1 / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) : 1;
    S.box(R * 0.24, 1.5, 1.1, STONE, Math.sin(a) * R * 0.94 * k, H + 0.75, Math.cos(a) * R * 0.94 * k, 0, a);
  }
  const muzzles = { bow: [] };
  for (let i = 0; i < n; i++) {
    const a = n > 1 ? (i / (n - 1) - 0.5) * 2 * arc * 0.8 : 0, x = Math.sin(a) * R, z = Math.cos(a) * R, y = H * 0.8;
    S.box(1.2, 0.9, 1.0, 0x0b0b0c, x * 0.99, y, z * 0.99, 0, a);
    S.bar([x * 0.8, y, z * 0.8], [x * 1.08, y, z * 1.08], 0.34, IRON, 7, 0.24);
    muzzles.bow.push(new THREE.Vector3(x * 1.1, y, z * 1.1));
  }
  // a keep, and a door on the landward side
  S.box(R * 0.7, 2.6, R * 0.7, DARK, 0, H + 1.3, -R * 0.2);
  S.box(1.6, 2.4, 0.3, 0x3a2a1c, 0, 1.6, -R * (sq ? 1.01 : 0.99));
  const mastH = H + 9;
  S.bar([0, H + 2.6, -R * 0.2], [0, mastH, -R * 0.2], 0.16, 0x74522f, 5, 0.1);
  group.add(S.mesh());
  const fw = 5, fg = new THREE.PlaneGeometry(fw, fw * 0.58, 8, 2); fg.translate(fw / 2, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: flagTexture(spec), side: THREE.DoubleSide }));
  flag.position.set(0, mastH - fw * 0.29, -R * 0.2);
  group.add(flag);
  return { group, yards: [], sails: [], booms: [], flag, muzzles, mats: null, decks: [], oars: null, mastH };
}
