// Builds every campaign leg's scenario in plain Node, with nothing drawn, so tools can look at the
// geography: the same `build(c)` the game calls, with a stand-in campaign context. Timed events are run
// against a stand-in scene too, to find ships that arrive later and zones that open later.
import { MISSIONS, LEG_POOL } from '../../src/missions.js';
import { NAMES } from '../../src/story.js';
import { HULLS, shipSpec } from '../../src/fleet.js';
import { mulberry, scatterIslands } from '../../src/geo.js';
import { Shape, roughen, segDist, makeShoal } from '../../src/coast.js';
import { LEGS, HULLS as PLAYER_HULLS } from '../balance/legs.mjs';

export { PLAYER_HULLS };
export const OFFICERS = ['pilot', 'carpenter', 'gunner', 'marines'];
const ORDER = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];

// the campaign context a leg is built with (see CAMP.ctx and CAMP.startMission)
function context(L, seed) {
  const side = L.side, foe = side === 'venice' ? 'ottoman' : 'venice', own = side || 'island';
  const officers = OFFICERS.slice(0, Math.max(0, ORDER.indexOf(L.mission)));
  return {
    side, foe, own, rnd: mulberry(seed), has: (o) => officers.includes(o), carry: { ...(L.carry || {}) }, S: null,
    names: { ...NAMES[foe], friends: NAMES[own === 'island' ? 'venice' : own].friends, foes: NAMES[foe].foes },
    card: () => ({}), onOut: () => {}, onEnd: () => {},
  };
}

// a ship as the tools see it: where she starts and what she draws
function shipOf(d, t = 0) {
  const s = d.spec;
  return { id: d.id, name: s.name, cls: s.cls, hull: s.hullId, side: d.side, x: d.x, z: d.z, h: d.h, L: s.L, B: s.B, D: s.D, fixed: !!s.fixed, range: s.ai && s.ai.range, o: d.o || {}, t };
}

// Runs a leg's timed events against a stand-in scene that records what they add. An event that reads
// state the stand-in lacks is skipped; this is a picture of the map, not a simulation.
function laterArrivals(def, ships) {
  const added = [], zones = [], winds = [];
  const by = {};
  for (const s of ships) by[s.id] = { ...s, pos: { x: s.x, z: s.z }, spec: {}, ai: {}, hull: 1, hullMax: 1, hullR: 1, crewR: 1, sailR: 1, out: null };
  const S = {
    by, flag: {}, t: 0, p: { pos: { x: def.player.x, z: def.player.z }, spec: shipSpec('brig', 'venice', 'Test', 'own'), hull: 1, hullMax: 1, hullR: 1, crew: 1 },
    inZone: () => false, say: () => {}, blow: () => {}, wake: () => {}, escape: () => {}, flee: () => {},
    wind: (dir, str) => winds.push({ t: S.t, dir, str }),
    addZone: (z) => zones.push({ ...z, t: S.t }),
    add: (d) => { const s = shipOf(d, S.t); added.push(s); by[d.id] = { ...s, pos: { x: s.x, z: s.z }, spec: d.spec, ai: {}, out: null }; return by[d.id]; },
  };
  for (const e of [...(def.events || [])].sort((a, b) => a.t - b.t)) {
    S.t = e.t;
    try { e.fn(S); } catch (err) { /* depends on fight state */ }
  }
  return { added, zones, winds };
}

// One leg, ready to draw or check: plain numbers, nothing from the engine.
export function scene(L, seed = 1) {
  const c = context(L, seed);
  const leg = typeof L.leg === 'string' ? LEG_POOL[L.leg] : MISSIONS[L.mission].legs(c)[L.leg];
  const def = leg.build(c);
  const land = [];
  if (def.seedIslands) for (const i of scatterIslands(def.seedIslands[0], def.seedIslands[1])) land.push({ x: i.x, z: i.z, r: i.r, hit: i.r * 0.8, seeded: true });
  for (const i of def.islands || []) land.push({ x: i.x, z: i.z, r: i.r, hit: i.r * 0.8 });
  const ships = def.ships.map((d) => shipOf(d));
  const later = laterArrivals(def, ships);
  // forts are rocks in the water as far as ships are concerned
  for (const s of [...ships, ...later.added]) if (s.fixed) land.push({ x: s.x, z: s.z, r: s.B * 0.5 + 1, hit: s.B * 0.5 + 1, fort: s.id });
  // coasts, moles and shoals (see coast.js): the same roughened outlines and the same mole path the game builds
  const coasts = (def.coasts || []).map((c) => ({ shape: new Shape(roughen(c.outline, c.rough ?? 14, c.seed || 7)) }));
  const moles = (def.moles || []).map((m) => ({ path: m.path, w: m.w, platforms: m.platforms || [], blocks: m.blocks || [] }));
  const routes = {};
  for (const [name, r] of Object.entries(L.routes || {})) if (Array.isArray(r)) routes[name] = r;
  return {
    name: L.name, title: leg.title, mission: L.mission, side: L.side, seed,
    env: def.env || 'noon', wind: def.wind, player: def.player, land, coasts, moles, shoals: (def.shoals || []).map(makeShoal), zones: def.zones || [],
    current: def.current || null, ships, arrivals: later.added, laterZones: later.zones, windShifts: later.winds, routes,
    objective: typeof def.objective === 'function' ? '' : def.objective || '',
  };
}

// every leg the balance grid knows, optionally filtered by a regex on its name ("m1V The run")
export function scenes(filter, seed) {
  const re = filter ? new RegExp(filter, 'i') : null;
  return LEGS.filter((L) => !re || re.test(L.name)).map((L) => scene(L, seed));
}

export const hullStats = (h) => ({ hull: h, L: HULLS[h].L, B: HULLS[h].B, D: HULLS[h].D });

// How far inside land a point is: positive on land, negative at sea (the distance to the nearest shore,
// as far as it matters). Round islands count from the line a ship hits; forts are left out, since ships
// sail right up to them. Coasts count from the shore; moles from their edge, with gun platforms and the
// forts on their heads.
export function landDepth(sc) {
  const circles = sc.land.filter((l) => !l.fort);
  for (const m of sc.moles) for (const [x, z, r] of [...m.platforms, ...m.blocks]) circles.push({ x, z, hit: r });
  return (x, z) => {
    let d = -1e9;
    for (const l of circles) d = Math.max(d, l.hit - Math.hypot(x - l.x, z - l.z));
    for (const c of sc.coasts) d = Math.max(d, c.shape.sdf(x, z));
    for (const m of sc.moles) d = Math.max(d, m.w / 2 - segDist(m.path, x, z));
    return d;
  };
}
