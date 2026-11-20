import * as THREE from 'three';
import { shade, mulberry } from './geo.js';
import { makeCoast, smoothPath, oval } from './coast.js';
import { tree } from './land.js';
import { wall, tower, bastion, minaret, dome, town, mole, lantern, arsenal, tartane, palazzo, basilica } from './works.js';
import { house, rowboat, flagstaff } from './harbor.js';

// The home ports of the two sides, built around the same quay as Port Halcyon (harbor.js): the quay runs along
// z = -40 to -86 for x within 88 of the pier, your ship lies at the pier, and the other ships ride at moorings in
// front of it (x within 170, z 30 to 100). Everything here stands clear of those. Purely the look of the place:
// nothing in port is sailed, so none of this is land a ship or a shot can meet.
// The camera in port looks south (toward -z) over the quay from the north, and can be dragged right round.
const QY = 2.2, STONE = 0x8d8676, WALL = 0xe4d9c2, LAMP = 0xffd98a, CYPRESS = 0x2f4a2a;
const ROCKFACE = new THREE.Color(0x8f8576);
const EARTH = new THREE.Color(0x8e8562); // trodden ground in a town: darker than the houses, so they stand out against it
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// the White Mountains, which stand behind both towns: a long ridge to the south with gullied peaks, foothills before it
function whiteMountains(x, z) {
  const ridge = 0.62 + 0.25 * Math.sin(x / 270 + 1.3) + 0.18 * Math.sin(x / 113 + 0.4) + 0.08 * Math.sin(x / 41);
  const main = 340 * Math.exp(-(((z + 2350) / 400) ** 2)) * ridge, foot = 80 * Math.exp(-(((z + 1450) / 360) ** 2)) * (0.7 + 0.3 * Math.sin(x / 190));
  return main + foot;
}
// a cypress: the dark spire that stands by every mosque and churchyard in Crete
function cypress(B, x, y, z, h = 9) { B.cyl(0.25, 0.3, 1.2, 0x4a3a26, x, y + 0.4, z, 5); B.cyl(0, h * 0.13, h, CYPRESS, x, y + 0.9 + h / 2, z, 6); }
// a small mosque: a domed hall with a porch and a minaret at one corner
function mosque(B, x, y, z, r = 6, ry = 0, mh = 22) {
  B.at(x, y, z, ry, () => {
    dome(B, 0, -0.3, 0, r, 0xf0e8d8, 0x8c9aa2);
    B.box(r * 2.1, r * 0.75, r * 0.9, 0xe8dcc4, 0, r * 0.37 - 0.3, r * 1.5); // the porch
    for (let i = -1; i <= 1; i++) B.add(new THREE.SphereGeometry(r * 0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x8c9aa2, new THREE.Matrix4().makeTranslation(i * r * 0.68, r * 0.75 - 0.3, r * 1.5));
    minaret(B, r * 1.25, -0.3, -r * 0.6, mh);
  });
}
// a village on a far shore: whitewashed houses, a mosque, cypresses
function village(B, G, g, x, z, o = {}) {
  const rnd = mulberry(o.seed || 3);
  town(B, G, g, { seed: o.seed || 3, n: o.n || 30, x, z, w: o.w || 220, d: o.d || 110, size: o.size || 1.3, walls: [0xf2ece0, 0xe8e0cc, 0xf0e8d8, 0xe0d2b8], roofs: [0xb4482c, 0xa63f2a, 0xc0562f], glass: 0x7d6a48, steep: 9 });
  const mx = x + (o.mx ?? 20), mz = z + (o.mz ?? 10);
  if (g(mx, mz) > 2) mosque(B, mx, g(mx, mz), mz, o.r || 5.5, o.ry || 0, o.mh || 24);
  for (let i = 0; i < 6; i++) { const cx = mx + (rnd() - 0.5) * 50, cz = mz + (rnd() - 0.5) * 40, y = g(cx, cz); if (y > 2.5) cypress(B, cx, y, cz, 8 + rnd() * 5); }
}

// ---------- Suda ----------
// The fortress of Suda sits on a rock in the mouth of a long bay, with Ottoman Crete all round it. The rock
// rises in cliffs and ledges to a knoll at its south-east end; the walls run round its rim, stepping up and down
// with it, with a bastion on each point, and the quay lies under a tall curtain on its north side. Inside, on the
// ledges: the governor's house, a church with its campanile, barracks, houses, and on the knoll the keep with
// St Mark's flag. Pines on the slopes outside the walls, rocks in the water all round. Across the water on every side the shore is the Sultan's now: villages
// with their mosques, a battery watching the island, and the White Mountains behind.
const SUDA_C = [0, -128]; // the middle of the island
// behind the quay the rock is cut into terraces, one above the other, each with a row of houses facing the harbour
const TER = { z0: -88, d: 9, h: 8.6, n: 5 };
const terraceY = (k) => 1.6 + TER.h * k;
const CLIFF = (z) => { const t = Math.max(0, (TER.z0 - z) / TER.d), k = Math.floor(t); return terraceY(k) + TER.h * smooth(0.7, 1, t - k); };
const SUDA_ISLE = [[-88, -46, 0], [88, -46, 0], [118, -40, 2], [150, -47, 4], [184, -68], [205, -104], [198, -150], [166, -184], [110, -206], [40, -216],
  [-40, -214], [-110, -204], [-166, -182], [-200, -146], [-208, -100], [-188, -64], [-150, -46, 4], [-118, -40, 2]];
// the bay: its southern shore across the back of the view, its head far to the west, the hills of Akrotiri along
// the north, and the mouth opening to the east past the cape
const BAY = [[1700, -620, 30], [1300, -700], [900, -760], [560, -720], [300, -655], [120, -690], [-150, -760], [-450, -720], [-800, -790], [-1200, -760], [-1600, -700],
  [-2000, -640], [-2300, -520], [-2500, -300], [-2560, 0], [-2450, 300], [-2100, 520], [-1600, 640], [-1000, 700], [-500, 660], [-100, 720], [300, 690], [650, 640], [900, 560], [1050, 470],
  [1100, 2700, 0], [-2800, 2700, 0], [-2800, -3300, 0], [1900, -3300, 0]];
function suda(g, B, G) {
  const rnd = mulberry(1645);
  // the island: cliffs from the water, ledges stepping up to the knoll, and the quay cut down to the water
  const inner = (x, z) => Math.hypot(x - SUDA_C[0], (z - SUDA_C[1]) * 1.6); // under about 160 is inside the walls
  const isle = makeCoast({
    outline: SUDA_ISLE, seed: 31, rough: 10, H: 46, rise: 13, beach: 1, scale: 45, dry: 0.15, trees: 0.9, extent: 400,
    shape: (x, z, y) => {
      if (y > 2) {
        y += 24 * Math.exp(-((x - 80) ** 2 + (z + 172) ** 2) / 3000); // the knoll
        const t = (y - 2) / 8, f = t - Math.floor(t); y = 2 + 8 * (Math.floor(t) + smooth(0.6, 1, f)); // ledges, with a rock step between each
      }
      const cut = smooth(140, 124, Math.abs(x)); return y + (Math.min(y, CLIFF(z)) - y) * cut; // the cliff behind the quay
    },
    clear: (x, z) => inner(x, z) < 150,
    tint: (x, z, c, y, up) => {
      const face = smooth(140, 120, Math.abs(x)) * smooth(-84, -92, z) * smooth(-140, -128, z); // the cliff behind the quay is bare rock
      if (face) c.lerp(up < 0.75 ? ROCKFACE : EARTH, face);
      else if (up > 0.7) c.lerp(EARTH, 0.7 * smooth(175, 140, inner(x, z)));
    },
  });
  B.box(36, 7, 46, STONE, -106, QY - 3.5, -63); B.box(36, 7, 46, STONE, 106, QY - 3.5, -63); // the quay runs on to the bastions
  g.add(isle.mesh);
  const gi = isle.ground;
  // the mainland round the bay, with the White Mountains to the south
  const bay = makeCoast({
    outline: BAY, seed: 32, H: 70, rise: 170, beach: 6, scale: 230, dry: 0.35, trees: 0.6, extent: 3000, fineR: 1600, snow: 250,
    shape: (x, z, y) => (y > 1 ? y + whiteMountains(x, z) * smooth(-600, -1000, z) : y),
  });
  g.add(bay.mesh);
  const gb = bay.ground;
  // Leon, the little islet beside the fortress, with a watch tower
  const leon = makeCoast({ outline: oval(-350, -190, 62, 38, 1.1), seed: 33, rough: 8, H: 22, rise: 12, beach: 1, scale: 30, dry: 0.15, trees: 3, extent: 600 });
  g.add(leon.mesh);
  tower(B, leon.ground, -372, -176, 4, 8, WALL);
  // rocks in the water round both: a skirt of tumbled stone along the shore and a few crags standing off it
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const crag = (x, z, s, y = -0.8 + s * 0.15) => B.add(rock, [0x8a8274, 0x77716a, 0x9a9180][(rnd() * 3) | 0], new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)).setPosition(x, y, z).scale(new THREE.Vector3(s * 1.3, s * (0.6 + rnd() * 0.5), s)));
  for (const sh of [isle.shape, leon.shape]) for (let i = 0; i < sh.n; i += 2) {
    const p = sh.pts[i], q = sh.pts[(i + 1) % sh.n], nx = q[1] - p[1], nz = p[0] - q[0], l = Math.hypot(nx, nz) || 1;
    if (Math.abs(p[0]) < 138 && p[1] > -60) continue; // not under the quay
    const off = 1 + rnd() * 5, s = 1.5 + rnd() * 3.5, dir = sh.sdf(p[0] + (nx / l) * 4, p[1] + (nz / l) * 4) < 0 ? 1 : -1;
    crag(p[0] + (nx / l) * off * dir, p[1] + (nz / l) * off * dir, s);
  }
  for (const [x, z, s] of [[-238, -40, 7], [-226, -28, 4], [228, -150, 6], [240, -136, 3.5], [-60, -250, 8], [-40, -258, 4], [150, -232, 5], [-280, -240, 6], [-262, -112, 4.5]]) { crag(x, z, s); crag(x + s, z - s * 0.6, s * 0.6); }

  // the walls: round the island at the water's edge, and along the top of the cliff behind the quay
  const inset = (p, d) => { const dx = SUDA_C[0] - p[0], dz = SUDA_C[1] - p[1], l = Math.hypot(dx, dz); return [p[0] + (dx / l) * d, p[1] + (dz / l) * d]; };
  wall(B, gi, [[-132, -48], [-126, -133], [-12, -133]], { h: 5, w: 3.4, towers: false, col: WALL, floor: QY });
  wall(B, gi, [[4, -133], [126, -133], [132, -48]], { h: 5, w: 3.4, towers: false, col: WALL, floor: QY });
  const ring = [[132, -48], ...SUDA_ISLE.slice(3, 16).map((p) => inset(p, 7)), [-132, -48]];
  wall(B, gi, ring, { h: 8, w: 4, towers: false, col: WALL, floor: 0.4 });
  for (const p of [SUDA_ISLE[5], SUDA_ISLE[8], SUDA_ISLE[12], SUDA_ISLE[15]]) { const [x, z] = inset(p, 9); bastion(B, gi, x, z, Math.atan2(x - SUDA_C[0], z - SUDA_C[1]), 30, 9, WALL, 0.4); }
  for (const s of [-1, 1]) bastion(B, gi, s * 140, -46, s * 0.9, 20, 8, WALL, 0.4); // the two that flank the quay
  // the road up from the quay: it leaves the west end of the quay and climbs across the face of the cliff,
  // walled on its open side, to the gate at the top, which has St Mark's lion over it
  const road = smoothPath([[-118, -87], [-64, -104], [-22, -118], [-6, -126], [-4, -131]], 1.6), gy = gi(-4, -133);
  for (let i = 0; i < road.length - 1; i++) {
    const [x, z] = road[i], [x1, z1] = road[i + 1], ry = Math.atan2(x1 - x, z1 - z), nx = Math.cos(ry);
    const y = Math.max(QY + (gy - QY) * (i / (road.length - 2)), gi(x, z) + 0.2); // a steady climb, stepping over the terraces
    B.box(7, 3, 2.4, shade(0xcfc2a6, 0.92 + (i % 3) * 0.05), x, y - 1.3, z, 0, ry); // the steps
    B.box(6.6, 14, 2.4, shade(WALL, 0.86), x + nx * 0.3, y - 9.8, z, 0, ry); // the wall it stands on
    if (i < road.length - 6) B.box(0.9, 1.5, 2.4, WALL, x + nx * 3.6, y + 0.6, z, 0, ry); // the parapet on the open side
  }
  const roadX = (z) => road.reduce((a, p) => (Math.abs(p[1] - z) < Math.abs(a[1] - z) ? p : a))[0];
  // the terraces: a retaining wall along the front of each, and a row of houses on it, their windows to the harbour
  const tw = [0xf2ead8, 0xe6c088, 0xf0e6d0, 0xd98e5e, 0xead9c0, 0xc98a5a, 0xf4f0e6], tr = [0xb4482c, 0xa63f2a, 0xc0562f, 0x9a3a28];
  for (let k = 0; k < TER.n; k++) {
    const zr = TER.z0 - TER.d * (k + 0.85), y0 = terraceY(k), y1 = terraceY(k + 1);
    B.box(250, y1 - y0 + 2.2, 1.4, shade(WALL, 0.9 + (k % 2) * 0.05), 0, (y0 + y1) / 2 + 0.1, zr);
    B.box(250.4, 0.5, 1.8, shade(WALL, 0.8), 0, y1 + 1.2, zr);
    if (k + 1 >= TER.n) continue;
    const zc = TER.z0 - TER.d * (k + 1) - 3.3;
    for (let x = -120 + rnd() * 5; x < 118;) {
      const w = 7 + rnd() * 5, cx = x + w / 2;
      if (Math.abs(cx - roadX(zc)) > w / 2 + 5) B.at(cx, y1, zc, (rnd() - 0.5) * 0.06, () => house(B, G, w, 5.5 + rnd() * 4.5, 5.6, tw[(rnd() * tw.length) | 0], tr[(rnd() * tr.length) | 0], { rows: rnd() < 0.5 ? 2 : 1, front: rnd() < 0.3, glass: LAMP, chimney: rnd() < 0.4 }));
      x += w + 0.6 + (rnd() < 0.25 ? 5 + rnd() * 6 : rnd() * 1.5);
    }
  }
  B.at(-4, gy, -133, 0, () => {
    B.box(14, 12, 9, WALL, 0, 5, 0); B.box(15, 0.6, 10, shade(WALL, 0.85), 0, 11.2, 0);
    for (let m = 0; m < 6; m++) B.box(1.4, 1.3, 0.8, WALL, -6 + m * 2.4, 12.1, 4.3);
    B.box(4.6, 6, 0.6, 0x2a2218, 0, 3, 4.55); B.cyl(2.3, 2.3, 0.6, 0x2a2218, 0, 6, 4.55, 10, Math.PI / 2);
    B.box(3.6, 2.6, 0.3, shade(WALL, 1.05), 0, 9.2, 4.6); B.box(2.4, 1.4, 0.35, 0xc9a24a, 0, 9.2, 4.65); // the lion
  });
  flagstaff(g, B, 4, gy + 11.5, -133, 'venice', 9);

  // inside the walls
  const top = (x, z) => gi(x, z);
  B.at(36, top(36, -126), -126, 0, () => palazzo(B, G, 28, 11, 14, 0xe0c8a0, LAMP)); // the governor's house
  basilica(B, -70, top(-70, -150), -150, 0.15, 0.42, 0xe8dcc4); // the church
  for (const [x, z, ry] of [[118, -150, -0.7], [-140, -124, 0.6]]) B.at(x, top(x, z), z, ry, () => house(B, G, 26, 5, 8, 0xd8c8a6, 0x8a4a3a, { chimney: false })); // barracks
  B.at(-10, top(-10, -186), -186, 0, () => { B.box(12, 6, 8, shade(WALL, 0.95), 0, 2.5, 0); B.cyl(4, 4, 12, 0x8a7a68, 0, 6, 0, 3, 0, 0, Math.PI / 2); }); // the powder magazine, vaulted and roofed in stone
  const taken = [[36, -126, 20], [-70, -150, 26], [118, -150, 16], [-140, -124, 16], [-10, -186, 10], [80, -172, 14]];
  town(B, G, gi, { seed: 34, n: 110, x: 0, z: -150, w: 360, d: 120, size: 1.1, glass: LAMP, minY: 3, steep: 7, walls: [0xf2ead8, 0xe6c088, 0xf0e6d0, 0xd98e5e, 0xead9c0], roofs: [0xb4482c, 0xa63f2a, 0xc0562f],
    inside: (x, z) => z < -100 && Math.hypot(x - SUDA_C[0], (z - SUDA_C[1]) * 1.75) < 175 && taken.every(([a, b, r]) => Math.hypot(x - a, z - b) > r) });
  for (let i = 0; i < 9; i++) { const x = -150 + rnd() * 300, z = -110 - rnd() * 80; if (taken.every(([a, b, r]) => Math.hypot(x - a, z - b) > r)) cypress(B, x, top(x, z), z, 7 + rnd() * 4); }
  // the keep on the knoll, St Mark's flag over it
  tower(B, gi, 80, -172, 8, 12, WALL); flagstaff(g, B, 80, gi(80, -172) + 12, -172, 'venice', 18);
  flagstaff(g, B, 196, gi(196, -104) + 9, -104, 'venice', 12, 0.3);

  // the Sultan's shore: a battery opposite the island, villages with their mosques, a watch tower on Akrotiri
  const fort = (x, z, s, ry) => {
    const pts = [[-s, -s], [s, -s], [s, s], [-s, s], [-s, -s]].map(([a, b]) => [x + a * Math.cos(ry) + b * Math.sin(ry), z - a * Math.sin(ry) + b * Math.cos(ry)]);
    wall(B, gb, pts, { h: 6, w: 3.5, towers: false, col: 0xc8b48c });
    tower(B, gb, x, z, 6, 13, 0xc8b48c);
    flagstaff(g, B, x + 3, gb(x, z) + 13, z, 'ottoman', 14);
  };
  fort(300, -700, 26, 0.2);
  for (let i = 0; i < 4; i++) { const x = 270 + i * 16, z = -668; tents(B, gb, x, z - 30, i); }
  village(B, G, gb, 90, -790, { seed: 41, n: 40, w: 260, d: 110, mx: 30, mz: 0, r: 6.5 });
  village(B, G, gb, -680, -800, { seed: 42, n: 34, w: 240, d: 100, mx: -10, mz: 10 });
  village(B, G, gb, -1350, -800, { seed: 43, n: 26, w: 200, d: 90 });
  village(B, G, gb, 760, -800, { seed: 44, n: 22, w: 180, d: 80, mh: 20 });
  village(B, G, gb, -250, 770, { seed: 45, n: 34, w: 240, d: 90, mx: 0, mz: -10, ry: Math.PI });
  village(B, G, gb, -1700, 690, { seed: 46, n: 22, w: 200, d: 80, ry: Math.PI });
  fort(560, 690, 18, -0.3);
  // Ottoman coasters along the far shores, and a guard boat or two of the fortress near the island
  tartane(B, 210, -640, 1.4, 5); tartane(B, -560, -720, -1.2, 6); tartane(B, -320, 680, 0.4, 7); tartane(B, 150, -655, 1.8, 8);
  rowboat(B, -150, -30, 0.3, 0x8a3a2a); rowboat(B, 160, -28, -0.5, 0x2f5a7a);
}
function tents(B, g, x, z, i) { const y = g(x, z); if (y > 2) B.cyl(0, 3.2, 3.6, i % 3 ? 0xe2d6b8 : 0xb3221a, x, y + 1.7, z, 7); }

// ---------- Chania ----------
// The harbour of Chania, the fleet's base since the first summer of the war. You lie at the south quay of the
// old Venetian harbour. To the west along the quay the domes of the Janissaries' mosque stand at the water's
// edge; to the east the vaulted arsenals, building galleys for the Sultan now. The harbour is closed by the
// fort on the western point and by the long mole to the north-east with its lighthouse on the end. The town
// climbs behind the quay inside its Venetian walls, with a minaret over every quarter and the White Mountains,
// snow on their tops, behind it all.
const TOWN_WALL = [[-470, 150], [-520, -120], [-470, -420], [-200, -560], [200, -560], [470, -420], [540, -100], [500, 110]];
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const inTown = (x, z) => inPoly([...TOWN_WALL, [500, 300], [-470, 300]], x, z);
const CHANIA_SHORE = [[-2700, 230, 0], [-1800, 210], [-1100, 180], [-700, 160], [-480, 152], [-400, 162, 6], [-330, 176, 3], [-262, 180, 0], [-236, 150, 0],
  [-236, -44, 0], [-92, -44, 0], [92, -44, 0], [236, -44, 0], [236, 24, 0], [300, 64, 3], [420, 92], [560, 110], [900, 140], [1500, 180], [2700, 230, 0],
  [2700, -3300, 0], [-2700, -3300, 0]];
const MOLE = { path: smoothPath([[238, 20], [262, 70], [276, 130], [246, 196], [164, 232], [52, 246]], 10), w: 16, top: 3, parapet: 2, basin: [40, 60] };
function chaniaGround(x, z, y) {
  if (y < -1.2) return y;
  const t = smooth(760, 600, Math.abs(x)) * smooth(-760, -620, z); // the town: a gentle slope up from the harbour, Kastelli hill behind the quay
  const ty = 1.6 + Math.max(0, -z - 50) * 0.02 + 7 * Math.exp(-((x - 60) ** 2 + (z + 170) ** 2) / 12000);
  return y + (ty - y) * t + whiteMountains(x, z) * smooth(-700, -1100, z);
}
function chania(g, B, G) {
  const rnd = mulberry(1645);
  const land = makeCoast({ outline: CHANIA_SHORE, seed: 51, H: 42, rise: 160, beach: 3, scale: 210, dry: 0.5, trees: 0.45, extent: 3000, fineR: 1600, snow: 250, shape: chaniaGround,
    clear: (x, z) => inTown(x, z) || (Math.abs(x) < 800 && z > -800),
    tint: (x, z, c) => { const k = inTown(x, z) ? 0.8 : 0.8 * smooth(80, 0, distWall(x, z)); if (k) c.lerp(EARTH, k); } });
  g.add(land.mesh);
  const gl = land.ground;

  // the quay carried on round the harbour: west to the mosque and up the west side, east under the arsenals
  B.box(150, 7, 46, STONE, -163, QY - 3.5, -63); B.box(150, 7, 46, STONE, 163, QY - 3.5, -63);
  B.box(24, 7, 190, STONE, -228, QY - 3.5, 52); B.box(24, 7, 72, STONE, 228, QY - 3.5, -10);
  for (const [x0, x1, z0, z1] of [[-216, -88, -40, -40], [88, 216, -40, -40]]) B.box(x1 - x0, 1.5, 0.1, 0x4f5a48, (x0 + x1) / 2, 0.1, z0 + 0.02);
  // the Janissaries' mosque on the quay: a great dome, the porch of little domes to the water, its minaret
  B.at(-150, QY, -64, 0, () => {
    dome(B, 0, -0.2, 0, 9, 0xe8dcc4, 0x8c9aa2);
    B.box(30, 6, 7, 0xe0d2b8, 0, 2.8, 11.5);
    for (let i = 0; i < 6; i++) { const x = -12.5 + i * 5; B.add(new THREE.SphereGeometry(2.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x8c9aa2, new THREE.Matrix4().makeTranslation(x, 5.8, 11.5)); B.box(3.2, 4.2, 0.4, 0x2a2218, x, 2.1, 15.05); }
    for (const sx of [-1, 1]) B.add(new THREE.SphereGeometry(4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x8c9aa2, new THREE.Matrix4().makeTranslation(sx * 9.5, 9.9, 0).scale(new THREE.Vector3(1, 0.8, 1)));
    minaret(B, -16, -0.2, -4, 30);
    for (const [x, z] of [[18, 6], [20, -6], [-20, 10]]) cypress(B, x, 0, z, 10);
  });
  // the arsenals: vaulted sheds side by side, open to the water, a galley in frame in one of them
  arsenal(B, 160, QY - 0.2, -45, 0, 5);
  flagstaff(g, B, 202, QY, -44, 'ottoman', 12);
  // the west side of the harbour: tall houses along the quay, and the fort on the point at the mouth
  for (let i = 0; i < 9; i++) { const z = -28 + i * 17 + rnd() * 4, w = 10 + rnd() * 5; B.at(-248 - rnd() * 3, QY, z, Math.PI / 2, () => house(B, G, w, 6 + rnd() * 4, 9, [0xf0e8d8, 0xe6d2b0, 0xd9b48c, 0xe8c9a0][i % 4], [0x9a5a3a, 0xa0583c, 0xb06a44][i % 3], { rows: 2, front: i % 3 === 1, glass: LAMP })); }
  wall(B, gl, [[-240, 128], [-240, 172], [-268, 188], [-330, 182], [-352, 146], [-340, 120]], { h: 9, w: 4, col: WALL, floor: -1, ends: true }); // Firkas
  bastion(B, gl, -262, 186, -0.4, 22, 9, WALL, -1);
  B.at(-300, gl(-300, 150), 150, 0.2, () => house(B, G, 18, 6, 10, 0xd8c8a6, 0x8a4a3a, { chimney: false }));
  flagstaff(g, B, -285, gl(-285, 165) + 2, 165, 'ottoman', 20);
  // the mole to the north-east, the lighthouse on its end
  mole(B, G, MOLE, { seed: 52 });
  { const [x, z] = MOLE.path[MOLE.path.length - 1]; lantern(B, G, x, MOLE.top, z, 24); }
  bastion(B, gl, 262, 40, 1.1, 22, 8, WALL, -1); // Sabbionara, where the mole leaves the shore
  // the town inside its walls, climbing from the quay; mosques and minarets over every quarter
  wall(B, gl, TOWN_WALL, { h: 13, w: 7, towers: false, merlons: false, col: WALL, floor: 1 });
  for (let i = 1; i < TOWN_WALL.length - 1; i++) { const [x, z] = TOWN_WALL[i]; bastion(B, gl, x, z, Math.atan2(x, z + 200), 48, 13, WALL, 1); }
  const mosques = [[-40, -220, 8, 26], [170, -270, 9, 28], [-290, -300, 7, 24], [330, -170, 6, 24], [40, -430, 7, 26], [-180, -120, 5.5, 22]];
  const taken = [[-150, -64, 24], [160, -64, 42], ...mosques.map(([x, z, r]) => [x, z, r * 2.6])];
  town(B, G, gl, { seed: 53, n: 560, x: 0, z: -330, w: 1000, d: 520, size: 1.25, glass: LAMP, steep: 9, walls: [0xf0e8d8, 0xe6d2b0, 0xd9b48c, 0xead9c0, 0xe8c9a0, 0xf2ece0], roofs: [0xb4482c, 0xa63f2a, 0xc0562f, 0xb06a44],
    inside: (x, z) => z < -92 && inTown(x, z) && taken.every(([a, b, r]) => Math.hypot(x - a, z - b) > r) && distWall(x, z) > 22 });
  for (const [x, z, r, h] of mosques) { mosque(B, x, gl(x, z), z, r, rnd() * 6, h); for (let k = 0; k < 3; k++) cypress(B, x + (rnd() - 0.5) * r * 5, gl(x, z), z + (rnd() - 0.5) * r * 5, 9 + rnd() * 4); }
  dome(B, 90, gl(90, -150), -150, 5, 0xe8dcc4, 0x9aa6ac); dome(B, 96, gl(96, -150), -160, 3, 0xe8dcc4, 0x9aa6ac); // the hammam on Kastelli
  // gardens and orchards outside the walls, the Sultan's flag on the walls
  for (let i = 0; i < 70; i++) { const x = (rnd() - 0.5) * 1500, z = -500 - rnd() * 300; if (!inTown(x, z) && gl(x, z) > 3) (i % 4 ? tree : (b, x2, y2, z2) => cypress(b, x2, y2, z2, 9))(B, x, gl(x, z), z, 1 + rnd() * 0.6, rnd); }
  for (const i of [2, 4, 5]) { const [x, z] = TOWN_WALL[i]; flagstaff(g, B, x, gl(x, z) + 13, z, 'ottoman', 12); }
  // coasters and caiques at the quays
  tartane(B, -205, 10, 0.05, 9); tartane(B, -205, 70, Math.PI + 0.05, 10); tartane(B, 205, -15, Math.PI, 11);
  rowboat(B, -110, -35, 1.4, 0x2f5a44); rowboat(B, -128, -36, 1.6, 0x8a3a2a); rowboat(B, 120, -36, 1.5, 0xd8cfb8);
}
const distWall = (x, z) => { let best = 1e9; for (let i = 0; i < TOWN_WALL.length - 1; i++) { const a = TOWN_WALL[i], b = TOWN_WALL[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };

export const HOMES = { island: null, venice: suda, ottoman: chania };
