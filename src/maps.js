import { shipSpec } from './fleet.js';
import { buildFortModel } from './fort.js';
import { works, wall, tower, town, minaret, dome, campanile, mole, arsenal, yard, lighters, bastion } from './works.js';

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
// The city faces the sea along the north of the chart (z > 0), behind sea walls with bastions. In front of
// the city the harbour is closed by two moles; the long western mole ends in the Koules, the sea fortress
// at the harbour mouth, and the short eastern mole in a battery. The arsenal's vaulted sheds line the inner
// harbour. Reefs lie under the walls either side.
const CITY_SHORE = [[-1700, 150, 0], [-1300, 160], [-1060, 190], [-930, 245, 10], [-860, 330], [-770, 392], [-700, 410, 8], [-560, 395, 4], [-430, 392, 2], [-330, 405, 0], [-270, 420, 0], [-210, 445, 0], [-60, 452, 0], [90, 450, 0], [230, 438, 0], [300, 410, 0], [420, 396, 2], [560, 400, 4], [700, 420, 8], [800, 392], [900, 322], [975, 240, 10], [1150, 180], [1700, 140, 0]];
const MOLES = [
  { path: [[-300, 412], [-300, 280], [-270, 172], [-170, 124], [-62, 108]], w: 15, top: 3.2, sea: -1 }, // the long western mole to the Koules
  { path: [[318, 404], [312, 280], [272, 166], [196, 130], [128, 124]], w: 14, top: 3.2, sea: 1 }, // the eastern mole
];
export const KOULES = [-44, 104], MOLE_HEAD = [118, 122], MOUTH = [36, 116], BASIN = [20, 300];
const candia = (opts = {}) => ({
  coasts: [{ outline: [...CITY_SHORE, [1700, 1800, 0], [-1700, 1800, 0]], seed: 66, H: 42, rise: 150, beach: 4, scale: 190, dry: 0.5, trees: 0.6,
    shape: (x, z, y) => { const k = smooth(560, 470, Math.abs(x)) * smooth(400, 430, z) * smooth(860, 780, z); return k && y > 1 ? y + (3.4 + (z - 430) * 0.085 - y) * k : y; },
    clear: (x, z) => Math.abs(x) < 600 && z < 880 }],
  moles: MOLES,
  shoals: [
    { x: -520, z: 345, r: 40, depth: 1.4 }, { x: -650, z: 330, r: 55, depth: 2.8 }, { x: 520, z: 345, r: 40, depth: 1.4 }, { x: 640, z: 320, r: 60, depth: 2.8 }, // the rocks under the walls
    { x: 360, z: 290, r: 34, depth: 2.6 }, { x: -380, z: 300, r: 34, depth: 2.6 }, // the banks outside the moles' roots
    ...(opts.shoals || []),
  ],
  works: (world) => works((B, G) => {
    const g = (x, z) => world.ground(x, z), lit = { glass: 0xffd98a };
    for (const m of MOLES) mole(B, m, g);
    const fort = (hull, name, at, h) => { const f = buildFortModel(shipSpec(hull, 'venice', name, 'line')); f.group.position.set(at[0], 0, at[1]); f.group.rotation.y = h; world.islandGroup.add(f.group); };
    if (!opts.koules) fort('koules', 'Koules', KOULES, PI);
    if (!opts.battery) fort('battery', 'The mole battery', MOLE_HEAD, PI + 0.3);
    // the sea walls: bastions on the points, curtain between them
    const front = [[-560, 400], [-430, 396], [-330, 410], [-272, 426], [-210, 452], [-60, 458], [90, 456], [230, 444], [300, 416], [420, 402], [560, 404]];
    wall(B, g, front, { h: 9, w: 4, towers: false, floor: 1, out: -1 });
    for (const [x, z, a] of [[-560, 405, PI + 0.5], [-430, 396, PI], [420, 402, PI], [560, 408, PI - 0.5]]) bastion(B, g, x, z, a, 26, 10, 0xc9b693, 1);
    wall(B, g, [[-560, 405], [-600, 520], [-560, 700], [-420, 840], [0, 880], [420, 840], [560, 700], [600, 520], [560, 408]], { h: 11, w: 5, towers: false, floor: 1 }); // the land walls
    for (const [x, z, a] of [[-600, 520, -PI / 2], [-560, 700, -2.3], [-420, 840, -2.7], [0, 880, 0], [420, 840, 2.7], [560, 700, 2.3], [600, 520, PI / 2]]) bastion(B, g, x, z, a + PI, 30, 12, 0xc9b693, 1);
    arsenal(B, -150, 2.4, 448, PI, 6);
    town(B, G, g, { seed: 21, n: 300, size: 1.45, x: 0, z: 640, w: 1100, d: 420, inside: (x, z) => Math.abs(x) < 540 - Math.max(0, z - 700) * 0.9 && z > 470 && !(x > -240 && x < -60 && z < 500), steep: 9, ...lit });
    for (const [x, z, h] of [[60, 560, 38], [-260, 610, 30], [300, 640, 30], [-40, 760, 34]]) campanile(B, x, g(x, z), z, h, undefined, 1.5);
    dome(B, 10, g(10, 600), 600, 17); dome(B, -360, g(-360, 700), 700, 10); dome(B, 210, g(210, 520), 520, 9);
    // the harbour quay under the walls
    wall(B, g, [[-200, 446], [90, 452], [228, 440], [292, 412]], { h: 1.2, w: 6, towers: false, merlons: false, col: 0xa89a7a, floor: 1 });
    // the Ottoman siege lines on the hills to the west: trenches and a camp
    for (let i = 0; i < 5; i++) { const x = -760 - i * 70, z = 520 + i * 40; wall(B, g, [[x, z], [x - 40, z + 50], [x + 10, z + 100]], { h: 1.4, w: 4, towers: false, merlons: false, col: 0x8a7a58 }); }
    for (let i = 0; i < 18; i++) { const x = -1000 - (i % 6) * 26, z = 640 + Math.floor(i / 6) * 30, y = g(x, z); B.cyl(0, 4.2, 4.4, i % 3 ? 0xe8dcc0 : 0xb3221a, x, y + 2.1, z, 8); }
    if (opts.extra) opts.extra(B, G, g);
  }, true),
});

export const PLACES = { strait, candia };
export { narrowsCastles };
