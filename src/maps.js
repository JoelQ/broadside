import { shipSpec } from './fleet.js';
import { buildFortModel } from './fort.js';
import { works, wall, tower, town, minaret, dome, campanile, mole, lantern, arsenal, yard, lighters, bastion, smoke, blaze, palazzo, basilica } from './works.js';
import { mulberry } from './geo.js';
import { smoothPath } from './coast.js';
import { shade } from './geo.js';

// Places: the land, water and works a mission's fights are set in, as data a scenario spreads into
// itself (coasts, moles, shoals, current, works). A place is drawn the same in every leg set in it;
// the legs in missions.js decide only who is where. See coast.js for how a coast becomes land.
//
// How a place is made, so the next one can be made the same way:
//   1. Author the shore as a few dozen points; let roughen() make it irregular. Keep rough at 0
//      where a straight edge means something (a quay, a castle's footing).
//   2. Give the water its rules from the same points: the current follows the channel, shoals sit
//      off the points and in the slack water, forts stand where the shore commands a passage.
//   3. Flatten the ground where a town stands (shape), keep trees off it (clear), then build the town.
//   4. Only add works that tell you something about the fight: a mole you can hide behind, the
//      castle whose arc you are about to cross, the yard where the ship you came to burn is lying.
const PI = Math.PI;
const lerpAt = (pts, z) => {
  if (z <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][1]) { const a = pts[i - 1], b = pts[i]; return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]); }
  return pts[pts.length - 1][0];
};
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// flatten the ground toward height `to` inside a rounded box (for a town), easing out over `edge` yards
const flatten = (cx, cz, hw, hd, to, edge = 40) => (x, z, y) => {
  const k = smooth(hw + edge, hw, Math.abs(x - cx)) * smooth(hd + edge, hd, Math.abs(z - cz));
  return k && y > 1.5 ? y + (Math.max(to, Math.min(y, to + (y - to) * 0.25)) - y) * k : y;
};
const both = (...fs) => (x, z, y) => fs.reduce((v, f) => f(x, z, v), y);

// ---------- the Dardanelles ----------
// The strait runs south (the Aegean, z < 0) to north. The Narrows, a little above the middle of the chart,
// are three hundred yards across, with a castle on each shore: Kilitbahir on the European side, the
// Sultan's castle and the town of Çanakkale on the Asian. Above them the channel bends round Nara point,
// and in the bay on the European shore behind it a new flagship is fitting out.
const W_BANK = [[-560, -1700], [-470, -1050], [-420, -820], [-330, -690], [-300, -630, 6], [-350, -560], [-395, -470], [-375, -380], [-320, -300], [-255, -225], [-200, -160], [-165, -112], [-152, -70, 2], [-160, -22, 4],
  [-205, 40], [-290, 100], [-372, 162], [-392, 232], [-345, 292], [-272, 330, 5], [-252, 392], [-282, 470], [-322, 560], [-352, 680], [-382, 820], [-422, 1000], [-470, 1700]];
const E_BANK = [[490, -1700], [440, -1050], [400, -820], [330, -700], [290, -640, 6], [340, -560], [425, -470], [435, -380], [380, -300], [300, -230], [220, -160], [172, -100], [150, -50, 2], [158, 4, 4],
  [205, 70], [250, 150], [232, 240], [165, 300], [125, 342, 5], [150, 402], [232, 470], [302, 560], [342, 680], [372, 820], [412, 1000], [462, 1700]];
const narrowsCastles = { west: [-140, -66], east: [139, -46] };
// The current runs down the channel, strongest in mid-stream and stronger where the channel is narrow;
// near each shore there is a back-eddy setting up-stream. Out past the capes it dies away.
function straitCurrent(x, z) {
  const zz = Math.max(-1100, Math.min(1100, z)), w = lerpAt(W_BANK, zz), e = lerpAt(E_BANK, zz), hw = (e - w) / 2, c = (e + w) / 2;
  const dz = 30, tx = (lerpAt(W_BANK, zz + dz) + lerpAt(E_BANK, zz + dz) - lerpAt(W_BANK, zz - dz) - lerpAt(E_BANK, zz - dz)) / 4, tl = Math.hypot(tx, dz), ux = tx / tl, uz = dz / tl;
  const u = Math.abs(x - c) / hw, sea = smooth(-950, -700, z), k = Math.min(1.25, Math.pow(290 / hw, 0.45)) * sea;
  const v = u < 0.7 ? -(3 * (1 - (u / 0.7) ** 2) + 0.3) * k : u < 0.97 ? 1.1 * sea : 0;
  return [ux * v, uz * v];
}
const strait = (opts = {}) => ({
  coasts: [
    { outline: [...W_BANK, [-1800, 1700, 0], [-1800, -1700, 0]], seed: 31, H: 46, rise: 55, beach: 6, scale: 120, dry: 0.55, trees: 0.9,
      shape: both(flatten(-215, -88, 55, 45, 4), flatten(-415, 200, 60, 60, 3.5)), clear: (x, z) => (Math.abs(x + 205) < 75 && Math.abs(z + 85) < 65) || (Math.abs(x + 420) < 70 && Math.abs(z - 205) < 75) },
    { outline: [...E_BANK, [1800, 1700, 0], [1800, -1700, 0]], seed: 47, H: 30, rise: 90, beach: 9, scale: 170, dry: 0.65, trees: 0.7,
      shape: flatten(265, -60, 95, 120, 3.2), clear: (x, z) => Math.abs(x - 265) < 115 && Math.abs(z + 60) < 140 },
  ],
  current: straitCurrent,
  wind: { dir: PI - 1.4, str: 1, steady: true }, // off the European hills, across the channel: a reach up the strait, close-hauled into the bay
  shoals: [
    { x: -282, z: -652, r: 24, depth: 1.4 }, { x: 272, z: -655, r: 22, depth: 1.4 }, // rocks off the capes
    { x: 390, z: -420, r: 55, depth: 2.8 }, { x: -340, z: -430, r: 42, depth: 2.8 }, // the spits in the bays inside the mouth
    { x: -228, z: -232, r: 30, depth: 2.8 }, { x: 245, z: -215, r: 30, depth: 2.8 }, // the slack water below the castles
    { x: -190, z: 60, r: 30, depth: 2.8 }, { x: 222, z: 95, r: 34, depth: 2.8 },
    { x: -262, z: 330, r: 22, depth: 1.4 }, { x: 118, z: 350, r: 20, depth: 1.4 }, // reefs off the points at the bend
    { x: -300, z: 118, r: 30, depth: 2.8 }, // the bank at the mouth of the bay where the flagship lies
    ...(opts.shoals || []),
  ],
  works: (world) => works((B, G) => {
    const g = (x, z) => world.ground(x, z);
    // Kilitbahir: a three-lobed keep inside a heart-shaped wall, on the European point
    const [kx, kz] = narrowsCastles.west;
    wall(B, g, [[kx - 10, kz - 22], [kx - 48, kz - 46], [kx - 92, kz - 30], [kx - 98, kz + 6], [kx - 70, kz + 34], [kx - 32, kz + 30], [kx - 10, kz + 18]], { h: 8, w: 3.2, ends: true, towerR: 5, floor: 0.5 });
    for (const [dx, dz] of [[-48, -6], [-58, 6], [-44, 10]]) tower(B, g, kx + dx, kz + dz, 9, 20, 0xc9b896, 0.5);
    if (!opts.castleShips) { const f = buildFortModel(shipSpec('castle', 'ottoman', 'Kilitbahir', 'poor', { bow: { n: 3 } })); f.group.position.set(kx, 0, kz); f.group.rotation.y = PI / 2; world.islandGroup.add(f.group); }
    town(B, G, g, { seed: 11, n: 22, x: -215, z: -95, w: 120, d: 100, inside: (x, z) => Math.hypot(x - kx + 50, z - kz) > 58, glass: 0x7d6a48 });
    minaret(B, -238, g(-238, -128), -128, 20);
    // the Sultan's castle: a square keep with corner towers in a walled court, the town of Çanakkale around it
    const [ex, ez] = narrowsCastles.east;
    wall(B, g, [[ex + 8, ez - 30], [ex + 70, ez - 34], [ex + 76, ez + 28], [ex + 8, ez + 32]], { h: 8, w: 3.2, ends: true, towerR: 5, floor: 0.5 });
    B.box(26, 22, 26, 0xc9b896, ex + 44, g(ex + 44, ez) + 9, ez); B.box(27, 0.8, 27, 0xa89a7a, ex + 44, g(ex + 44, ez) + 20, ez);
    for (const [dx, dz] of [[-13, -13], [13, -13], [13, 13], [-13, 13]]) tower(B, g, ex + 44 + dx, ez + dz, 3.4, 22, 0xc9b896);
    if (!opts.castleShips) { const f = buildFortModel(shipSpec('castle', 'ottoman', 'Kale-i Sultaniye', 'poor', { bow: { n: 3 } })); f.group.position.set(ex, 0, ez); f.group.rotation.y = -PI / 2; world.islandGroup.add(f.group); }
    town(B, G, g, { seed: 12, n: 70, x: 280, z: -60, w: 190, d: 250, inside: (x, z) => !(x > ex - 5 && x < ex + 85 && Math.abs(z - ez) < 42), glass: 0x7d6a48 });
    minaret(B, 262, g(262, -120), -120, 24); minaret(B, 318, g(318, 10), 10, 22); dome(B, 300, g(300, -150), -150, 7);
    // the yard in the bay above the bend, where the new flagship is fitting out
    yard(B, g, -400, 186, PI / 2 + 0.35); yard(B, g, -405, 225, PI / 2 + 0.1);
    town(B, G, g, { seed: 13, n: 14, x: -440, z: 205, w: 70, d: 90, glass: 0x7d6a48 });
    wall(B, g, [[-372, 140], [-395, 172], [-404, 232], [-372, 270]], { h: 2.2, w: 6, towers: false, merlons: false, col: 0xa89a7a, floor: 0.6 }); // the quay
    if (opts.fittingOut) lighters(B, opts.fittingOut[0], opts.fittingOut[1], 0.4, 3, 7);
  }),
});

// ---------- Candia ----------
// The city faces the sea along the north of the chart (z > 0). Its fame was its walls: a ring of great
// arrowhead bastions and a ditch, rising from the sea at both ends and climbing the hill behind, which held
// for more than twenty years. The harbour itself was small and man-made: a basin closed by two moles, the
// long western one ending in the Koules (Rocca a Mare), the eastern in a battery, with the arsenal's vaulted
// sheds along the inner quay. Mount Juktas stands behind the city and Dia lies out to sea. On the day of
// the assault the city is burning and the Ottoman trenches are dug right up to the bastions.
const CITY_SHORE = [[-1700, 150, 0], [-1300, 160], [-1060, 190], [-930, 245, 10], [-860, 330], [-770, 392], [-700, 405, 2], [-560, 395, 4], [-430, 392, 2], [-330, 405, 0], [-270, 420, 0], [-210, 445, 0], [-60, 452, 0], [90, 450, 0], [230, 438, 0], [300, 410, 0], [420, 396, 2], [560, 400, 4], [700, 408, 2], [800, 392], [900, 322], [975, 240, 10], [1150, 180], [1700, 140, 0]];
// the trace of the walls, from the sea at the west round the hill to the sea at the east
const RING = [[-700, 402], [-770, 610], [-700, 830], [-500, 1010], [-200, 1090], [200, 1090], [500, 1010], [700, 830], [770, 610], [700, 404]];
const inRing = (x, z) => { let c = false; const p = [...RING, [700, 440], [-700, 440]]; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c && z > 430; };
const ringDist = (x, z) => { let best = 1e9; for (let i = 0; i < RING.length - 1; i++) { const a = RING[i], b = RING[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
export const KOULES = [-44, 104], MOLE_HEAD = [118, 122], MOUTH = [36, 116], BASIN = [20, 300];
// the moles: rounded where they bend, a gun platform standing out to sea at the chosen bends, and a sea wall
// along the outer edge that stops shot like the mole itself (parapet: how far it stands above the walkway)
const moleDef = (pts, w, bends) => ({
  path: smoothPath(pts, 12), w, top: 3.2, parapet: 2, basin: BASIN,
  platforms: bends.map((i) => { const [x, z] = pts[i], dx = x - BASIN[0], dz = z - BASIN[1], d = Math.hypot(dx, dz); return [x + (dx / d) * w * 0.55, z + (dz / d) * w * 0.55, w * 0.62]; }),
});
const MOLES = [
  { ...moleDef([[-300, 412], [-300, 280], [-270, 172], [-170, 124], [-62, 108]], 19, [1, 2, 3]), blocks: [[KOULES[0], KOULES[1], 15], ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [KOULES[0] + a * 11, KOULES[1] + b * 11, 9])] }, // the long western mole to the Koules
  { ...moleDef([[318, 404], [312, 280], [272, 166], [196, 130], [128, 124]], 18, [1, 2]), blocks: [[MOLE_HEAD[0], MOLE_HEAD[1], 12]] }, // the eastern mole, the lantern on it, the battery on its head
];
const candiaGround = (x, z, y) => {
  if (y <= 1) return y;
  const hill = 3.4 + Math.max(0, z - 440) * 0.075; // the city climbs the hill in terraces
  const inside = inRing(x, z), d = ringDist(x, z);
  if (inside) y = y + (hill - y) * smooth(0, 30, d) + (hill - y) * (1 - smooth(0, 30, d));
  else if (d < 34 && z > 420) y = Math.max(1.2, Math.min(y, hill) - 9 * smooth(34, 12, d)); // the ditch
  // Mount Juktas: a long ridge with a peak at its north end, gullied
  const j = Math.hypot((x - 200) / 380, (z - 1640) / 330), r = Math.hypot((x - 60) / 640, (z - 1500) / 260);
  const gully = 0.75 + 0.25 * Math.sin(Math.atan2(x - 200, z - 1640) * 9 + j * 6) * Math.min(1, j);
  return y + (300 * Math.exp(-j * j * 2.4) + 110 * Math.exp(-r * r * 2)) * gully;
};
const candia = (opts = {}) => ({
  coasts: [
    { outline: [...CITY_SHORE, [1700, 1800, 0], [-1700, 1800, 0]], seed: 66, H: 46, rise: 150, beach: 4, scale: 190, dry: 0.55, trees: 0.5, shape: candiaGround, clear: (x, z) => Math.abs(x) < 820 && z < 1150 },
    { outline: Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * PI * 2; return [380 + Math.sin(a) * (420 + (i % 3) * 60), -1480 + Math.cos(a) * (170 + (i % 2) * 40)]; }), seed: 67, H: 70, rise: 90, scale: 160, dry: 0.7, trees: 0.2 }, // Dia, out to sea
  ],
  moles: MOLES,
  shoals: [
    { x: -520, z: 345, r: 40, depth: 1.4 }, { x: -650, z: 330, r: 55, depth: 2.8 }, { x: 520, z: 345, r: 40, depth: 1.4 }, { x: 640, z: 320, r: 60, depth: 2.8 }, // the rocks under the walls
    { x: 360, z: 290, r: 34, depth: 2.6 }, { x: -380, z: 300, r: 34, depth: 2.6 }, // the banks outside the moles' roots
    ...(opts.shoals || []),
  ],
  works: (world) => {
    const group = works((B, G) => {
      const g = (x, z) => world.ground(x, z), glass = 0xffd98a, rnd = mulberry(1669), WALL = 0xcdb894;
      MOLES.forEach((m, i) => mole(B, G, m, { seed: 40 + i }));
      { const p = MOLES[1].path.reduce((a, q) => (Math.hypot(q[0] - 222, q[1] - 140) < Math.hypot(a[0] - 222, a[1] - 140) ? q : a)); lantern(B, G, p[0], 3.2, p[1] + 2, 22); }
      const fort = (hull, name, at, h) => { const f = buildFortModel(shipSpec(hull, 'venice', name, 'line')); f.group.position.set(at[0], 0, at[1]); f.group.rotation.y = h; world.islandGroup.add(f.group); };
      if (!opts.koules) fort('koules', 'Koules', KOULES, PI);
      if (!opts.battery) fort('battery', 'The mole battery', MOLE_HEAD, PI + 0.3);
      // the sea walls rise straight from the water either side of the harbour, and close it at the back
      wall(B, g, [[-700, 404], [-560, 397], [-430, 394], [-330, 408], [-300, 418]], { h: 15, w: 6, towers: false, floor: -1, out: -1 });
      wall(B, g, [[318, 412], [420, 398], [560, 402], [700, 406]], { h: 15, w: 6, towers: false, floor: -1, out: -1 });
      wall(B, g, [[-300, 470], [-60, 476], [90, 474], [300, 466]], { h: 13, w: 6, towers: false, floor: 1, out: -1 });
      for (const [x, z, a, s] of [[-700, 400, PI + 0.6, 62], [-430, 392, PI, 40], [430, 394, PI, 40], [700, 402, PI - 0.6, 62]]) bastion(B, g, x, z, a, s, 16, WALL, -1);
      // the land walls: great bastions on every angle of the trace, a curtain between them, the ditch outside
      wall(B, g, RING, { h: 17, w: 8, towers: false, merlons: false, floor: 1 });
      for (let i = 1; i < RING.length - 1; i++) { const [x, z] = RING[i], c = [0, 760]; bastion(B, g, x, z, Math.atan2(x - c[0], z - c[1]), 70, 18, WALL, 1); }
      for (const [x, z, a] of [[-460, 1018, -0.5], [0, 1092, 0], [460, 1018, 0.5]]) B.box(14, 12, 9, shade(WALL, 0.9), x, g(x, z) + 8, z, 0, a); // the gates
      // the arsenal: two long rows of vaulted sheds along the inner quay
      arsenal(B, -175, 2.4, 452, PI, 8); arsenal(B, 160, 2.4, 450, PI, 9);
      wall(B, g, [[-300, 416], [-270, 428], [-210, 452], [-60, 458], [90, 456], [230, 444], [300, 416], [318, 408]], { h: 1.2, w: 10, towers: false, merlons: false, col: 0xa89a7a, floor: 1 }); // the quay
      for (const [x0, x1, z0] of [[-300, -260, 418], [-260, -210, 430], [-210, 230, 452], [230, 300, 430], [300, 320, 410]]) B.box(x1 - x0, 3, 480 - z0, 0xa89a7a, (x0 + x1) / 2, 1.1, (z0 + 480) / 2); // the quay's paving
      // palazzi along the harbour front, then the city climbing the hill to the walls
      for (let i = 0; i < 10; i++) { const x = -270 + i * 58 + (rnd() - 0.5) * 8, z = 512 + (rnd() - 0.5) * 6; B.at(x, g(x, z), z, PI, () => palazzo(B, G, 22 + rnd() * 10, 13 + rnd() * 6, 16, [0xe8dcc4, 0xd8b89a, 0xe0c8a0, 0xcfa98a][i % 4], glass)); }
      town(B, G, g, { seed: 21, n: 520, size: 1.7, x: 0, z: 760, w: 1500, d: 680, inside: (x, z) => inRing(x, z) && ringDist(x, z) > 30 && z > 540, steep: 12, glass });
      basilica(B, 40, g(40, 640), 640, PI, 1.4); // St Mark's
      basilica(B, -300, g(-300, 760), 760, PI + 0.3, 1.1); // St Titus
      dome(B, 300, g(300, 700), 700, 13); dome(B, -120, g(-120, 900), 900, 11);
      for (const [x, z, h] of [[-420, 620, 34], [380, 600, 36], [200, 860, 32], [-200, 640, 30], [520, 760, 28], [-520, 820, 28], [120, 980, 30]]) campanile(B, x, g(x, z), z, h, undefined, 1.6);
      // the siege: houses burning inside the walls, Ottoman trenches zigzagging up to the bastions, batteries and the camp
      for (const [x, z] of [[-560, 760], [-430, 930], [480, 900], [-150, 1020], [610, 700], [-640, 650], [300, 1000]]) blaze(B, G, x, g(x, z), z, 2.2, rnd);
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const x0 = side * (900 + i * 60), z0 = 560 + i * 170, pts = [];
        for (let k = 0; k < 6; k++) pts.push([x0 - side * k * 22 + (k % 2 ? side * 26 : -side * 26), z0 + k * 18]);
        wall(B, g, pts, { h: 1.6, w: 5, towers: false, merlons: false, col: 0x8a7a58 });
        if (i % 2) for (let k = 0; k < 3; k++) B.bar([pts[5][0] + k * 5, g(pts[5][0], pts[5][1]) + 1.5, pts[5][1]], [pts[5][0] + k * 5 - side * 3, g(pts[5][0], pts[5][1]) + 2, pts[5][1] + 4], 0.5, 0x1c1c1e, 7);
      }
      for (let i = 0; i < 40; i++) { const x = (i % 2 ? 1 : -1) * (1150 + ((i * 37) % 160)), z = 700 + ((i * 53) % 300), y = g(x, z); if (y > 2) B.cyl(0, 4.4, 4.6, i % 4 ? 0xe8dcc0 : 0xb3221a, x, y + 2.2, z, 8); }
      if (opts.extra) opts.extra(B, G, g);
    }, true);
    for (const [x, z, sd] of [[-560, 760, 1], [-430, 930, 2], [480, 900, 3], [-150, 1020, 4], [610, 700, 5], [300, 1000, 6]]) smoke(group, x, world.ground(x, z) + 14, z, 150, [0.35, 0.12], sd);
    return group;
  },
});

export const PLACES = { strait, candia };
export { narrowsCastles };
