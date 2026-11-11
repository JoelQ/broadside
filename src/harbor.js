import * as THREE from 'three';
import { makeIsland, mulberry } from './world.js';

// Port Halcyon: the home harbour. Built once, shown on the title screen and between fights.
const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const glow = new THREE.MeshBasicMaterial({ color: 0xffd98a });

function house(w, h, d, wall, roof, { door = true, rows = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(wall));
  body.position.y = h / 2;
  const R = 1, rh = h * 0.55 + 1;
  const rf = new THREE.Mesh(new THREE.ConeGeometry(R, rh, 4), L(roof));
  rf.rotation.y = Math.PI / 4;
  rf.scale.set((w * 1.14) / (R * Math.SQRT2), 1, (d * 1.14) / (R * Math.SQRT2));
  rf.position.y = h + rh / 2;
  g.add(body, rf);
  const n = Math.max(2, Math.round(w / 3));
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    if (door && r === 0 && i === Math.floor(n / 2)) continue;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), glow);
    win.position.set(-w / 2 + (w * (i + 0.5)) / n, 2 + r * 2.8, d / 2 + 0.04);
    g.add(win);
  }
  if (door) {
    const dr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.12), L(0x3a2412));
    dr.position.set(-w / 2 + (w * (Math.floor(n / 2) + 0.5)) / n, 1.1, d / 2 + 0.04);
    g.add(dr);
  }
  return g;
}
function palm(h) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, h, 5), L(0x7a5a3a));
  tr.position.y = h / 2; tr.rotation.z = 0.08;
  g.add(tr);
  for (let i = 0; i < 6; i++) {
    const lf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), L(0x3f8a3a));
    lf.position.y = h; lf.rotation.set(0, (i / 6) * Math.PI * 2, 1.15, 'YXZ'); lf.translateY(2);
    g.add(lf);
  }
  return g;
}
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(x, y, z); return m; };
const cyl = (r, h, c, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), L(c)); m.position.set(x, y, z); return m; };

export function buildHarbor() {
  const g = new THREE.Group();
  const rnd = mulberry(77);
  g.add(makeIsland(215, 46, rnd, 0, -268));
  g.add(makeIsland(26, 9, rnd, 108, 6));
  // stone quay and timber pier
  const QY = 2.2;
  g.add(box(170, 7, 44, 0x8d8676, 0, QY - 3.5, -62));
  g.add(box(170, 0.5, 2, 0x6f695c, 0, QY + 0.25, -41));
  g.add(box(6, 0.5, 64, 0x8a6a44, 0, 1.75, -10));
  for (let z = -38; z <= 22; z += 10) for (const x of [-3, 3]) g.add(cyl(0.35, 6, 0x4a3826, x, -0.6, z));
  for (const x of [-3.4, 3.4]) g.add(cyl(0.3, 1.6, 0x4a3826, x, 2.6, 20));

  const spots = [];
  const place = (obj, x, z, id, name, h) => { obj.position.set(x, QY, z); g.add(obj); if (id) spots.push({ id, name, pos: new THREE.Vector3(x, QY + h + 4, z) }); };

  // shipwright: open shed with a hull on the stocks
  const sw = new THREE.Group();
  for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) sw.add(cyl(0.35, 7, 0x5b4027, x, 3.5, z));
  const swRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 4, 4), L(0x7a4a2e));
  swRoof.rotation.y = Math.PI / 4; swRoof.scale.set(10.5, 1, 7.4); swRoof.position.y = 9;
  sw.add(swRoof, box(3, 2.2, 9, 0x6b4a2c, 0, 1.6, 0), box(8, 0.5, 0.5, 0x5b4027, 0, 0.4, -2.5), box(8, 0.5, 0.5, 0x5b4027, 0, 0.4, 2.5));
  for (let i = -3; i <= 3; i++) sw.add(box(3.6, 0.25, 0.25, 0xa58555, 0, 2.9, i * 1.3));
  place(sw, -60, -60, 'wright', 'Shipwright', 10);

  // sailmaker: cottage with canvas drying on a line
  const sm = house(10, 6, 8, 0xe6dcc4, 0x8a4a3a);
  sm.add(cyl(0.15, 5, 0x5b4027, 7, 2.5, 5), cyl(0.15, 5, 0x5b4027, 13, 2.5, 5));
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), L(0xf3ead2, { side: THREE.DoubleSide })); c.position.set(8 + i * 2, 3.4, 5); c.rotation.y = 0.2 * (i - 1); sm.add(c); }
  place(sm, -30, -62, 'sails', 'Sailmaker', 9);

  // tavern: two storeys, every window lit
  const tv = house(13, 9, 10, 0xc9a26b, 0x5a3320, { rows: 2 });
  tv.add(box(0.2, 1.4, 2.2, 0x3a2412, 6.7, 6, 5.6), cyl(0.8, 1.3, 0x6b4a2c, -8, 0.65, 4), cyl(0.8, 1.3, 0x6b4a2c, -9.6, 0.65, 2.8));
  place(tv, 0, -64, 'tavern', 'Tavern', 14);

  // gunsmith: squat stone magazine with a gun outside
  const gs = house(10, 5, 9, 0x8f8f93, 0x45484f);
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 3.2, 8), L(0x1c1c1e));
  gun.rotation.x = Math.PI / 2 - 0.2; gun.position.set(8, 1.1, 5);
  gs.add(gun, box(1.4, 0.6, 2, 0x5b4027, 8, 0.4, 4.6));
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), L(0x1c1c1e)); b.position.set(10.2 + (i % 3) * 0.75, 0.35, 5.5 + Math.floor(i / 3) * 0.75); gs.add(b); }
  place(gs, 30, -62, 'guns', 'Gunsmith', 8);

  // chandler: warehouse with crates and powder kegs
  const ch = house(14, 6, 9, 0xb5764a, 0x3f5a6b);
  for (const [x, y, z, s] of [[-9, 0.8, 5, 1.6], [-9, 2.2, 5, 1.2], [-11, 0.7, 5.5, 1.4], [9.5, 0.8, 5.5, 1.6]]) ch.add(box(s, s, s, 0x9a7a4a, x, y, z));
  ch.add(cyl(0.7, 1.2, 0x5b4027, 11.5, 0.6, 5), cyl(0.7, 1.2, 0x5b4027, 10.6, 0.6, 6.6));
  place(ch, 60, -60, 'stores', 'Chandler', 9);

  // the rest of the town climbing the hill behind the quay
  const walls = [0xe6dcc4, 0xd9c9a8, 0xcfa98a, 0xe0d2b8], roofs = [0x8a4a3a, 0x7a3f33, 0x5a6b7a, 0x9a5a3a];
  for (let i = 0; i < 9; i++) {
    const hs = house(6 + rnd() * 3, 4 + rnd() * 2, 6, walls[i % 4], roofs[i % 4], { door: false });
    hs.position.set(-76 + i * 19 + rnd() * 6, QY, -77 - rnd() * 2);
    g.add(hs);
  }
  for (const [x, z, h] of [[-80, -46, 9], [-74, -52, 7], [80, -47, 8], [44, -45, 7], [-14, -47, 8]]) { const p = palm(h); p.position.set(x, QY, z); g.add(p); }

  // lighthouse on the point
  const lh = new THREE.Group();
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.35, 3 - i * 0.35, 5, 10), L(i % 2 ? 0xb8372b : 0xf1ece0)); s.position.y = 2.5 + i * 5; lh.add(s); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  lamp.position.y = 21.5;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 10), L(0x45484f)); cap.position.y = 24;
  lh.add(lamp, cap);
  lh.position.set(108, 5.5, 6);
  g.add(lh);

  return {
    group: g, spots,
    berth: { x: 8.2, z: -6, heading: 0 },
    moorings: [[-34, 30, 1.9], [-78, 58, 2.3], [38, 62, -2.2], [-18, 98, 0.7], [84, 100, -1.2]],
    focus: new THREE.Vector3(0, 7, -26),
  };
}
