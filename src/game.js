import { Sea } from './sea.js';
import { Ship, AMMO, AMMO_KEYS, CAL, SAILS, TOP, HANDLING, noGoHalf, wrap, clamp, polar, pointOfSail } from './ship.js';
import { PLAYER_SPEC, ENEMIES, KITS, KIT_OF, kitCost, SHOPS, REPAIR } from './data.js';
import { updateAI, newAI } from './ai.js';
import { HULLS, GRADE, OFFICERS, shipSpec, GALLEY_KIT } from './fleet.js';
import { CAMP } from './campaign.js';
import { steerTo } from './ai.js';
import { rng, seedRng, rngSeed } from './rng.js';
import { portrait } from './portraits.js';
import { NAMES } from './story.js';
import { BERTH, MOORINGS } from './quay.js';
import { Vec3 } from './vec.js';

// The game itself: every ship, every shot, the fights and the campaign around them, as rules that run anywhere.
// Nothing here draws, plays a sound or touches the page: what a player would see or hear goes to the view (V), which
// the browser build fills in (view.js) and a headless run leaves empty (NO_VIEW below). So the balance tools play
// exactly the game a player gets, in plain Node, as fast as the rules go.
// start(view) sets it going and returns G, the game's state, with G.api for the view, the campaign and the tools.

// rand and gauss decide the fight and come from the seeded source; vrand is for looks only
const rand = (a, b) => a + rng() * (b - a);
const vrand = (a, b) => a + Math.random() * (b - a);
const gauss = () => (rng() + rng() + rng() - 1.5) * 2; // ~unit std
const GRAV = 22;
let BOARD_SPEED = 6.5;
const BOARD_SLOW = 7; // grapples only hold a ship making less than this (about 6 knots): slow her first
let BOARD_RANGE = 33; // set from the two ships' beams whenever the target changes

// ---------- the view ----------
// Everything the game shows or plays goes through V. A headless run has no view: every call does nothing, so the
// rules can't depend on one. `on` says whether anything is drawn, so work done only for looks can be skipped.
const noop = () => {};
const quiet = new Proxy({}, { get: () => noop });
const memory = {};
export const NO_VIEW = new Proxy({
  on: false, fx: quiet, sfx: quiet, camVol: () => 0,
  store: { get: (k) => (k in memory ? memory[k] : null), set: (k, v) => { memory[k] = String(v); } },
}, { get: (t, k) => (k in t ? t[k] : noop) });
let V = NO_VIEW, fx = quiet, sfx = quiet, store = NO_VIEW.store;
const camVol = (p) => V.camVol(p);
const sea = new Sea(), world = sea;

// ---------- game state ----------
const freshStats = () => ({ volleys: 0, shots: 0, hits: 0, sunk: 0, captured: 0, time: 0 });
const G = {
  state: 'title', level: 0, gold: 0, earned: 0, fit: {}, // fit[ship][fitting] = level
  player: null, enemy: null, ships: [], sc: {}, mode: 'skirmish', ai: newAI(), balls: [], pending: [], paused: false, trophies: [], trophyShips: [],
  aiGrapple: 0, boardCd: 0, endT: 0, outcome: null, bd: null, t: 0, shake: 0, focus: 'player', volley: 0, shop: null,
  stats: freshStats(), coach: null, ship: 'wren',
  // the fight recorder's hooks: no-ops here, the playtest build's recorder (playtest.js) when it is installed
  rec: { battleStart() {}, battleEnd() {}, frame: (dt) => dt, input() {} },
  cam: { yaw: 0, pitch: 0.4, dist: 78, zoom: 1, mode: 'helm', angle: 0.4, look: new Vec3(0, 7, -20), pos: new Vec3(40, 30, 90) }, // where the view's camera is: G.focus says what it follows
};
// The balance harness seeds every fight so it can be replayed. The waves (which shot can hit) run on the
// world clock, so that starts again too.
G.seedRng = (seed) => { seedRng(seed); sea.time = 0; }; G.rngSeed = rngSeed;
// The tuning tables, so the balance harness can try other numbers in a fight without a rebuild (tools/balance/README.md).
G.dials = { HANDLING, AMMO, CAL, SAILS, HULLS, GRADE, OFFICERS, PLAYER_SPEC, ENEMIES, KITS };

// Any ship you have boarded and taken is yours to command. In your hands she keeps her hull
// and her handling, under your colours and with your gunners.
const ALL_KITS = { ...KITS, galley: GALLEY_KIT };
const camId = (id) => typeof id === 'string' && id !== 'wren'; // campaign ships are stable entries; skirmish ships are numbers
const sid = (id) => (id === 'wren' || isNaN(+id) ? id : +id);
const kitOf = (id) => ALL_KITS[camId(id) ? HULLS[CAMP.entry(id).hull].kit : KIT_OF[id]];
function hullSpec(id) {
  if (camId(id)) { const e = CAMP.entry(id); return shipSpec(e.hull, CAMP.livery(), e.name, 'own', { stock: {} }); }
  if (id === 'wren') return PLAYER_SPEC;
  const es = ENEMIES[id];
  return { ...es, sailCol: PLAYER_SPEC.sailCol, emblem: 'cross', emblemCol: PLAYER_SPEC.emblemCol, flagCol: PLAYER_SPEC.flagCol, crewCols: PLAYER_SPEC.crewCols, disp: PLAYER_SPEC.disp, dmg: 1, melee: 1, reload: es.reload - 1, ai: PLAYER_SPEC.ai, stock: {} };
}
const fitOf = (id) => G.fit[id] || (G.fit[id] = {});
function playerSpec() {
  const b = hullSpec(G.ship), lv = fitOf(G.ship);
  const mods = { speed: 1, turn: 1, arc: 1, reload: 1, melee: 1, evade: 1, boardReach: 1, boardSpeed: 1, swivel: 1, reach: 1, dmg: 1, oars: 1, guns: 0, hull: 0, crew: 0, sweeps: 0 };
  for (const it of kitOf(G.ship).items) {
    const n = lv[it.id] || 0;
    for (const k in it.mul || {}) mods[k] *= it.mul[k] ** n;
    for (const k in it.add || {}) mods[k] += it.add[k] * n;
  }
  return { ...b, mods, guns: b.guns + mods.guns, hull: b.hull + mods.hull, crew: b.crew + mods.crew, speed: b.speed * mods.speed, turn: b.turn * mods.turn, arc: b.arc * mods.arc, reach: mods.reach, sweeps: mods.sweeps, oars: b.oars ? b.oars * mods.oars : 0 };
}
function buildPlayer(fresh) {
  const old = G.player, p = new Ship(playerSpec(), true);
  p.reloadMult = p.spec.mods.reload; p.melee = (p.spec.melee || 1) * p.spec.mods.melee; p.quickShot = G.mode === 'campaign' && CAMP.has('gunner'); p.evade = p.spec.mods.evade; p.dmgMult *= p.spec.mods.dmg;
  if (old) {
    if (!fresh) { p.hull = old.hull + p.hullMax - old.hullMax; p.sails = old.sails + p.sailsMax - old.sailsMax; p.crew = old.crew + p.crewMax - old.crewMax; }
    p.stock = old.stock; p.pos.copy(old.pos); p.heading = old.heading; p.speed = old.speed; p.sailLevel = old.sailLevel; p.input = old.input;
    V.dropShip(old);
  }
  V.addShip(p);
  p.side = 0; p.name = p.spec.name;
  G.player = p;
  G.ships = [p, ...G.ships.filter((s) => !s.isPlayer)];
}
// every ship in the fight: side 0 is yours, side 1 the enemy's
function addShip(spec, side, x, z, heading, o = {}) {
  const s = new Ship({ seedSign: Math.random() < 0.5 ? -1 : 1, ...spec }, false);
  s.side = side; s.id = o.id || null; s.name = spec.name;
  s.pos.set(x, 0, z); s.heading = heading; s.speed = o.speed ?? (s.anchored || spec.fixed ? 0 : 6); s.sailLevel = o.sail ?? 2;
  if (o.hull != null) s.hull = s.hullMax * o.hull; if (o.sails != null) s.sails = s.sailsMax * o.sails; if (o.crew != null) s.crew = Math.round(s.crewMax * o.crew);
  s.ai = o.noAI ? null : newAI();
  if (spec.fixed) world.islands.push((s.rock = { x, z, r: spec.B * 0.5 + 1, h: spec.D, soft: true }));
  V.addShip(s); G.ships.push(s);
  return s;
}
function clearShips() {
  for (const s of G.ships) if (s !== G.player) V.dropShip(s);
  G.ships = [G.player]; G.enemy = null;
}
const foesOf = (s) => G.ships.filter((o) => o.side !== s.side && o.active);
const nearest = (s, list) => list.reduce((b, o) => (!b || sep(s, o) < sep(s, b) ? o : b), null);
// An AI captain's choice of target: the nearest enemy, sticking with the one she has unless another is much closer.
// Ships leave forts alone unless told to go for them.
function pickTarget(s) {
  let best = null, bd = 1e9;
  for (const o of foesOf(s)) {
    if (o.spec.fixed && !(s.ai && s.ai.siege)) continue;
    if (s.spec.fixed && sep(s, o) > s.range('round') * 1.3) continue;
    const d = sep(s, o) * (o === s.target ? 0.7 : 1) * (s.ai && s.ai.prefer === o ? 0.3 : 1);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// Your own target: keep the one you chose while she fights, else take the nearest.
function retarget(force) {
  const p = G.player;
  if (G.enemy && G.enemy.active && !force) return;
  const f = foesOf(p), n = nearest(p, f.filter((o) => !o.spec.fixed)) || nearest(p, f);
  if (n) setTarget(n);
}
function setTarget(e) {
  if (G.enemy === e) return;
  G.enemy = e; G.player.target = e;
  if (!e) return;
  BOARD_RANGE = Math.round((20 + (G.player.spec.B + e.spec.B) * 0.8) * G.player.spec.mods.boardReach);
  V.target(e, BOARD_RANGE);
}
function cycleTarget() {
  const p = G.player, f = foesOf(p).sort((a, b) => sep(p, a) - sep(p, b));
  if (!f.length) return;
  setTarget(f[(f.indexOf(G.enemy) + 1) % f.length]);
  toast(`Target: ${G.enemy.name}`, '', 1200);
}
function moor() {
  const p = G.player, b = BERTH;
  p.pos.set(4.4 + p.spec.B / 2, 0, b.z); p.heading = b.heading; p.speed = 0; p.sailLevel = 0; p.input.turn = 0; p.rudder = 0;
  p.sinking = 0; p.struck = false; p.fire = 0; p.boardView = null;
}

// ---------- what the player is told ----------
// a line across the screen, and a word floating over the water; the view shows them
const toast = (text, cls = '', ms = 2600) => { if (!G.fast) V.toast(text, cls, ms); };
const floater = (text, cls, pos) => { if (!G.fast) V.floater(text, cls, pos); };
const said = {};
function toastOnce(key, gap, ...a) { if ((said[key] || -99) + gap > G.t) return; said[key] = G.t; toast(...a); }
const _v = new Vec3(), _m = new Vec3(), _l = new Vec3();
// Damage is summed per volley and shown once, so you can read what a broadside did.
function tally(ship, hull, sail, crew, rake, pos) {
  const a = ship.acc || (ship.acc = { hull: 0, sail: 0, crew: 0, rake: false, t: 0, pos: new Vec3() });
  if (a.t <= 0) { a.t = 0.55; a.hull = a.sail = a.crew = 0; a.rake = false; }
  a.hull += hull; a.sail += sail; a.crew += crew; a.rake = a.rake || rake; a.pos.copy(pos);
}
function flushTally(ship, dt) {
  const a = ship.acc;
  if (!a || a.t <= 0 || (a.t -= dt) > 0) return;
  const parts = [];
  if (a.hull >= 1) parts.push(`−${Math.round(a.hull)} hull`);
  if (a.sail >= 1) parts.push(`−${Math.round(a.sail)} sails`);
  if (a.crew >= 1) parts.push(`−${Math.round(a.crew)} crew`);
  if (!parts.length) return;
  a.pos.y = ship.y + ship.mastH * 0.6;
  floater((a.rake ? 'RAKE!  ' : '') + parts.join('  '), (ship.isPlayer ? 'bad' : 'good') + (a.rake ? ' rake' : ''), a.pos);
}

// ---------- gunnery ----------
// a ball in flight is plain numbers; the view draws one for each (V.addBall, V.dropBall)
function clearBalls() {
  for (const b of G.balls) V.dropBall(b);
  G.balls.length = 0; G.pending.length = 0;
}
const sep = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
const relSpeed = (a, b) => Math.hypot(a.fwdX * a.speed - b.fwdX * b.speed, a.fwdZ * a.speed - b.fwdZ * b.speed);
// Where along her keel (in yards from her middle, bow positive) she comes nearest to a point.
const alongKeel = (tgt, x, z) => clamp((x - tgt.pos.x) * tgt.fwdX + (z - tgt.pos.z) * tgt.fwdZ, -tgt.spec.L * 0.46, tgt.spec.L * 0.46);
// Distance from a ship to the nearest part of another's hull: what a gunner cares about.
function reach(ship, tgt) {
  const k = alongKeel(tgt, ship.pos.x, ship.pos.z);
  return Math.hypot(tgt.pos.x + tgt.fwdX * k - ship.pos.x, tgt.pos.z + tgt.fwdZ * k - ship.pos.z);
}
function inArc(ship, side, tgt, slack = 1.1) {
  if (!ship.bat[side] || !tgt) return false;
  const k = alongKeel(tgt, ship.pos.x, ship.pos.z), normal = ship.normal(side), arc = ship.bat[side].arc;
  const nx = tgt.pos.x + tgt.fwdX * k - ship.pos.x, nz = tgt.pos.z + tgt.fwdZ * k - ship.pos.z;
  const bears = Math.abs(wrap(Math.atan2(nx, nz) - normal)) <= arc || Math.abs(wrap(Math.atan2(tgt.pos.x - ship.pos.x, tgt.pos.z - ship.pos.z) - normal)) <= arc;
  return bears && Math.hypot(nx, nz) <= ship.range(ship.ammo, side) * slack;
}
// The weather gauge: the ship upwind of the other shoots through clear air.
function hasGauge(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
  return (dx * Math.sin(world.wind.dir) + dz * Math.cos(world.wind.dir)) / d > 0.4;
}
function clearShot(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, l2 = dx * dx + dz * dz;
  for (const i of world.islands) {
    if (i.soft) continue;
    const t = clamp(((i.x - a.pos.x) * dx + (i.z - a.pos.z) * dz) / l2, 0, 1);
    if (Math.hypot(a.pos.x + dx * t - i.x, a.pos.z + dz * t - i.z) < i.r * 0.9) return false;
  }
  if (world.pieces.length) { const n = Math.ceil(Math.sqrt(l2) / 12); for (let k = 1; k < n; k++) if (world.ground(a.pos.x + (dx * k) / n, a.pos.z + (dz * k) / n) > 3) return false; }
  return true;
}
const aiApi = { fire: (s, side) => fire(s, side), clearShot: (a, b) => clearShot(a, b), shotSpeed: (s) => AMMO[s.ammo].speed, reach: (a, b) => reach(a, b), strength: (s) => strength(s), inArc: (a, side, b, k) => inArc(a, side, b, k) };
function fire(ship, side) {
  if (!ship.bat[side] || ship.reload[side] > 0 || ship.sinking > 0 || ship.struck) return false;
  // while two ships are grappled nobody fires into the tangle, but the rest of the fight goes on
  const b = G.bd;
  if (G.state === 'boarding' ? ship === G.player || ship === b.foe || ship.target === G.player || ship.target === b.foe : G.state !== 'battle') return false;
  // your gunners lay on the ship you have marked if she bears, otherwise on the nearest enemy who does
  let tgt = ship.target;
  if (ship.isPlayer && !(tgt && tgt.active && inArc(ship, side, tgt, 1.12))) tgt = nearest(ship, foesOf(ship).filter((o) => inArc(ship, side, o, 1.12))) || tgt;
  let ammo = ship.ammo;
  if (ammo !== 'round') { if (ship.stock[ammo] <= 0) ammo = ship.ammo = 'round'; else ship.stock[ammo]--; }
  const n = ship.muzzles[side].length, volley = ++G.volley;
  for (let i = 0; i < n; i++) G.pending.push({ t: i * 0.075 + rng() * 0.07, ship, side, i, ammo, volley, tgt });
  ship.startReload(side);
  if (ammo !== 'round' && ship.stock[ammo] <= 0) {
    ship.ammo = 'round';
    if (ship.isPlayer) toast(`Out of ${AMMO[ammo].long.toLowerCase()} — loading round shot`);
  }
  if (ship.isPlayer) { G.stats.volleys++; G.shake = Math.max(G.shake, 0.5); G.fired = true; }
  return true;
}
function launch(p) {
  const { ship, side, ammo } = p, A = AMMO[ammo];
  if (ship.sinking > 0) return;
  ship.toWorld(ship.muzzles[side][p.i], _m);
  const normal = ship.normal(side), arc = ship.bat[side].arc;
  const R = ship.range(ammo, side);
  let aim = normal, dist = R * 0.75, h = -_m.y, gauge = 1;
  const tgt = p.tgt;
  if (tgt && tgt.sinking <= 0) {
    let tx = tgt.pos.x, tz = tgt.pos.z;
    const tt = Math.hypot(tx - _m.x, tz - _m.z) / (A.speed * 0.98);
    // spread the battery along her hull, but only over the part that is within reach
    const near = alongKeel(tgt, _m.x, _m.z), spanL = tgt.spec.L * 0.31;
    let along = (rng() * 2 - 1) * spanL;
    if (Math.hypot(tx + tgt.fwdX * along - _m.x, tz + tgt.fwdZ * along - _m.z) > R) along = clamp(near + (rng() - 0.5) * tgt.spec.L * 0.2, -tgt.spec.L * 0.44, tgt.spec.L * 0.44);
    tx += tgt.fwdX * (tgt.speed * tt + along); tz += tgt.fwdZ * (tgt.speed * tt + along);
    const dx = tx - _m.x, dz = tz - _m.z, ang = Math.atan2(dx, dz), d = Math.hypot(dx, dz);
    if (Math.abs(wrap(ang - normal)) <= arc + 0.06 && d <= R * 1.12) {
      aim = ang; dist = Math.min(d, R);
      h = (ammo === 'chain' && !tgt.spec.fixed ? tgt.mastH * 0.5 : tgt.spec.D * (tgt.spec.fixed ? 0.8 : 0.45)) + tgt.y - _m.y;
    }
    gauge = hasGauge(ship, tgt) ? 0.75 : hasGauge(tgt, ship) ? 1.15 : 1;
  }
  const steady = ship.spec.fixed || ship.anchored ? 0.75 : SAILS[ship.sailLevel].aim; // nothing steadies a gun like not moving
  const spread = ship.disp * (ammo === 'grape' ? 1.15 : 1) * (1.25 - 0.25 * ship.crewR) * steady * gauge * ((tgt && tgt.evade) || 1) * (world.wind.str > 1.3 ? Math.min(1.5, 1 + 0.5 / ship.mass) : 1); // a big hull rolls less in a gale
  aim += gauss() * spread * 1.6;
  const v = A.speed * (1 + gauss() * 0.02), v2 = v * v;
  const disc = v2 * v2 - GRAV * (GRAV * dist * dist + 2 * h * v2);
  const el = (disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (GRAV * dist))) + gauss() * spread * 1.15;
  const ce = Math.cos(el);
  const ball = { pos: _m.clone(), ammo, owner: ship, dmg: ship.dmgOf(side), cal: ship.bat[side].cal, volley: p.volley, rigged: false, vel: new Vec3(Math.sin(aim) * ce * v, Math.sin(el) * v, Math.cos(aim) * ce * v) };
  G.balls.push(ball); V.addBall(ball);
  fx.cannon(_m, Math.sin(normal), Math.cos(normal));
  sfx.cannon(0.25 + 0.75 * camVol(_m));
  if (ship.isPlayer) G.stats.shots++;
}
function hullHit(b, ship) {
  const A = AMMO[b.ammo], hv = Math.hypot(b.vel.x, b.vel.z) || 1;
  const d = (b.vel.x * ship.fwdX + b.vel.z * ship.fwdZ) / hv;
  let m = b.dmg, rake = 0;
  // a raking shot ploughs the whole length of the deck, so the longer the ship the worse it is
  if (Math.abs(d) > 0.78 && !ship.spec.fixed) { rake = (d > 0 ? 1.8 : 1.5) * clamp(ship.spec.L / 30, 0.8, 1.5); m *= rake; }
  // masonry shrugs off light shot: a battery is battered down by weight of metal
  if (ship.spec.fixed) m *= [0.35, 0.7, 1.1][['light', 'medium', 'heavy'].indexOf(b.cal.name)];
  const hd = A.hull * m, sd = b.ammo !== 'chain' ? Math.min(ship.sails, A.sail * 0.4) : 0;
  ship.hull -= hd; ship.sails -= sd;
  let kills = 0;
  if (A.kills) kills = Math.round(rand(A.kills[0], A.kills[1]) * (rake ? 1.6 : 1) * b.dmg);
  else if (rng() < A.crew * (rake ? 2.4 : 1)) kills = 1 + (rake && rng() < 0.5 ? 1 : 0);
  kills = Math.min(kills, Math.floor(ship.exposed)); // the men below decks are out of reach
  ship.crew -= kills;
  if (sd > 0) ship.rigT = 0;
  // one fire per volley at most, so a single broadside can't set three at once
  if (A.ignite && ship.litBy !== b.volley && rng() < A.ignite) {
    ship.litBy = b.volley;
    if (ship.fire === 0) floater(ship.isPlayer ? 'FIRE! Our gunners leave their guns' : 'FIRE! Her gunners leave their guns', ship.isPlayer ? 'bad rake' : 'good rake', _v.set(ship.pos.x, ship.mastH * 0.8, ship.pos.z).clone());
    // small shot starts small fires: light guns can keep one fire going, medium two, heavy three
    const most = 1 + ['light', 'medium', 'heavy'].indexOf(b.cal.name);
    ship.fire = Math.max(ship.fire, Math.min(most, ship.fire + 1)); ship.fireT = 11;
  }
  const p = b.pos;
  if (b.ammo === 'grape') fx.grape(p); else fx.wood(p, rake ? 16 : 10);
  sfx.thud(0.2 + 0.8 * camVol(p));
  tally(ship, hd, sd, kills, !!rake, p);
  if (G.onHit) G.onHit(b, ship, hd, sd, kills); // the balance harness's fight record
  if (b.owner.isPlayer) { G.stats.hits++; if (rake) G.raked = true; }
  if (ship.isPlayer) G.shake = Math.max(G.shake, 0.7);
}
function rigHit(b, ship, amt) {
  const d = Math.min(ship.sails, amt * b.dmg * SAILS[ship.sailLevel].dmg);
  ship.sails -= d; ship.rigT = 0;
  fx.canvas(b.pos, ship.spec.sailCol);
  sfx.rip(0.2 + 0.8 * camVol(b.pos));
  tally(ship, 0, d, 0, false, b.pos);
  if (G.onHit) G.onHit(b, ship, 0, d, 0);
  if (b.owner.isPlayer) G.stats.hits++;
}
function testHit(b, ship) {
  ship.toLocal(b.pos, _l);
  const sp = ship.spec, hl = sp.L / 2;
  if (Math.abs(_l.z) > hl || Math.abs(_l.x) > sp.B / 2 + 1.5) return false;
  const zf = _l.z / hl, hw = (sp.B / 2 + 0.3) * (zf > 0.2 ? 1 - ((zf - 0.2) / 0.8) * 0.7 : 1), deck = sp.D + 1.3 + (zf < -0.45 ? (+sp.castle || 0) * (2.4 + sp.L * 0.012) + 1 : zf > 0.7 && sp.fore ? 2.4 : 0);
  if (_l.y > -1.6 && _l.y <= deck && Math.abs(_l.x) <= hw) { hullHit(b, ship); return true; }
  if (!sp.fixed && _l.y > deck && _l.y < ship.mastH && Math.abs(_l.z) < hl * 0.86) {
    if (b.ammo === 'chain') { rigHit(b, ship, AMMO.chain.sail); return true; }
    if (!b.rigged) { b.rigged = true; if (rng() < 0.3) rigHit(b, ship, 2); }
  }
  return false;
}
function updateBalls(dt) {
  for (let i = G.pending.length - 1; i >= 0; i--) {
    const p = G.pending[i];
    if ((p.t -= dt) <= 0) { G.pending.splice(i, 1); launch(p); }
  }
  const ships = G.ships;
  for (let i = G.balls.length - 1; i >= 0; i--) {
    const b = G.balls[i], pos = b.pos;
    const steps = Math.max(1, Math.ceil((b.vel.length() * dt) / 1.3)), h = dt / steps;
    let done = false;
    for (let s = 0; s < steps && !done; s++) {
      b.vel.y -= GRAV * h;
      pos.addScaledVector(b.vel, h);
      for (const sh of ships) if (sh.side !== b.owner.side && sh.sinking < 3 && testHit(b, sh)) { done = true; break; }
      if (done) break;
      for (const isl of world.islands) {
        if (isl.soft) continue;
        const d = Math.hypot(pos.x - isl.x, pos.z - isl.z);
        if (d < isl.r * 1.1 * (1 - clamp(pos.y / (isl.h * 1.4), 0, 1))) { fx.wood(pos, 5); done = true; break; }
      }
      if (!done && world.pieces.length && pos.y < 30 && world.ground(pos.x, pos.z) > pos.y) { fx.wood(pos, 5); done = true; }
      if (!done && pos.y < world.height(pos.x, pos.z)) { fx.splash(pos, b.ammo === 'grape' ? 0.5 : 1); sfx.splash(camVol(pos)); done = true; }
    }
    if (b.ammo === 'fire') fx.trail(pos, 1, 0.5, 0.15, true);
    if (done) { V.dropBall(b); G.balls.splice(i, 1); }
  }
}

// ---------- collisions, fire, wake ----------
function circles(s) { const o = s.spec.L * 0.33; return [-o, 0, o].map((k) => [s.pos.x + s.fwdX * k, s.pos.z + s.fwdZ * k]); }
function collide(a, b) {
  if (!a || !b || a.sinking > 2 || b.sinking > 2 || a.spec.fixed || b.spec.fixed) return;
  const ra = a.spec.B * 0.55 + 0.4, rb = b.spec.B * 0.55 + 0.4;
  for (const ca of circles(a)) for (const cb of circles(b)) {
    const dx = cb[0] - ca[0], dz = cb[1] - ca[1], d = Math.hypot(dx, dz) || 0.01, ov = ra + rb - d;
    if (ov <= 0) continue;
    const nx = dx / d, nz = dz / d, rel = relSpeed(a, b);
    a.pos.x -= nx * ov * 0.5; a.pos.z -= nz * ov * 0.5; b.pos.x += nx * ov * 0.5; b.pos.z += nz * ov * 0.5;
    if (a.fire > 0 && b.fire === 0 && rng() < 0.02) { b.fire = 1; b.fireT = 11; } else if (b.fire > 0 && a.fire === 0 && rng() < 0.02) { a.fire = 1; a.fireT = 11; }
    if (a.ramCd <= 0 && rel > 5 && (G.state === 'battle' || G.state === 'boarding')) {
      a.ramCd = b.ramCd = 1.6;
      const dmg = rel * 1.3;
      a.hull -= dmg; b.hull -= dmg; a.speed *= 0.6; b.speed *= 0.6;
      fx.wood(new Vec3((ca[0] + cb[0]) / 2, 2, (ca[1] + cb[1]) / 2), 18);
      if (a.isPlayer || b.isPlayer) { sfx.thud(1); G.shake = 1; toastOnce('ram', 2, 'Collision!', 'bad'); }
    }
  }
}
const _shore = [], NONE = [];
function collideIslands(s) {
  if (s.spec.fixed) return;
  // shoal water: a ship that draws too much sticks until her people work her off
  if (s.aground <= 0 && s.offT <= 0 && s.sinking <= 0) {
    const bx = s.pos.x + s.fwdX * s.spec.L * 0.3, bz = s.pos.z + s.fwdZ * s.spec.L * 0.3;
    const sh = world.shoalAt(bx, bz, s.spec.D) || world.shoalAt(s.pos.x, s.pos.z, s.spec.D);
    if (sh) {
      s.aground = 7 + (s.spec.D - sh.depth) * 6 + s.speed * 0.6; s.hull -= 3 + s.speed; s.speed = 0; s.shoal = sh;
      sfx.thud(camVol(s.pos));
      if (s.isPlayer) { toast('Aground! The hands are working her off', 'bad', 3500); G.shake = 1; }
      else if (s.side !== G.player.side && G.state === 'battle') floater('Aground!', 'good rake', _v.set(s.pos.x, s.mastH * 0.8, s.pos.z).clone());
    }
  } else if (s.aground > 0 && s.aground < 0.1 && s.shoal) {
    // off again: her boats haul her clear of the bank, back the way she came
    const sh = s.shoal, clear = s.spec.L * 0.5 + 6;
    s.aground = 0; s.offT = 9; s.shoal = null;
    if (s.isPlayer) toast('She floats! Steer clear of the bank', 'good');
    let k = 4;
    while (k < 400 && sh.at(s.pos.x - s.fwdX * k, s.pos.z - s.fwdZ * k) > -clear) k += 4;
    if (k < 400) s.backOff = [s.pos.x - s.fwdX * k, s.pos.z - s.fwdZ * k];
    else { // she came in from far across it: take the shortest way off instead
      const d = sh.at(s.pos.x, s.pos.z), gx = sh.at(s.pos.x + 2, s.pos.z) - sh.at(s.pos.x - 2, s.pos.z), gz = sh.at(s.pos.x, s.pos.z + 2) - sh.at(s.pos.x, s.pos.z - 2), gl = Math.hypot(gx, gz) || 1;
      s.backOff = [s.pos.x - (gx / gl) * (d + clear), s.pos.z - (gz / gl) * (d + clear)];
    }
  }
  if (s.backOff) { // hauled off by her boats
    const dx = s.backOff[0] - s.pos.x, dz = s.backOff[1] - s.pos.z, d = Math.hypot(dx, dz);
    if (d < 3 || s.offT < 3) s.backOff = null; else { s.pos.x += (dx / d) * 0.25; s.pos.z += (dz / d) * 0.25; }
  }
  const land = world.pieces.length ? world.shoreNear(s.pos.x, s.pos.z, s.spec.L * 0.5 + s.spec.B, _shore) : NONE;
  for (const isl of land.length ? world.islands.concat(land) : world.islands) for (const c of circles(s)) {
    const dx = c[0] - isl.x, dz = c[1] - isl.z, d = Math.hypot(dx, dz) || 0.01, ov = isl.r + s.spec.B * 0.5 - d;
    if (ov <= 0) continue;
    s.pos.x += (dx / d) * ov; s.pos.z += (dz / d) * ov;
    if (s.ramCd <= 0 && s.speed > 3) {
      s.ramCd = 1.6; s.hull -= 6 + s.speed; sfx.thud(camVol(s.pos));
      if (s.isPlayer) { toast('Aground on the rocks!', 'bad'); G.shake = 1; }
    }
    s.speed *= 0.9;
  }
  const e = Math.hypot(s.pos.x, s.pos.z);
  if (e > 1000) { s.pos.multiplyScalar(1000 / e); if (s.isPlayer) toastOnce('edge', 6, 'Uncharted waters — come about!'); }
}
// fire aboard: it burns her timber and her canvas and kills the men on deck until her people put it out.
// (The flames, smoke, wake and the sea closing over her are the view's: shipFx in view.js.)
function shipEffects(s, dt) {
  if (s.fire > 0 && s.sinking <= 0) {
    s.hull -= 0.0042 * s.hullMax * s.fire * dt; // the more timber, the more there is to burn
    s.sails = Math.max(0, s.sails - 0.5 * s.fire * dt);
    if (s.exposed >= 1 && rng() < 0.13 * s.fire * dt) s.crew -= 1;
    s.fireT -= dt * (0.5 + 0.9 * s.crewR);
    if (s.fireT <= 0) { s.fire--; s.fireT = 11; if (s.fire === 0 && s.isPlayer) toast('Fires are out', 'good'); }
  }
}

// ---------- battle flow ----------
// A prize is worth more the less you've wrecked her: bounty for a wreck, double for an intact hull.
const prize = (e) => Math.round((e.spec.bounty * (1 + clamp(e.hullR, 0, 1))) / 10) * 10;
// A scenario is everything one fight needs: who is in it, what the sea and wind are doing, and
// what counts as winning. The skirmish ladder makes one with a single pirate; campaign legs make their own.
//   sc.check(dt)  -> an outcome string once the fight is decided
//   sc.onOut(ship, how), sc.onEnd(outcome), sc.objective (text or function), sc.events [{ t, fn }], sc.zones [{ x, z, r, name }]
function resetPlayerForBattle() {
  const p = G.player;
  p.reload = {}; for (const k of p.sides) p.reload[k] = 0;
  p.fire = 0; p.ammo = 'round'; p.sinking = 0; p.struck = false; p.out = null; p.boardView = null; p.input.turn = 0;
  p.anchored = false; p.aground = 0; p.offT = 0; p.weighT = 0; p.stamina = 1; p.oar = p.spec.oars ? 1 : 0; p.backOff = null; p.grapple = 0;
}
function beginScenario(sc) {
  G.inPort = false; V.leavePort();
  clearShips(); clearBalls(); V.zones([]);
  G.sc = sc; G.boardCd = 0; G.outcome = null; G.bd = null; G.battleT = 0;
  resetPlayerForBattle();
}
const drawZones = () => V.zones(G.sc.zones || []); // the rings on the water a leg's objectives are in
// Build a campaign leg from its definition (see missions.js) and show its card.
function startScenario(def, c) {
  G.mode = 'campaign';
  world.clearIslands();
  const S = { by: {}, flag: {}, t: 0, p: G.player,
    inZone: (n) => { const z = (sc.zones || []).find((q) => q.name === n); return !!z && Math.hypot(G.player.pos.x - z.x, G.player.pos.z - z.z) < z.r; },
    say: (t, cls = 'big') => toast(t, cls, Math.max(4500, t.length * 55)),
    wind: (dir, str) => world.setWind(dir, str),
    addZone: (z) => { sc.zones.push(z); drawZones(); },
    blow: (ship) => shipOut(ship, 'blown'),
    // things that happen during a fight: a ship arrives, a ship wakes up to you, a ship runs for it
    add: (d) => { const s = spawn(d); if (G.state === 'battle' && s.side !== G.player.side && !G.fast) floater('Sail ho!', 'rake', _v.set(s.pos.x, s.mastH, s.pos.z).clone()); return s; },
    wake: (id, msg) => { const s = S.by[id]; if (!s || !s.ai || !s.ai.idle) return; s.ai.idle = false; s.keepSail = false; if (s.anchored) s.weighT = 3; if (msg && !G.fast) toast(msg, 'bad', 3500); },
    escape: (s) => shipOut(s, 'escaped'),
    flee: (s, to) => { if (!s || s.out || !s.ai || s.ai.flee) return; s.ai.flee = true; s.ai.goTo = to; s.ai.hold = false; s.ai.idle = false; s.anchored = false; if (!G.fast) floater('Running!', 'good rake', _v.set(s.pos.x, s.mastH, s.pos.z).clone()); },
  };
  const spawn = (d) => {
    const o = d.o || {}, s = addShip(d.spec, d.side, d.x, d.z, wrap(d.h), { id: d.id, ...o });
    if (o.anchored) { s.anchored = true; s.speed = 0; s.keepSail = true; s.sailLevel = 0; }
    if (o.hold) s.ai.hold = true;
    if (o.idle) { s.ai.idle = true; s.anchored = true; s.speed = 0; s.keepSail = true; s.sailLevel = 0; } // lying at anchor on station
    if (o.goTo) { s.ai.goTo = o.goTo; s.keepSail = true; }
    s.v0 = s.speed; S.by[d.id] = s;
    return s;
  };
  const sc = { ...def, S, zones: [...(def.zones || [])], events: (def.events || []).map((e) => ({ t: e.t, fn: () => e.fn(S) })) };
  sc.check = () => { S.t = G.battleT; return def.check(S); };
  c.S = S;
  beginScenario(sc);
  world.setEnv(def.env || 'noon');
  if (def.seedIslands) world.setIslands(def.seedIslands[0], def.seedIslands[1]);
  for (const i of def.islands || []) world.addIsland(i);
  for (const c of def.coasts || []) world.addCoast(c);
  for (const m of def.moles || []) world.addMole(m);
  if (def.works && !G.fast) V.works(def); // the towns and forts ashore: scenery, so only the view builds them
  world.setShoals(def.shoals || [], c.has('pilot'), G.player.spec.D);
  world.currentAt = def.current ? (x, z) => def.current(x, z) : null;
  world.setWind(def.wind.dir, def.wind.str ?? 1, true); world.wind.steady = !!def.wind.steady; world.wind.timer = 40;
  const p = G.player, pl = def.player;
  p.pos.set(pl.x, 0, pl.z); p.heading = wrap(pl.h); p.speed = p.v0 = pl.speed ?? 6; p.sailLevel = TOP;
  for (const d of def.ships) spawn(d);
  // a blazing ship that fouls another passes the fire on; the blast of a powder ship hurts whatever is near
  sc.onOut = (s, how) => {
    if (how === 'blown') for (const o of G.ships) { const d = sep(s, o); if (o !== s && !o.out && d < 70) { o.hull -= (s.spec.fixed ? 60 : 110) * (1 - d / 70); if (o.isPlayer) toast('Caught in the blast!', 'bad'); } }
    if (def.onOut) def.onOut(s, how, S);
    if (c.onOut) c.onOut(s, how);
  };
  sc.onEnd = (o) => c.onEnd(o);
  aiApi.onCut = (s) => { S.flag.cut = true; if (s.side !== p.side) toast(`${s.name} cuts her cable!`, 'big', 3500); };
  setTarget(def.focus ? S.by[def.focus] : nearest(p, foesOf(p)));
  G.state = 'intro'; G.focus = 'enemy';
  V.legCard(c.card(def));
}
// the faces of pirate captains, on the skirmish Wanted card and on result banners
const faces = (ids, cls = '') => (ids && ids.length ? `<div class="faces ${cls}">${ids.map((id) => portrait(id)).join('')}</div>` : '');
function startIntro() {
  const es = ENEMIES[G.level];
  G.mode = 'skirmish';
  world.clearIslands();
  const sc = { check: () => (sc.foe.out ? sc.foe.out : null) };
  beginScenario(sc);
  world.setEnv(es.env);
  world.setIslands(4242 + G.level * 97 + ((rng() * 1000) | 0), es.islands);
  world.wind.dir = world.wind.target = rand(0, Math.PI * 2); world.wind.timer = 40; // the first shift comes as long after the start as in a campaign leg
  const p = G.player;
  p.pos.set(0, 0, 0); p.heading = wrap(world.wind.dir + Math.PI / 2); p.speed = 7; p.sailLevel = TOP;
  // the last pirate fights to the end; the others give up as wrecks
  const e = (sc.foe = addShip({ ...es, noStrike: G.level === ENEMIES.length - 1 }, 1, 0, 0, 0));
  let a = p.heading + rand(-0.7, 0.7), tries = 0;
  do { e.pos.set(Math.sin(a) * 500, 0, Math.cos(a) * 500); a += 0.4; } while (tries++ < 16 && world.islands.some((i) => Math.hypot(i.x - e.pos.x, i.z - e.pos.z) < i.r + 60));
  e.heading = Math.atan2(-e.pos.x, -e.pos.z) + 0.5;
  e.target = p; G.ai = e.ai; setTarget(e);
  G.state = 'intro'; G.focus = 'enemy';
  G.saved = { hull: p.hull, sails: p.sails, crew: p.crew, stock: { ...p.stock } };
  V.intro(es);
}
function beginBattle() {
  G.state = 'battle'; G.focus = 'player'; G.cam.yaw = 0; G.battleT = 0; G.fired = G.raked = G.canBoard = false; // canBoard is worked out each tick: don't let the last fight's stand until then
  for (const s of G.ships) { if (!s.anchored && !s.spec.fixed && !s.keepSail) s.sailLevel = TOP; if (G.mode === 'campaign' && s.v0 != null) s.speed = s.v0; }
  V.hideScreen(); V.mode('battle');
  retarget();
  BOARD_SPEED = 6.5 * G.player.spec.mods.boardSpeed;
  V.battle(); drawZones();
  G.coach = G.sc.coach ?? (G.mode === 'skirmish' && G.level === 0 && !store.get('broadside.coached')) ? { i: 0, t: 0 } : null;
  const tip = G.mode === 'skirmish' ? ENEMIES[G.level].tip : G.sc.tip;
  if (!G.coach && tip) V.later(1500, () => G.state === 'battle' && toast(tip, '', 6000));
  sfx.horn(true);
  G.rec.battleStart();
}
// A ship leaves the fight: sunk, struck as a wreck, taken by boarding, or (a battery) silenced.
function shipOut(s, how) {
  if (s.out) return;
  s.out = how; s.grapple = 0;
  const foe = s.side !== G.player.side, near = !G.fast;
  if (how === 'sunk') { s.sinking = Math.max(s.sinking, 0.01); if (foe) G.stats.sunk++; }
  else if (how === 'fled' || how === 'escaped') { s.struck = true; s.fire = 0; V.dropShip(s); G.ships = G.ships.filter((x) => x !== s); } // gone over the horizon
  else { s.struck = true; s.fire = 0; s.anchored = false; if (foe) { if (how === 'captured') G.stats.captured++; else G.stats.sunk++; } }
  if (how === 'blown') { fx.wood(_v.set(s.pos.x, s.spec.D + 2, s.pos.z).clone(), 40); for (let i = 0; i < 14; i++) fx.flame(s.pos.x + vrand(-6, 6), s.spec.D + vrand(0, 9), s.pos.z + vrand(-6, 6)); sfx.cannon(1); G.shake = 1.4; if (!s.spec.fixed) s.sinking = Math.max(s.sinking, 0.01); }
  if (near && s !== G.player) {
    const msg = { sunk: 'is going down!', struck: 'strikes — a floating wreck', captured: foe ? 'is yours!' : 'has been taken!', silenced: 'is silenced', blown: 'blows up!', fled: 'has run for it, out of the fight', escaped: 'has got away!' }[how];
    toast(`${s.name} ${msg}`, foe && how !== 'escaped' ? 'big' : 'bad', 4000); sfx.horn(foe && how !== 'escaped');
  }
  if (G.sc.onOut) G.sc.onOut(s, how);
}
function fates() {
  for (const s of G.ships) {
    if (s.out || s === G.player) continue;
    if (s.hull <= 0) shipOut(s, s.spec.fixed ? 'silenced' : 'sunk');
    else if (s.spec.fixed ? s.crew < s.crewMax * 0.2 : !s.spec.noStrike && s.hullR < 0.15) shipOut(s, s.spec.fixed ? 'silenced' : 'struck');
    // powder: a fire in a magazine ends things at once
    else if (s.spec.magazine && s.fire > 0 && rng() < s.spec.magazine * s.fire * G.dtNow) shipOut(s, 'blown');
  }
}
function endBattle(outcome) {
  if (G.state === 'ending') return;
  const p = G.player, bad = outcome === 'lost' || outcome === 'overrun' || outcome === 'failed';
  G.outcome = outcome; G.state = 'ending';
  G.rec.battleEnd(outcome);
  G.endT = outcome === 'sunk' ? 6.5 : bad ? 5 : 3.2;
  G.pending.length = 0; G.bd = null;
  V.mode('battle');
  if (bad) { if (outcome === 'lost') p.sinking = Math.max(p.sinking, 0.01); toast(outcome === 'lost' ? 'We are sinking!' : outcome === 'overrun' ? 'The deck is lost!' : G.sc.failText || 'The day is lost', 'bad', 4000); sfx.horn(false); }
  else G.focus = G.enemy && G.enemy.out ? 'enemy' : 'player';
}
function runAI(dt) {
  const p = G.player;
  for (const s of G.ships) {
    if (s === p || !s.ai || !s.active) continue;
    if (s.ai.hold) { // under false colours she takes you for a friend, until you show otherwise
      if (G.fired || sep(p, s) < s.spec.L * 1.1 || s.hull < s.hullMax) { s.ai.hold = false; if (!G.fast) toast(`${s.name} knows you now!`, 'bad'); } else { s.input.turn = 0; s.sailLevel = 1; continue; }
    }
    if (s.ai.idle) { s.input.turn = 0; if (s.spec.oars) s.oar = 0; continue; } // lying on station, not yet roused
    if (s.ai.goTo) {
      steerTo(s, s.ai.goTo[0], s.ai.goTo[1], world);
      if (s.spec.oars) s.oar = s.stamina > 0.3 ? 2 : 1;
      if (s.ai.flee && (Math.hypot(s.pos.x - s.ai.goTo[0], s.pos.z - s.ai.goTo[1]) < 60 || sep(p, s) > 650)) shipOut(s, 'fled');
      continue;
    }
    if ((s.ai.pick = (s.ai.pick || 0) - dt) <= 0 || !s.target || !s.target.active) { s.target = pickTarget(s); s.ai.pick = 2.5; }
    if (s.target) updateAI(s.ai, s, s.target, world, dt, aiApi);
    else { s.input.turn = 0; if (!s.spec.fixed) s.sailLevel = 1; }
  }
}
function battleUpdate(dt) {
  const p = G.player;
  G.battleT += dt; G.stats.time += dt; G.dtNow = dt;
  retarget();
  const e = G.enemy;
  if (G.bot) G.bot(p, e, dt); // test hook: a scripted helmsman
  else if (G.auto && e) updateAI(G.auto, p, e, world, dt, aiApi);
  else p.input.turn = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0);
  if (G.coach && G.coach.i < 2 && G.battleT < 60) for (const s of G.ships) if (s.ai) s.ai.fireDelay = 2; // first fight: she holds fire until you have fired
  runAI(dt);
  for (const ev of G.sc.events || []) if (!ev.done && G.battleT >= ev.t) { ev.done = true; ev.fn(); }
  G.boardCd -= dt;
  G.grappler = null;
  for (const s of G.ships) {
    if (s.side === p.side || !s.active || !s.ai || s.spec.fixed) continue;
    const range = Math.round(20 + (p.spec.B + s.spec.B) * 0.8);
    const can = sep(p, s) < range && relSpeed(p, s) < 6.5 && G.boardCd <= 0 && p.speed < BOARD_SLOW; // she can grapple you only if you are slow
    s.grapple = clamp(s.grapple + (can && s.ai.wantBoard && s.target === p ? dt / 2.4 : -dt * 0.7), 0, 1);
    if (s.grapple > 0.02 && s.ai.wantBoard && (!G.grappler || s.grapple > G.grappler.grapple)) G.grappler = s;
    if (s.grapple >= 1) return startBoarding('enemy', s);
  }
  G.aiGrapple = G.grappler ? G.grappler.grapple : 0;
  const alongside = e && e.side !== p.side && !e.sinking && e.out !== 'captured' && e.out !== 'blown' && sep(p, e) < BOARD_RANGE && relSpeed(p, e) < BOARD_SPEED && G.boardCd <= 0;
  G.canBoard = alongside && e.speed < BOARD_SLOW * p.spec.mods.boardSpeed && (e.active || G.sc.boardWrecks);
  if (p.sailLevel > 0 && p.speed < 2.5 && world.wind.str > 0.3 && !p.anchored && p.aground <= 0 && !p.oarSpeed(world) && Math.abs(wrap(p.heading - world.wind.dir)) > Math.PI - noGoHalf(p.spec) + 0.05) toastOnce('irons', 10, 'In irons — turn away from the wind’s eye!', 'bad', 3000);
  if (world.wind.str > 1.3 && p.sailLevel === TOP) toastOnce('gale', 12, 'Full sail in a gale is tearing the canvas — shorten sail!', 'bad', 3000);
  if (world.wind.next != null && !G.windCalled && G.mode === 'campaign' && CAMP.has('pilot') && Math.abs(world.wind.next) > 0.25) { G.windCalled = true; toast(`Pilot: “Wind’s about to shift, ${world.wind.next > 0 ? 'veering' : 'backing'}.”`, '', 3500); }
  if (world.wind.next == null) G.windCalled = false;
  worldNews(p);
  fates();
  if (p.hull <= 0) return endBattle('lost');
  const r = G.sc.check && G.sc.check(dt);
  if (r) return endBattle(r);
  if (!e) return;
  // whoever is upwind shoots through clear air; say so when it changes hands
  const gauge = !e.active ? 0 : hasGauge(p, e) ? 1 : hasGauge(e, p) ? -1 : 0;
  if (gauge !== G.gauge && G.battleT > 3 && world.wind.str > 0.3) {
    if (gauge) floater(gauge > 0 ? 'Upwind of her: steadier guns' : 'Downwind of her: smoke in your eyes', gauge > 0 ? 'good' : 'bad', _m.set(p.pos.x, 16, p.pos.z));
  }
  G.gauge = gauge;
  coachUpdate(dt);
  // the boarding ring explains itself the first time you get near it
  if (!G.coach && !store.get('broadside.ringed') && sep(p, e) < 150 && G.battleT > 8) {
    store.set('broadside.ringed', '1');
    V.coach('<span>The ring around her is boarding range. Grapples only hold a slow ship: cut up her sails with chain, then get inside the ring, match her speed and press <kbd>B</kbd>.</span><button data-act="hidecoach">ok</button>');
    G.coachHide = G.battleT + 9;
  }
  if (G.coachHide && G.battleT > G.coachHide) { G.coachHide = 0; V.coach(null); }
}

// ---------- boarding ----------
// The deck fight is short and decided mostly by what you did before the grapples flew: how many
// of her crew you killed, how many of yours are left, and what was loaded in the guns facing her.
// Both sides see the odds beforehand. During it you choose when to spend grapeshot in the swivel
// gun, and whether to cut loose before it is lost.
// A crew fights worse when its ship is in trouble: hands are at the pumps, or fighting a fire.
const readiness = (s) => (0.5 + 0.5 * s.hullR) * (s.fire > 0 ? 0.75 : 1);
const strength = (s) => s.crew * s.melee * readiness(s);
function pointBlank(from, to, side, name) {
  // a loaded battery facing the other ship goes off at the rail as the hulls touch
  if (!from.bat[side] || from.reload[side] > 0) return;
  const guns = from.muzzles[side].length, a = from.ammo;
  if (a !== 'round') { if (from.stock[a] <= 0) return; from.stock[a]--; }
  const dm = from.dmgOf(side);
  const kills = Math.max(0, Math.min(to.crew - 1, Math.round(guns * (a === 'grape' ? 2.6 : a === 'round' ? 0.9 : a === 'fire' ? 0.7 : 0.3) * dm * (from.spec.mods ? from.spec.mods.swivel : 1))));
  const hull = guns * (a === 'round' ? 4.5 : a === 'fire' ? 3.2 : 0.6) * dm;
  to.crew -= kills; to.hull = Math.max(1, to.hull - hull);
  from.startReload(side);
  for (const m of from.muzzles[side]) { const q = from.toWorld(m, _m); fx.cannon(q, Math.sin(from.normal(side)), Math.cos(from.normal(side))); }
  sfx.cannon(1); G.shake = 1;
  const q = to.toWorld(_l.set(0, to.spec.D + 8, 0), new Vec3());
  fx.grape(q);
  floater(`${name}  −${kills} crew` + (hull >= 5 ? `  −${Math.round(hull)} hull` : ''), to.isPlayer ? 'bad rake' : 'good rake', q);
  toast(from.isPlayer ? `Point-blank ${AMMO[a].long.toLowerCase()}: ${kills} of her crew cut down` : `Her guns at the rail: ${kills} of ours cut down`, from.isPlayer ? 'good' : 'bad', 3500);
}
function startBoarding(by, foe = G.enemy) {
  const p = G.player, e = foe;
  setTarget(e);
  G.state = 'boarding'; G.pending = G.pending.filter((q) => q.ship !== p && q.ship !== e); G.aiGrapple = 0;
  for (const s of G.ships) s.grapple = 0;
  const side = wrap(Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - p.heading) > 0 ? 1 : -1;
  const same = Math.abs(wrap(e.heading - p.heading)) < Math.PI / 2, eSide = same ? -side : side;
  pointBlank(p, e, side > 0 ? 'port' : 'stbd', 'Point-blank!');
  pointBlank(e, p, e.spec.fixed ? 'bow' : eSide > 0 ? 'port' : 'stbd', 'Her guns!');
  G.bd = { foe: e, side, off: p.spec.B / 2 + e.spec.B / 2 + 1.4, th: same ? 0 : Math.PI, by, t: 0, fxT: 0, cd: 1.5, eCd: 5, p0: p.crew, e0: e.crew, warned: false };
  p.boardView = { side, lanes: [0, 0, 0], won: [false, false, false], flip: false, reach: e.spec.B * 0.5 };
  e.boardView = { side: eSide, lanes: [0, 0, 0], won: [false, false, false], flip: !same, reach: p.spec.B * 0.5 };
  G.focus = 'both'; G.cam.yaw = 0;
  p.sailLevel = e.sailLevel = 0; // canvas in, so the decks are in plain view
  V.mode('melee');
  toast(e.spec.fuse ? 'They have lit the train — take her fast, or cut loose (X)!' : by === 'player' ? 'Boarders away!' : 'Repel boarders!', e.spec.fuse ? 'bad' : 'big', 4000);
  sfx.clang();
}
function syncBoardView(pWon, eWon) {
  const p = G.player, e = G.bd.foe;
  for (let i = 0; i < 3; i++) { p.boardView.lanes[i] = p.crew / 3; e.boardView.lanes[i] = e.crew / 3; p.boardView.won[i] = !!pWon; e.boardView.won[i] = !!eWon; }
}
function boardingUpdate(dt) {
  const b = G.bd, p = G.player, e = b.foe;
  G.dtNow = dt; G.battleT += dt;
  runAI(dt); fates(); // the rest of the fight does not stop for you
  if (!e.spec.fixed) {
    const tx = p.pos.x + Math.cos(p.heading) * b.side * b.off, tz = p.pos.z - Math.sin(p.heading) * b.side * b.off;
    const k = Math.min(1, dt * 1.5);
    e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k;
    e.heading = wrap(e.heading + wrap(p.heading + b.th - e.heading) * k);
  }
  b.t += dt; b.cd -= dt; b.eCd -= dt;
  syncBoardView();
  // a fireship's people light the train when they are boarded: take her quickly or get clear
  if (e.spec.fuse && !e.out && b.t > e.spec.fuse) {
    p.boardView = e.boardView = null; G.bd = null;
    G.state = 'battle'; G.focus = 'player'; G.boardCd = 4; V.mode('battle');
    shipOut(e, 'blown'); retarget(true);
    return;
  }
  if (b.t < 2.4) return; // a beat to take in the opening volley before blades meet
  // each side cuts the other down in proportion to its own strength, so the bigger crew pulls
  // ahead faster and faster; the pace climbs so no fight drags
  const rush = b.t < 6 ? (b.by === 'player' ? 1.15 : 1 / 1.15) : 1, pace = 0.028 + 0.0035 * b.t;
  const sp = strength(p) * rush, se = strength(e) / rush;
  p.crew = Math.max(0, p.crew - pace * se * dt); e.crew = Math.max(0, e.crew - pace * sp * dt);
  if (e.spec.ai && e.spec.ai.boarder && e.stock.grape > 0 && b.eCd <= 0) { e.stock.grape--; b.eCd = 7; swivel(p, e, 6); }
  if ((b.fxT -= dt) <= 0) {
    b.fxT = 0.1;
    const who = Math.random() < 0.5 ? p : e, q = who.toWorld(_l.set(b.side * (who === p ? 1 : -1) * vrand(0.1, 0.5) * who.spec.B, who.spec.D + 1.5, vrand(-0.35, 0.35) * who.spec.L), _m);
    if (Math.random() < 0.4) { fx.musket(q.x, q.y, q.z); sfx.musket(); } else if (Math.random() < 0.5) sfx.clang();
  }
  // a crew that has lost seven in ten of the men it brought to the rail gives up the deck
  if (e.crew <= Math.max(1, b.e0 * 0.3)) {
    syncBoardView(true, false);
    if (G.mode === 'skirmish') G.prize = prize(e);
    shipOut(e, e.spec.fixed ? 'silenced' : 'captured');
    const r = G.sc.check && G.sc.check(dt);
    if (r) return endBattle(r);
    // the fight is not over: back to your own deck and on
    p.boardView = e.boardView = null; G.bd = null;
    G.state = 'battle'; G.focus = 'player'; G.boardCd = 4; p.speed = 3; p.sailLevel = 2;
    V.mode('battle'); retarget(true);
    return;
  }
  if (p.crew <= Math.max(1, b.p0 * 0.3)) { syncBoardView(false, true); return endBattle('overrun'); }
  if (!b.warned && p.crew < b.p0 * 0.55 && sp < se) { b.warned = true; toast('We are losing the deck — cut the grapples!', 'bad', 3000); }
}
function swivel(target, by, n) {
  const kill = Math.min(target.crew - 1, n + rng() * 3);
  target.crew -= kill;
  const q = target.toWorld(_l.set(0, target.spec.D + 2, 0), new Vec3());
  fx.grape(q); fx.cannon(by.toWorld(_l.set(0, by.spec.D + 2, 0), _m), 0, 0); sfx.cannon(0.7);
  q.y += 6;
  floater(`−${Math.round(kill)} crew`, target.isPlayer ? 'bad' : 'good', q);
  G.shake = 0.5;
}
function boardSwivel() {
  const b = G.bd, p = G.player;
  if (!b || G.state !== 'boarding' || b.cd > 0) return;
  if (p.stock.grape <= 0) return toast('No grapeshot for the swivel gun', 'bad', 1200);
  p.stock.grape--; b.cd = 5;
  swivel(b.foe, p, 8 * p.spec.mods.swivel);
}
function cutGrapples() {
  const b = G.bd, p = G.player;
  if (!b || G.state !== 'boarding') return;
  const e = b.foe;
  p.crew = Math.max(3, p.crew * 0.9);
  p.boardView = e.boardView = null; G.bd = null;
  G.state = 'battle'; G.focus = 'player'; G.boardCd = 9; p.speed = 5; e.speed = 1; p.sailLevel = TOP; e.sailLevel = 2;
  p.reload.port = Math.max(p.reload.port, 2); p.reload.stbd = Math.max(p.reload.stbd, 2);
  V.mode('battle');
  toast('Grapples cut — make sail!', '');
}
function tryBoard() {
  const p = G.player, e = G.enemy;
  if (G.state !== 'battle' || !e) return;
  if (G.canBoard) return startBoarding('player');
  if (e.side === p.side) return;
  const d = sep(p, e);
  if (G.boardCd > 0 && d < BOARD_RANGE) toast('The crew needs a moment before another attempt', '', 1400);
  else if (d >= BOARD_RANGE) toast(`Too far to board: ${Math.round(d)} yds, need under ${BOARD_RANGE - 3}`, '', 1600);
  else if (e.speed >= BOARD_SLOW * p.spec.mods.boardSpeed) toast('She is moving too fast for grapples to hold — cut up her sails first', '', 2200);
  else toast('Match her speed first — you are passing too fast', '', 1600);
}

// ---------- first-fight coaching: one line at a time, each cleared by doing it ----------
const COACH = [
  { text: '<kbd>A</kbd> <kbd>D</kbd> steer. Bring her inside one of the pale arcs off your sides.', done: (p, e) => e && p.sides.some((s) => inArc(p, s, e, 1.05)) },
  { text: '<kbd>Space</kbd> fires the side she is on.', done: () => G.fired },
  { text: '<kbd>W</kbd> <kbd>S</kbd> more or less sail. The red wedge on the water is where the wind will not take you.', done: (p) => p.sailLevel !== TOP, max: 16 },
  { text: '<kbd>1</kbd>–<kbd>4</kbd> change shot: round for the hull, chain for sails, grape for crew, heated for fire.', done: (p) => p.ammo !== 'round', max: 14 },
];
function endCoach() { G.coach = null; store.set('broadside.coached', '1'); V.coach(null); }
function coachUpdate(dt) {
  const c = G.coach;
  if (!c) return;
  const step = COACH[c.i];
  if (!step) return endCoach();
  if (c.t === 0) V.coach(`<span>${step.text}</span><i>${c.i + 1}/${COACH.length}</i><button data-act="skipcoach">skip</button>`);
  c.t += dt;
  if ((c.t > 2 && step.done && step.done(G.player, G.enemy)) || (step.max && c.t > step.max)) { c.i++; c.t = 0; sfx.ui(); }
}

// ---------- the player's orders ----------
function selectAmmo(k) {
  const p = G.player;
  if (G.state !== 'battle' || k === p.ammo) return;
  if (k !== 'round' && p.stock[k] <= 0) return toast(`No ${AMMO[k].long.toLowerCase()} left`, 'bad', 1500);
  p.setAmmo(k); sfx.ui();
  V.ammoTip(k);
}

// ---------- screens ----------
// The game decides what happens; the view shows the screen for it (title, cards, results, the port).
function showTitle() {
  G.state = 'title'; V.mode(null);
  if (G.inPort && G.harbour !== 'island') { useHarbour('island'); sea.setEnv('harbor'); } // the title is always Lychna
  V.title(CAMP.saved());
}
const acc = () => (G.stats.shots ? Math.round((G.stats.hits / G.stats.shots) * 100) : 0);
function showResult() {
  const p = G.player, o = G.outcome;
  V.mode(null);
  for (const s of G.ships) s.boardView = null;
  if (G.sc.onEnd) return G.sc.onEnd(o);
  const e = G.sc.foe, es = e.spec;
  if (o === 'lost' || o === 'overrun') {
    G.state = 'over';
    return V.result({ o, es, lost: true });
  }
  G.state = 'result';
  const cap = o === 'captured', gold = cap ? G.prize : es.bounty;
  G.gold += gold; G.earned += gold;
  let men = 0;
  if (cap) {
    men = Math.max(0, Math.min(15, p.crewMax - Math.round(p.crew)));
    p.crew += men; p.stock.chain += 3; p.stock.grape += 3; p.stock.fire += 2;
    G.trophies.push(G.level);
  }
  p.fire = 0; p.hull = Math.max(p.hull, p.hullMax * 0.35); p.sails = Math.max(p.sails, p.sailsMax * 0.5);
  sfx.coin();
  V.result({ o, es, cap, gold, men, last: G.level + 1 >= ENEMIES.length });
}
function showFinal() {
  G.state = 'won'; sfx.horn(true);
  enterHarbor(); V.snapCamera();
  V.final(acc());
}

// the home port you are in: the view shows its harbour
G.harbour = 'island'; G.inPort = true;
function useHarbour(place) { G.harbour = place; G.inPort = true; V.harbour(place); return place; }
// ---------- Port Halcyon ----------
// While you choose a side at the end of the prologue, a ship from each navy rides at anchor off the quay: a Venetian
// brig with the lion on her sails and an Ottoman xebec with the crescent, two silhouettes nobody can confuse.
function showEnvoys(arriving) {
  clearEnvoys();
  for (const t of G.trophyShips) V.showShip(t, false);
  // anchored off the quay either side of your berth, broadside on to the view, Venice to the left and the Porte to the right.
  // With `arriving`, both sail in together from either side of the bay and drop anchor (the opening shot of "Two offers").
  const b = BERTH;
  G.envoys = [['venice', 'brig', NAMES.venice.brig, -1], ['ottoman', 'xebec', NAMES.ottoman.lent.xebec, 1]].map(([side, hull, name, k]) => {
    const t = new Ship(shipSpec(hull, side, name), false);
    t.crew = 30; t.sailLevel = arriving ? TOP : 0; t.heading = -k * Math.PI / 2;
    t.arrive = { from: [b.x + k * 125, b.z - 26], to: [b.x + k * 46, b.z + 18], t: arriving ? 0 : 5, dur: 5, on: !!arriving };
    sailIn(t, 0);
    V.addShip(t);
    return t;
  });
}
function anchorEnvoys() { for (const t of G.envoys || []) { t.arrive.t = t.arrive.dur; sailIn(t, 0); } }
// the opening shot: letterbox bars and a card over the two ships coming in. A click or a key, or both ships at anchor, goes on.
function offersCard(c) {
  G.envoyCut = { t: 0 };
  V.offersCard(c); // like a fight's card: the ships sail in behind it and the player moves on with the button when ready
}
function endOffersCard() { G.envoyCut = null; V.offersCard(null); anchorEnvoys(); }
function sailIn(t, dt) {
  const a = t.arrive;
  if (a.on) a.t = Math.min(a.dur, a.t + dt);
  const u = a.t / a.dur, e = 1 - (1 - u) ** 2.2; // she comes in fast and carries her way up to the anchorage
  const x = a.from[0] + (a.to[0] - a.from[0]) * e, z = a.from[1] + (a.to[1] - a.from[1]) * Math.sin((e * Math.PI) / 2);
  if (u < 1) { const dx = x - t.pos.x, dz = z - t.pos.z; if (dx * dx + dz * dz > 1e-4) t.heading = Math.atan2(dx, dz); }
  t.pos.set(x, 0, z);
  if (u >= 1 && a.on) { a.on = false; t.sailLevel = 0; t.heading = Math.sign(a.from[0] - a.to[0]) * -Math.PI / 2; }
  else if (u >= 1) { t.sailLevel = 0; t.heading = Math.sign(a.from[0] - a.to[0]) * -Math.PI / 2; }
}
// your brig alone between them: any other ship of yours is out of the picture until you have chosen (enterHarbor brings it back)
function clearEnvoys() { for (const t of G.envoys || []) V.dropShip(t); G.envoys = []; }
function enterHarbor() {
  const place = useHarbour(G.mode === 'campaign' && CAMP.st ? CAMP.livery() : 'island'); clearEnvoys();
  world.setEnv(place === 'island' ? 'harbor' : 'home'); world.clearIslands(); world.wind.dir = world.wind.target = 2.2;
  clearBalls();
  clearShips(); V.zones([]);
  moor();
  // every ship you own but are not sailing rides at anchor in the bay
  for (const t of G.trophyShips) V.dropShip(t);
  G.trophyShips = (G.mode === 'campaign' ? CAMP.stableIds() : ['wren', ...G.trophies]).filter((id) => id !== G.ship).sort((a, b) => hullSpec(a).L - hullSpec(b).L).map((id, i) => {
    const t = new Ship(hullSpec(id), false), m = MOORINGS[i % MOORINGS.length];
    t.id = id; t.crew = 14; t.sailLevel = 0;
    t.pos.set(m[0], 0, m[1]); t.heading = m[2];
    V.addShip(t);
    return t;
  });
}
const ROLE = { wren: 'Your old brig. Does everything fairly well.', 0: 'Darts and turns on a coin, and sails closer to the wind than anything afloat. Light guns with a wide sweep; a thin hull.', 1: 'A sound, balanced brig.', 2: 'Room for a huge crew: made for boarding. Light quick-firing guns, thin hull, points well to windward.', 3: 'Heavy guns that outreach everything smaller, slow to load. Ponderous at the helm, and short of hands.', 4: 'A fortress.' };
const roleOf = (id) => (camId(id) ? HULLS[CAMP.entry(id).hull].role : ROLE[id]);
function takeCommand(id) {
  G.ship = sid(id);
  buildPlayer(true); moor(); enterHarbor(); G.shop = null;
  V.port(); sfx.horn(true);
  if (G.mode === 'campaign') { CAMP.st.ship = G.ship; CAMP.man(); V.renderPort(); CAMP.save(); }
  toast(`You take command of the ${G.player.spec.name}`, 'big', 3000);
}
function showPort() {
  G.state = 'port'; G.focus = 'player'; G.shop = null; G.cam.yaw = 0;
  enterHarbor(); V.hideScreen(); V.mode('port');
  if (G.mode === 'campaign') { const p = G.player; p.hull = p.hullMax; p.sails = p.sailsMax; p.crew = CAMP.crewFor(p.spec); p.fire = 0; }
  V.port();
}
const COST = (k) => REPAIR[k][1];
function portAction(a) {
  const p = G.player, [kind, k, n, c] = a.split(':');
  if (kind === 'rep') {
    const max = p[k + 'Max'], amt = Math.min(max - p[k], G.gold / COST(k)), cost = Math.min(G.gold, Math.ceil(amt * COST(k)));
    p[k] = Math.min(max, p[k] + (k === 'crew' ? Math.floor(amt) : amt)); G.gold -= cost;
    if (max - p[k] < 0.5) p[k] = max;
  } else if (kind === 'ammo') { if (G.gold < +c) return; G.gold -= +c; p.stock[k] += +n; }
  else if (kind === 'up') { const f = fitOf(G.ship), cost = kitCost(f[k] || 0); if ((f[k] || 0) >= 2 || G.gold < cost) return; G.gold -= cost; f[k] = (f[k] || 0) + 1; buildPlayer(); moor(); V.names(); if (G.mode === 'campaign') G.player.crew = CAMP.crewFor(G.player.spec); }
  sfx.coin(); V.renderPort();
  if (G.mode === 'campaign') CAMP.save();
}
function restart(full) {
  G.paused = false;
  const p = G.player;
  if (full) {
    G.mode = 'skirmish';
    G.level = 0; G.gold = 0; G.earned = 0; G.fit = {}; G.stats = freshStats(); G.trophies = []; G.ship = 'wren';
    for (const t of G.trophyShips) V.dropShip(t);
    G.trophyShips = [];
    V.dropShip(p); G.player = null; buildPlayer();
  } else { const s = G.saved; p.hull = s.hull; p.sails = s.sails; p.crew = s.crew; p.stock = { ...s.stock }; }
  startIntro();
}
function act(a) {
  sfx.init(); sfx.ui();
  if (a.startsWith('camp:')) return CAMP.act(a.slice(5));
  if (G.mode === 'campaign' && (a === 'sail' || a === 'restart' || a === 'retry')) return CAMP.act(a === 'sail' ? 'brief' : 'abandon');
  if (a === 'skirmish') { G.mode = 'skirmish'; restart(true); }
  else if (a === 'sail') startIntro();
  else if (a === 'engage') beginBattle();
  else if (a === 'port') { G.level++; showPort(); snapCamera(); }
  else if (a === 'final') showFinal();
  else if (a === 'restart') restart(true);
  else if (a === 'retry') restart(false);
  else if (a === 'resume') togglePause();
  else if (a === 'closeshop') { G.shop = null; V.renderPort(); }
  else if (a === 'skipcoach') endCoach();
  else if (a === 'hidecoach') { G.coachHide = 0; V.coach(null); }
  else if (a.startsWith('cmd:')) takeCommand(a.slice(4));
  else if (a.includes(':') && !a.startsWith('cmd:')) portAction(a);
}
function rowKey() {
  const p = G.player;
  if (!p.spec.oars) return;
  p.oar = (p.oar + 1) % 3; sfx.creak();
  floater(['Ship oars — the oarsmen rest', 'Give way together', 'Row for your lives!'][p.oar], '', _m.set(p.pos.x, p.mastH + 6, p.pos.z).clone());
}
function anchorKey() {
  const p = G.player;
  if (p.aground > 0) return;
  if (p.anchored) { if (p.weighT <= 0) { p.weighT = 4; toast('Weighing anchor…', '', 2500); } return; }
  if (p.speed > 6) return toast('Too much way on her to anchor — shorten sail first', '', 1800);
  p.anchored = true; p.weighT = 0; sfx.creak();
  toast('Anchored. She holds her ground and her guns are steadier, and a spring on the cable lets A / D haul her broadside round, wind or no wind. G again to weigh.', '', 6000);
}
// tell the player when the world changes under them: a wind shift, a galley's oarsmen giving out, wind on the water in a calm
const POINTS = (r) => Math.max(1, Math.round(Math.abs(r) / (Math.PI / 16)));
function worldNews(p) {
  const w = world.wind;
  if (w.shifted != null) {
    const amt = w.shifted; w.shifted = null;
    const pos = pointOfSail(wrap(p.heading - w.target), p.spec.point);
    toast(`The wind ${amt > 0 ? 'veers' : 'backs'} ${POINTS(amt)} points. On this heading you will be ${pos === 'In irons' ? 'in irons' : pos.toLowerCase()}`, '', 4500);
  }
  for (const s of G.ships) {
    if (!s.spec.oars || s.out) continue;
    if (s.spent && !s.wasSpent && s !== p && s.side !== p.side && G.state === 'battle') floater('Oarsmen spent!', 'good rake', _v.set(s.pos.x, s.mastH * 0.8, s.pos.z).clone());
    if (s.spent && !s.wasSpent && s === p) toast('Your oarsmen are spent: she lies still until they have their breath', 'bad', 3500);
    s.wasSpent = s.spent;
  }
  if (world.paws.length && w.base < 0.3) toastOnce('paws', 9999, 'Dark ripples on the water are cat’s-paws: there is wind inside them', '', 5000);
  if (world.currentAt && G.state === 'battle') {
    const c = world.currentAt(p.pos.x, p.pos.z), v = Math.hypot(c[0], c[1]);
    if (v > 1.5) toastOnce('current', 9999, `The current sets ${(v * 0.9).toFixed(1)} knots ${c[1] < 0 ? 'south, down the strait' : 'north'}: the white lines on the water show where it runs`, '', 5000);
  }
}
function togglePause() {
  if (G.state !== 'battle' && G.state !== 'boarding' && !G.paused) return;
  G.paused = !G.paused;
  V.pause(G.paused);
}

// ---------- input ----------
// keys held down (the view fills this in) and keys pressed: the player's helm and orders. The view handles its own
// keys (camera, sound, help) before passing the rest here.
const keys = {};
function tap(k) {
  const p = G.player;
  G.rec.input(k); // the fight recorder (playtest builds)
  if (k === 'p' || k === 'escape') return togglePause();
  if (G.paused) return;
  if ((k === ' ' || k === 'enter') && G.state === 'intro') return act('engage');
  if (G.state === 'boarding') {
    if (k === 'f' || k === ' ') boardSwivel();
    else if (k === 'x') cutGrapples();
    return;
  }
  if (G.state !== 'battle') return;
  if (k === 'w' || k === 'arrowup' || k === 's' || k === 'arrowdown') {
    const lv = clamp(p.sailLevel + (k === 'w' || k === 'arrowup' ? 1 : -1), 0, TOP);
    if (lv !== p.sailLevel) { p.sailLevel = lv; sfx.creak(); floater(SAILS[lv].name + (lv === TOP ? ' — fast, unsteady guns' : lv === 0 ? '' : ' — steadier guns'), '', _m.set(p.pos.x, p.mastH + 6, p.pos.z).clone()); }
  }
  else if (k === 'q') fire(p, 'port');
  else if (k === 'e') fire(p, 'stbd');
  else if (k === 'f') fire(p, 'bow');
  else if (k === 'b') tryBoard();
  else if (k === 't' || k === 'tab') cycleTarget();
  else if (k === 'r') rowKey();
  else if (k === 'g') anchorKey();
  else if (k === ' ') {
    const fs = foesOf(p), sides = p.sides.filter((s) => fs.some((o) => inArc(p, s, o, 1.12)));
    if (!sides.length) toastOnce('noarc', 1.5, 'She is not in either arc — bring her onto your beam', '', 1500);
    else if (!sides.some((s) => fire(p, s))) toastOnce('reload', 1.2, 'Still reloading', '', 900);
  } else if ('1234'.includes(k) && k.length === 1) selectAmmo(AMMO_KEYS[+k - 1]);
}
// ---------- main loop ----------
const hush0 = (now) => now === 'intro' && G.mode === 'campaign';
function update(dt) {
  dt = G.rec.frame(dt); // the fight recorder (playtest builds)
  G.t += dt;
  const st = G.state;
  if (st === 'battle') battleUpdate(dt);
  else if (st === 'boarding') boardingUpdate(dt);
  else if (st === 'ending') { if ((G.endT -= dt) <= 0) showResult(); }
  const p = G.player, e = G.enemy, now = G.state;
  const home = now === 'title' || now === 'port' || now === 'won' || now === 'story';
  if (now === 'intro' && !hush0(now)) { p.input.turn = 0.12; p.sailLevel = 2; if (e && G.mode === 'skirmish') { e.input.turn = -0.15; e.sailLevel = 2; } }
  if (now === 'ending' || now === 'result' || now === 'over') {
    for (const s of G.ships) s.input.turn = 0;
    if (G.outcome === 'captured' || G.outcome === 'overrun' || G.outcome === 'struck') { if (e) e.sailLevel = 0; p.sailLevel = 0; }
  }
  const bf = now === 'boarding' && G.bd ? G.bd.foe : null;
  const hush = now === 'intro' && G.mode === 'campaign'; // a leg's card: nothing moves until you engage
  p.update(dt, world, bf || home || hush);
  if (home) { for (const t of G.envoys || []) sailIn(t, dt); for (const t of [...G.trophyShips, ...(G.envoys || [])]) t.update(dt, world, true); }
  else {
    const ss = G.ships, live = now === 'battle' || now === 'ending' || now === 'boarding';
    for (const s of ss) {
      if (s === p) continue;
      s.update(dt, world, s === bf || hush);
      collideIslands(s); shipEffects(s, dt); flushTally(s, dt);
    }
    if (live) for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) if (!(bf && (ss[i] === p || ss[i] === bf) && (ss[j] === p || ss[j] === bf))) collide(ss[i], ss[j]);
    collideIslands(p); shipEffects(p, dt);
  }
  flushTally(p, dt);
  updateBalls(dt);
  sea.update(dt);
}
G.newAI = newAI;
G.tick = (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); };
G.world = world;
G.api = { faces, showEnvoys, offersCard, endOffersCard, aiApi, nearest, startScenario, showLegCard: (h) => V.legCard(h), showTitle: () => showTitle(), clearShips, world, strengthOf: (x) => strength(x), restartSkirmish: () => restart(true), addShip, beginScenario, beginBattle, shipOut, setTarget, foesOf, sep, relSpeed, hideScreen: () => V.hideScreen(), showScreen: (h, c) => V.screen(h, c), setMode: (m) => V.mode(m), enterHarbor, snapCamera: () => V.snapCamera(), buildPlayer, moor, playerSpec, renderPort: () => V.renderPort(), get sfx() { return sfx; }, get fx() { return fx; }, floater, get store() { return store; }, cutGrapples, hullSpec, updateAI, reach, inArc, hasGauge, strength: (s) => strength(s), rebuild: () => { V.dropShip(G.player); G.player = null; buildPlayer(true); }, fire, act, tap, keys, startBoarding, boardSwivel, endBattle, toast, showPort: () => showPort(), prize,
  dropShip: (s) => V.dropShip(s), selectAmmo, tryBoard, cycleTarget, kitOf, fitOf, roleOf, sid, update, readiness, boardState: () => ({ BOARD_RANGE, BOARD_SPEED, BOARD_SLOW }) };

// Set the game going with a view (view.js in the browser) or none (a headless run). Call once.
export function start(view = NO_VIEW) {
  V = view; fx = V.fx; sfx = V.sfx; store = V.store;
  buildPlayer();
  world.setEnv('harbor'); world.wind.dir = world.wind.target = 2.2;
  moor();
  CAMP.init(G, G.api); G.CAMP = CAMP;
  V.attach(G);
  showTitle();
  return G;
}
