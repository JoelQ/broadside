import * as THREE from 'three';
import { World } from './world.js';
import { FX, Sfx } from './fx.js';
import { Ship, AMMO, AMMO_KEYS, CAL, SAILS, TOP, noGoHalf, wrap, clamp, polar, pointOfSail } from './ship.js';
import { PLAYER_SPEC, ENEMIES, KITS, KIT_OF, kitCost, SHOPS, REPAIR } from './data.js';
import { updateAI, newAI } from './ai.js';
import { buildHarbor } from './harbor.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ~unit std
const GRAV = 22;
let BOARD_SPEED = 6.5;
const BOARD_SLOW = 7; // grapples only hold a ship making less than this (about 6 knots): slow her first
let BOARD_RANGE = 33; // set per fight from the two ships' beams

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 14000);
const world = new World(scene);
const fx = new FX(scene);
const sfx = new Sfx();
const harbor = buildHarbor();
scene.add(harbor.group);
let VW = 1, VH = 1;
function resize() {
  VW = window.innerWidth; VH = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  fx.setScale(renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
window.addEventListener('resize', resize);
resize();
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
};

// ---------- game state ----------
const freshStats = () => ({ volleys: 0, shots: 0, hits: 0, sunk: 0, captured: 0, time: 0 });
const G = {
  state: 'title', level: 0, gold: 0, earned: 0, fit: {}, // fit[ship][fitting] = level
  player: null, enemy: null, ai: newAI(), balls: [], pending: [], paused: false, trophies: [], trophyShips: [],
  aiGrapple: 0, boardCd: 0, endT: 0, outcome: null, bd: null, t: 0, shake: 0, focus: 'player', volley: 0, shop: null,
  stats: freshStats(), coach: null, ship: 'wren',
  cam: { yaw: 0, pitch: 0.4, dist: 78, mode: 'helm', angle: 0.4, look: new THREE.Vector3(0, 7, -20), pos: new THREE.Vector3(40, 30, 90) },
};
window.G = G;

// Any ship you have boarded and taken is yours to command. In your hands she keeps her hull
// and her handling, under your colours and with your gunners.
function hullSpec(id) {
  if (id === 'wren') return PLAYER_SPEC;
  const es = ENEMIES[id];
  return { ...es, sailCol: PLAYER_SPEC.sailCol, emblem: 'cross', emblemCol: PLAYER_SPEC.emblemCol, flagCol: PLAYER_SPEC.flagCol, crewCols: PLAYER_SPEC.crewCols, disp: PLAYER_SPEC.disp, dmg: 1, melee: 1, reload: es.reload - 1, ai: PLAYER_SPEC.ai, stock: {} };
}
const fitOf = (id) => G.fit[id] || (G.fit[id] = {});
function playerSpec() {
  const b = hullSpec(G.ship), lv = fitOf(G.ship);
  const mods = { speed: 1, turn: 1, arc: 1, reload: 1, melee: 1, evade: 1, boardReach: 1, boardSpeed: 1, swivel: 1, reach: 1, guns: 0, hull: 0, crew: 0, sweeps: 0 };
  for (const it of KITS[KIT_OF[G.ship]].items) {
    const n = lv[it.id] || 0;
    for (const k in it.mul || {}) mods[k] *= it.mul[k] ** n;
    for (const k in it.add || {}) mods[k] += it.add[k] * n;
  }
  return { ...b, mods, guns: b.guns + mods.guns, hull: b.hull + mods.hull, crew: b.crew + mods.crew, speed: b.speed * mods.speed, turn: b.turn * mods.turn, arc: b.arc * mods.arc, reach: mods.reach, sweeps: mods.sweeps };
}
function buildPlayer(fresh) {
  const old = G.player, p = new Ship(playerSpec(), true);
  p.reloadMult = p.spec.mods.reload; p.melee = p.spec.mods.melee; p.evade = p.spec.mods.evade;
  if (old) {
    if (!fresh) { p.hull = old.hull + p.hullMax - old.hullMax; p.sails = old.sails + p.sailsMax - old.sailsMax; p.crew = old.crew + p.crewMax - old.crewMax; }
    p.stock = old.stock; p.pos.copy(old.pos); p.heading = old.heading; p.speed = old.speed; p.sailLevel = old.sailLevel; p.input = old.input;
    scene.remove(old.group);
  }
  scene.add(p.group);
  G.player = p;
}
function moor() {
  const p = G.player, b = harbor.berth;
  p.pos.set(4.4 + p.spec.B / 2, 0, b.z); p.heading = b.heading; p.speed = 0; p.sailLevel = 0; p.input.turn = 0; p.rudder = 0;
  p.sinking = 0; p.struck = false; p.fire = 0; p.boardView = null;
}
buildPlayer();
world.setEnv('harbor'); world.wind.dir = world.wind.target = 2.2;
moor();

// ---------- broadside arcs drawn on the water (yours and hers) ----------
const arcGeo = (half) => { const g = new THREE.RingGeometry(0.07, 1, 28, 1, -half, half * 2); g.rotateX(-Math.PI / 2); return g; };
function fitArcs(a, ship) { for (const k in a.sides) { a.sides[k].geometry.dispose(); a.sides[k].geometry = arcGeo(ship.arc); } }
function makeArcs(color) {
  const grp = new THREE.Group(), sides = {};
  for (const side of ['port', 'stbd']) {
    const m = new THREE.Mesh(arcGeo(0.5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
    if (side === 'stbd') m.rotation.y = Math.PI;
    m.renderOrder = 2;
    sides[side] = m; grp.add(m);
  }
  grp.visible = false;
  scene.add(grp);
  return { grp, sides };
}
const myArcs = makeArcs(0xffffff), herArcs = makeArcs(0xff4a3a);
const decal = (geo, color, opacity) => {
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 3;
  return m;
};
// Around your ship: a red wedge where the wind will not let you sail, and an arrow showing which way it blows.
const windRing = new THREE.Group();
const noGoGeo = (half) => { const g = new THREE.RingGeometry(21, 33, 24, 1, -half, half * 2); g.rotateX(-Math.PI / 2); return g; };
const noGo = decal(new THREE.RingGeometry(21, 33, 24, 1, -0.6, 1.2), 0xff4a3a, 0.34);
const arrowShape = new THREE.Shape([[9, 0], [-1, 6.5], [-1, 2.4], [-11, 2.4], [-11, -2.4], [-1, -2.4], [-1, -6.5]].map(([x, y]) => new THREE.Vector2(x, y)));
const windArrow = decal(new THREE.ShapeGeometry(arrowShape), 0xbfe6ff, 0.75);
const arrowHold = new THREE.Group(); arrowHold.add(windArrow); windArrow.position.x = 46;
windRing.add(noGo, arrowHold);
windRing.visible = false; scene.add(windRing);
// Around her: the ring you must be inside to board. White far off, amber when inside but passing too fast, green when ready.
const boardRing = decal(new THREE.RingGeometry(BOARD_RANGE - 1.6, BOARD_RANGE, 72), 0xffffff, 0.3);
boardRing.visible = false; scene.add(boardRing);

// ---------- toasts and floating numbers ----------
function toast(text, cls = '', ms = 2600) {
  if (G.fast) return;
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, ms);
}
const said = {};
function toastOnce(key, gap, ...a) { if ((said[key] || -99) + gap > G.t) return; said[key] = G.t; toast(...a); }
const camVol = (p) => clamp(1 - camera.position.distanceTo(p) / 800, 0, 1) ** 2;
const _v = new THREE.Vector3(), _m = new THREE.Vector3(), _l = new THREE.Vector3();
function project(p) {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * VW, y: (-_v.y * 0.5 + 0.5) * VH, behind: _v.z > 1 };
}
const floaters = [];
function floater(text, cls, pos) {
  if (G.fast) return;
  const el = document.createElement('div');
  el.className = 'fl ' + cls; el.textContent = text;
  $('floaters').appendChild(el);
  floaters.push({ el, pos: pos.clone(), t: 0 });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt;
    if (f.t > 1.9) { f.el.remove(); floaters.splice(i, 1); continue; }
    const s = project(f.pos);
    f.el.style.transform = `translate(-50%,-50%) translate(${s.x}px,${s.y - f.t * 34}px)`;
    f.el.style.opacity = s.behind ? 0 : Math.min(1, (1.9 - f.t) * 1.6);
  }
}
// Damage is summed per volley and shown once, so you can read what a broadside did.
function tally(ship, hull, sail, crew, rake, pos) {
  const a = ship.acc || (ship.acc = { hull: 0, sail: 0, crew: 0, rake: false, t: 0, pos: new THREE.Vector3() });
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
  a.pos.y = ship.group.position.y + ship.model.mastH * 0.6;
  floater((a.rake ? 'RAKE!  ' : '') + parts.join('  '), (ship.isPlayer ? 'bad' : 'good') + (a.rake ? ' rake' : ''), a.pos);
}

// ---------- gunnery ----------
const ballGeo = new THREE.SphereGeometry(0.42, 8, 6);
const ironMat = new THREE.MeshLambertMaterial({ color: 0x18181a });
const hotMat = new THREE.MeshBasicMaterial({ color: 0xff7a22 });
const pools = { round: [], chain: [], grape: [], fire: [] };
function ballMesh(ammo) {
  if (pools[ammo].length) { const m = pools[ammo].pop(); m.visible = true; return m; }
  let m;
  if (ammo === 'chain') {
    m = new THREE.Group();
    for (const s of [-1, 1]) { const b = new THREE.Mesh(ballGeo, ironMat); b.position.x = s * 0.8; b.scale.setScalar(0.8); m.add(b); }
    m.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), ironMat));
  } else if (ammo === 'grape') {
    m = new THREE.Group();
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(ballGeo, ironMat); b.position.set(rand(-0.7, 0.7), rand(-0.5, 0.5), rand(-0.7, 0.7)); b.scale.setScalar(0.38); m.add(b); }
  } else m = new THREE.Mesh(ballGeo, ammo === 'fire' ? hotMat : ironMat);
  scene.add(m);
  return m;
}
function clearBalls() {
  for (const b of G.balls) { b.mesh.visible = false; pools[b.ammo].push(b.mesh); }
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
  const k = alongKeel(tgt, ship.pos.x, ship.pos.z), normal = ship.heading + (side === 'port' ? 1 : -1) * Math.PI / 2;
  const nx = tgt.pos.x + tgt.fwdX * k - ship.pos.x, nz = tgt.pos.z + tgt.fwdZ * k - ship.pos.z;
  const bears = Math.abs(wrap(Math.atan2(nx, nz) - normal)) <= ship.arc || Math.abs(wrap(Math.atan2(tgt.pos.x - ship.pos.x, tgt.pos.z - ship.pos.z) - normal)) <= ship.arc;
  return bears && Math.hypot(nx, nz) <= ship.range() * slack;
}
// The weather gauge: the ship upwind of the other shoots through clear air.
function hasGauge(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
  return (dx * Math.sin(world.wind.dir) + dz * Math.cos(world.wind.dir)) / d > 0.4;
}
function clearShot(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, l2 = dx * dx + dz * dz;
  for (const i of world.islands) {
    const t = clamp(((i.x - a.pos.x) * dx + (i.z - a.pos.z) * dz) / l2, 0, 1);
    if (Math.hypot(a.pos.x + dx * t - i.x, a.pos.z + dz * t - i.z) < i.r * 0.9) return false;
  }
  return true;
}
const aiApi = { fire: (s, side) => fire(s, side), clearShot: (a, b) => clearShot(a, b), shotSpeed: (s) => AMMO[s.ammo].speed, reach: (a, b) => reach(a, b), strength: (s) => strength(s) };
function fire(ship, side) {
  if (G.state !== 'battle' || ship.reload[side] > 0 || ship.sinking > 0 || ship.struck) return false;
  let ammo = ship.ammo;
  if (ammo !== 'round') { if (ship.stock[ammo] <= 0) ammo = ship.ammo = 'round'; else ship.stock[ammo]--; }
  const n = ship.model.muzzles[side].length, volley = ++G.volley;
  for (let i = 0; i < n; i++) G.pending.push({ t: i * 0.075 + Math.random() * 0.07, ship, side, i, ammo, volley });
  ship.startReload(side);
  if (ammo !== 'round' && ship.stock[ammo] <= 0) {
    ship.ammo = 'round';
    if (ship.isPlayer) toast(`Out of ${AMMO[ammo].long.toLowerCase()} — loading round shot`);
  }
  if (ship.isPlayer) { G.stats.volleys++; G.shake = Math.max(G.shake, 0.5); G.fired = true; }
  return true;
}
function launch(p) {
  const { ship, side, ammo } = p, A = AMMO[ammo], sgn = side === 'port' ? 1 : -1;
  if (ship.sinking > 0) return;
  ship.toWorld(ship.model.muzzles[side][p.i], _m);
  const normal = ship.heading + sgn * Math.PI / 2;
  const R = ship.range(ammo);
  let aim = normal, dist = R * 0.75, h = -_m.y, gauge = 1;
  const tgt = ship.target;
  if (tgt && tgt.sinking <= 0) {
    let tx = tgt.pos.x, tz = tgt.pos.z;
    const tt = Math.hypot(tx - _m.x, tz - _m.z) / (A.speed * 0.98);
    // spread the battery along her hull, but only over the part that is within reach
    const near = alongKeel(tgt, _m.x, _m.z), spanL = tgt.spec.L * 0.31;
    let along = (Math.random() * 2 - 1) * spanL;
    if (Math.hypot(tx + tgt.fwdX * along - _m.x, tz + tgt.fwdZ * along - _m.z) > R) along = clamp(near + (Math.random() - 0.5) * tgt.spec.L * 0.2, -tgt.spec.L * 0.44, tgt.spec.L * 0.44);
    tx += tgt.fwdX * (tgt.speed * tt + along); tz += tgt.fwdZ * (tgt.speed * tt + along);
    const dx = tx - _m.x, dz = tz - _m.z, ang = Math.atan2(dx, dz), d = Math.hypot(dx, dz);
    if (Math.abs(wrap(ang - normal)) <= ship.arc + 0.06 && d <= R * 1.12) {
      aim = ang; dist = Math.min(d, R);
      h = (ammo === 'chain' ? tgt.model.mastH * 0.5 : tgt.spec.D * 0.45) + tgt.group.position.y - _m.y;
    }
    gauge = hasGauge(ship, tgt) ? 0.75 : hasGauge(tgt, ship) ? 1.15 : 1;
  }
  const spread = ship.disp * (ammo === 'grape' ? 1.15 : 1) * (1.25 - 0.25 * ship.crewR) * SAILS[ship.sailLevel].aim * gauge * ((tgt && tgt.evade) || 1);
  aim += gauss() * spread * 1.6;
  const v = A.speed * (1 + gauss() * 0.02), v2 = v * v;
  const disc = v2 * v2 - GRAV * (GRAV * dist * dist + 2 * h * v2);
  const el = (disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (GRAV * dist))) + gauss() * spread * 1.15;
  const ce = Math.cos(el);
  const mesh = ballMesh(ammo);
  mesh.position.copy(_m);
  G.balls.push({ mesh, ammo, owner: ship, volley: p.volley, rigged: false, spin: rand(8, 16), vel: new THREE.Vector3(Math.sin(aim) * ce * v, Math.sin(el) * v, Math.cos(aim) * ce * v) });
  fx.cannon(_m, Math.sin(normal), Math.cos(normal));
  sfx.cannon(0.25 + 0.75 * camVol(_m));
  if (ship.isPlayer) G.stats.shots++;
}
function hullHit(b, ship) {
  const A = AMMO[b.ammo], hv = Math.hypot(b.vel.x, b.vel.z) || 1;
  const d = (b.vel.x * ship.fwdX + b.vel.z * ship.fwdZ) / hv;
  let m = b.owner.dmgMult, rake = 0;
  // a raking shot ploughs the whole length of the deck, so the longer the ship the worse it is
  if (Math.abs(d) > 0.78) { rake = (d > 0 ? 1.8 : 1.5) * clamp(ship.spec.L / 30, 0.8, 1.5); m *= rake; }
  const hd = A.hull * m, sd = b.ammo !== 'chain' ? Math.min(ship.sails, A.sail * 0.4) : 0;
  ship.hull -= hd; ship.sails -= sd;
  let kills = 0;
  if (A.kills) kills = Math.round(rand(A.kills[0], A.kills[1]) * (rake ? 1.6 : 1) * b.owner.dmgMult);
  else if (Math.random() < A.crew * (rake ? 2.4 : 1)) kills = 1 + (rake && Math.random() < 0.5 ? 1 : 0);
  kills = Math.min(kills, Math.floor(ship.exposed)); // the men below decks are out of reach
  ship.crew -= kills;
  if (sd > 0) ship.rigT = 0;
  // one fire per volley at most, so a single broadside can't set three at once
  if (A.ignite && ship.litBy !== b.volley && Math.random() < A.ignite) {
    ship.litBy = b.volley;
    if (ship.fire === 0) floater(ship.isPlayer ? 'FIRE! Our gunners leave their guns' : 'FIRE! Her gunners leave their guns', ship.isPlayer ? 'bad rake' : 'good rake', _v.set(ship.pos.x, ship.model.mastH * 0.8, ship.pos.z).clone());
    // small shot starts small fires: light guns can keep one fire going, medium two, heavy three
    const most = 1 + ['light', 'medium', 'heavy'].indexOf(b.owner.cal.name);
    ship.fire = Math.max(ship.fire, Math.min(most, ship.fire + 1)); ship.fireT = 11;
  }
  const p = b.mesh.position;
  if (b.ammo === 'grape') fx.grape(p); else fx.wood(p, rake ? 16 : 10);
  sfx.thud(0.2 + 0.8 * camVol(p));
  tally(ship, hd, sd, kills, !!rake, p);
  if (b.owner.isPlayer) { G.stats.hits++; if (rake) G.raked = true; }
  if (ship.isPlayer) G.shake = Math.max(G.shake, 0.7);
}
function rigHit(b, ship, amt) {
  const d = Math.min(ship.sails, amt * b.owner.dmgMult * SAILS[ship.sailLevel].dmg);
  ship.sails -= d; ship.rigT = 0;
  fx.canvas(b.mesh.position, new THREE.Color(ship.spec.sailCol));
  sfx.rip(0.2 + 0.8 * camVol(b.mesh.position));
  tally(ship, 0, d, 0, false, b.mesh.position);
  if (b.owner.isPlayer) G.stats.hits++;
}
function testHit(b, ship) {
  ship.toLocal(b.mesh.position, _l);
  const sp = ship.spec, hl = sp.L / 2;
  if (Math.abs(_l.z) > hl || Math.abs(_l.x) > sp.B / 2 + 1.5) return false;
  const zf = _l.z / hl, hw = (sp.B / 2 + 0.3) * (zf > 0.2 ? 1 - ((zf - 0.2) / 0.8) * 0.7 : 1), deck = sp.D + 1.3 + (zf < -0.45 ? (+sp.castle || 0) * (2.4 + sp.L * 0.012) + 1 : zf > 0.7 && sp.fore ? 2.4 : 0);
  if (_l.y > -1.6 && _l.y <= deck && Math.abs(_l.x) <= hw) { hullHit(b, ship); return true; }
  if (_l.y > deck && _l.y < ship.model.mastH && Math.abs(_l.z) < hl * 0.86) {
    if (b.ammo === 'chain') { rigHit(b, ship, AMMO.chain.sail); return true; }
    if (!b.rigged) { b.rigged = true; if (Math.random() < 0.3) rigHit(b, ship, 2); }
  }
  return false;
}
function updateBalls(dt) {
  for (let i = G.pending.length - 1; i >= 0; i--) {
    const p = G.pending[i];
    if ((p.t -= dt) <= 0) { G.pending.splice(i, 1); launch(p); }
  }
  const ships = [G.player, G.enemy];
  for (let i = G.balls.length - 1; i >= 0; i--) {
    const b = G.balls[i], pos = b.mesh.position;
    const steps = Math.max(1, Math.ceil((b.vel.length() * dt) / 1.3)), h = dt / steps;
    let done = false;
    for (let s = 0; s < steps && !done; s++) {
      b.vel.y -= GRAV * h;
      pos.addScaledVector(b.vel, h);
      for (const sh of ships) if (sh && sh !== b.owner && sh.sinking < 3 && testHit(b, sh)) { done = true; break; }
      if (done) break;
      for (const isl of world.islands) {
        const d = Math.hypot(pos.x - isl.x, pos.z - isl.z);
        if (d < isl.r * 1.1 * (1 - clamp(pos.y / (isl.h * 1.4), 0, 1))) { fx.wood(pos, 5); done = true; break; }
      }
      if (!done && pos.y < world.height(pos.x, pos.z)) { fx.splash(pos, b.ammo === 'grape' ? 0.5 : 1); sfx.splash(camVol(pos)); done = true; }
    }
    if (b.ammo === 'chain') { b.mesh.rotation.y += b.spin * dt; b.mesh.rotation.z += b.spin * 0.6 * dt; }
    if (b.ammo === 'fire') fx.trail(pos, 1, 0.5, 0.15, true);
    if (done) { b.mesh.visible = false; pools[b.ammo].push(b.mesh); G.balls.splice(i, 1); }
  }
}

// ---------- collisions, fire, wake ----------
function circles(s) { const o = s.spec.L * 0.33; return [-o, 0, o].map((k) => [s.pos.x + s.fwdX * k, s.pos.z + s.fwdZ * k]); }
function collide(a, b) {
  if (!a || !b || a.sinking > 2 || b.sinking > 2) return;
  const ra = a.spec.B * 0.55 + 0.4, rb = b.spec.B * 0.55 + 0.4;
  for (const ca of circles(a)) for (const cb of circles(b)) {
    const dx = cb[0] - ca[0], dz = cb[1] - ca[1], d = Math.hypot(dx, dz) || 0.01, ov = ra + rb - d;
    if (ov <= 0) continue;
    const nx = dx / d, nz = dz / d, rel = relSpeed(a, b);
    a.pos.x -= nx * ov * 0.5; a.pos.z -= nz * ov * 0.5; b.pos.x += nx * ov * 0.5; b.pos.z += nz * ov * 0.5;
    if (a.ramCd <= 0 && rel > 5 && G.state === 'battle') {
      a.ramCd = b.ramCd = 1.6;
      const dmg = rel * 1.3;
      a.hull -= dmg; b.hull -= dmg; a.speed *= 0.6; b.speed *= 0.6;
      fx.wood(new THREE.Vector3((ca[0] + cb[0]) / 2, 2, (ca[1] + cb[1]) / 2), 18);
      sfx.thud(1); G.shake = 1; toastOnce('ram', 2, 'Collision!', 'bad');
    }
  }
}
function collideIslands(s) {
  for (const isl of world.islands) for (const c of circles(s)) {
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
function shipEffects(s, dt) {
  const sp = s.spec;
  if (s.fire > 0 && s.sinking <= 0) {
    s.hull -= 0.0042 * s.hullMax * s.fire * dt; // the more timber, the more there is to burn
    s.sails = Math.max(0, s.sails - 0.5 * s.fire * dt);
    if (s.exposed >= 1 && Math.random() < 0.13 * s.fire * dt) s.crew -= 1;
    s.fireT -= dt * (0.5 + 0.9 * s.crewR);
    if (s.fireT <= 0) { s.fire--; s.fireT = 11; if (s.fire === 0 && s.isPlayer) toast('Fires are out', 'good'); }
    for (let i = 0; i < s.fire; i++) {
      const p = s.toWorld(_l.set(rand(-0.3, 0.3) * sp.B, sp.D + rand(0, 4), rand(-0.35, 0.35) * sp.L), _m);
      fx.flame(p.x, p.y, p.z);
      if (Math.random() < 0.25) fx.smoke(p.x, p.y + 2, p.z, 0.12, Math.sin(world.wind.dir) * 3, Math.cos(world.wind.dir) * 3);
    }
  }
  s.fxT -= dt;
  if (s.fxT > 0) return;
  s.fxT = 0.06;
  if ((s.hullR < 0.45 || s.sinking > 0) && Math.random() < 0.5) {
    const p = s.toWorld(_l.set(0, sp.D + 1, rand(-0.3, 0.3) * sp.L), _m);
    fx.smoke(p.x, p.y, p.z, 0.22, Math.sin(world.wind.dir) * 3, Math.cos(world.wind.dir) * 3);
  }
  const v = s.speed;
  if (v > 1.5 && s.sinking < 2) {
    const sx = s.pos.x - s.fwdX * sp.L * 0.5, sz = s.pos.z - s.fwdZ * sp.L * 0.5;
    fx.foam(sx + rand(-1.5, 1.5), world.height(sx, sz) + 0.25, sz + rand(-1.5, 1.5), 0, 0, 1.6 + v * 0.14, 2.2 + v * 0.12);
    for (const side of [-1, 1]) {
      const bx = s.pos.x + s.fwdX * sp.L * 0.4 + s.fwdZ * side * 1.4, bz = s.pos.z + s.fwdZ * sp.L * 0.4 - s.fwdX * side * 1.4;
      fx.foam(bx, world.height(bx, bz) + 0.3, bz, s.fwdZ * side * v * 0.35, -s.fwdX * side * v * 0.35, 1.2 + v * 0.08, 1.4);
    }
  }
  if (s.sinking > 0 && s.sinking < 7) fx.splash(_m.set(s.pos.x + rand(-6, 6), 0.3, s.pos.z + rand(-8, 8)), 0.4);
}

// ---------- battle flow ----------
// A prize is worth more the less you've wrecked her: bounty for a wreck, double for an intact hull.
const prize = (e) => Math.round((e.spec.bounty * (1 + clamp(e.hullR, 0, 1))) / 10) * 10;
function startIntro() {
  const es = ENEMIES[G.level];
  harbor.group.visible = false;
  for (const t of G.trophyShips) t.group.visible = false;
  if (G.enemy) scene.remove(G.enemy.group);
  clearBalls();
  world.setEnv(es.env);
  world.setIslands(4242 + G.level * 97 + ((Math.random() * 1000) | 0), es.islands);
  world.wind.dir = world.wind.target = rand(0, Math.PI * 2);
  const e = (G.enemy = new Ship({ ...es, seedSign: Math.random() < 0.5 ? -1 : 1 }, false));
  scene.add(e.group);
  const p = G.player;
  p.pos.set(0, 0, 0); p.heading = wrap(world.wind.dir + Math.PI / 2); p.speed = 7; p.sailLevel = TOP; p.input.turn = 0;
  p.reload.port = p.reload.stbd = 0; p.fire = 0; p.ammo = 'round'; p.sinking = 0; p.struck = false; p.boardView = null;
  let a = p.heading + rand(-0.7, 0.7), tries = 0;
  do { e.pos.set(Math.sin(a) * 500, 0, Math.cos(a) * 500); a += 0.4; } while (tries++ < 16 && world.islands.some((i) => Math.hypot(i.x - e.pos.x, i.z - e.pos.z) < i.r + 60));
  e.heading = Math.atan2(-e.pos.x, -e.pos.z) + 0.5; e.speed = 6; e.sailLevel = 2;
  p.target = e; e.target = p;
  G.ai = newAI(); G.aiGrapple = 0; G.boardCd = 0; G.outcome = null; G.bd = null;
  G.state = 'intro'; G.focus = 'enemy';
  G.saved = { hull: p.hull, sails: p.sails, crew: p.crew, stock: { ...p.stock } };
  showIntro(es);
}
function beginBattle() {
  G.state = 'battle'; G.focus = 'player'; G.cam.yaw = 0; G.battleT = 0; G.fired = G.raked = false;
  G.enemy.sailLevel = TOP; G.player.sailLevel = TOP;
  hideScreen(); setMode('battle');
  fitArcs(myArcs, G.player); fitArcs(herArcs, G.enemy);
  noGo.geometry.dispose(); noGo.geometry = noGoGeo(noGoHalf(G.player.spec));
  BOARD_RANGE = Math.round((20 + (G.player.spec.B + G.enemy.spec.B) * 0.8) * G.player.spec.mods.boardReach);
  BOARD_SPEED = 6.5 * G.player.spec.mods.boardSpeed;
  boardRing.geometry.dispose(); boardRing.geometry = new THREE.RingGeometry(BOARD_RANGE - 1.6, BOARD_RANGE, 72).rotateX(-Math.PI / 2);
  buildAmmoBar(); setupHudNames();
  G.coach = G.level === 0 && !store.get('broadside.coached') ? { i: 0, t: 0 } : null;
  if (!G.coach) setTimeout(() => G.state === 'battle' && toast(ENEMIES[G.level].tip, '', 6000), 1500);
  sfx.horn(true);
}
function endBattle(outcome) {
  if (G.state === 'ending') return;
  const e = G.enemy, p = G.player;
  if (outcome === 'captured') G.prize = prize(e);
  const wreck = outcome === 'struck';
  G.outcome = outcome; G.state = 'ending';
  G.endT = outcome === 'captured' || wreck ? 3.2 : 6.5;
  G.pending.length = 0; G.bd = null;
  setMode('battle');
  if (outcome === 'sunk') { G.stats.sunk++; e.sinking = Math.max(e.sinking, 0.01); toast(`${e.spec.name} is going down!`, 'big', 4000); sfx.horn(true); G.focus = 'enemy'; }
  else if (outcome === 'captured' || wreck) { if (wreck) G.stats.sunk++; else G.stats.captured++; e.struck = true; e.fire = 0; toast(wreck ? `${e.spec.name} strikes — a floating wreck` : `${e.spec.name} is yours!`, 'big', 4000); sfx.horn(true); G.focus = 'enemy'; }
  else { if (outcome === 'lost') p.sinking = Math.max(p.sinking, 0.01); toast(outcome === 'lost' ? 'We are sinking!' : 'The deck is lost!', 'bad', 4000); sfx.horn(false); }
}
function battleUpdate(dt) {
  const p = G.player, e = G.enemy;
  G.battleT += dt; G.stats.time += dt;
  if (G.bot) G.bot(p, e, dt); // test hook: a scripted helmsman
  else if (G.auto) updateAI(G.auto, p, e, world, dt, aiApi);
  else if (!G.bot) p.input.turn = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0);
  if (G.coach && G.coach.i < 2 && G.battleT < 60) G.ai.fireDelay = 2; // first fight: she holds fire until you have fired
  updateAI(G.ai, e, p, world, dt, aiApi);
  G.boardCd -= dt;
  const alongside = sep(p, e) < BOARD_RANGE && relSpeed(p, e) < BOARD_SPEED && G.boardCd <= 0;
  const can = alongside && p.speed < BOARD_SLOW; // she can grapple you only if you are slow
  G.canBoard = alongside && e.speed < BOARD_SLOW * p.spec.mods.boardSpeed;
  G.aiGrapple = clamp(G.aiGrapple + (can && G.ai.wantBoard ? dt / 2.4 : -dt * 0.7), 0, 1);
  if (G.aiGrapple >= 1) return startBoarding('enemy');
  if (p.sailLevel > 0 && p.speed < 2.5 && Math.abs(wrap(p.heading - world.wind.dir)) > Math.PI - noGoHalf(p.spec) + 0.05) toastOnce('irons', 10, 'In irons — turn away from the wind’s eye!', 'bad', 3000);
  if (e.hull <= 0) return endBattle('sunk');
  if (p.hull <= 0) return endBattle('lost');
  // a pirate battered to a wreck gives up rather than soak volleys to the bottom: you collect the
  // bounty, but the hulk is worth nothing. Only a boarding takes a ship. The last one fights on.
  if (G.level < ENEMIES.length - 1 && e.hullR < 0.15) return endBattle('struck');
  // whoever is upwind shoots through clear air; say so when it changes hands
  const gauge = hasGauge(p, e) ? 1 : hasGauge(e, p) ? -1 : 0;
  if (gauge !== G.gauge && G.battleT > 3) {
    if (gauge) floater(gauge > 0 ? 'Upwind of her: steadier guns' : 'Downwind of her: smoke in your eyes', gauge > 0 ? 'good' : 'bad', _m.set(p.pos.x, 16, p.pos.z));
  }
  G.gauge = gauge;
  coachUpdate(dt);
  // the boarding ring explains itself the first time you get near it
  if (!G.coach && !store.get('broadside.ringed') && sep(p, e) < 150 && G.battleT > 8) {
    store.set('broadside.ringed', '1');
    $('coach').innerHTML = '<span>The ring around her is boarding range. Get inside it, match her speed, press <kbd>B</kbd>. Only a boarded ship is yours to keep.</span><button data-act="hidecoach">ok</button>';
    $('coach').classList.remove('hidden'); G.coachHide = G.battleT + 9;
  }
  if (G.coachHide && G.battleT > G.coachHide) { G.coachHide = 0; $('coach').classList.add('hidden'); }
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
  if (from.reload[side] > 0) return;
  const guns = from.model.muzzles[side].length, a = from.ammo;
  if (a !== 'round') { if (from.stock[a] <= 0) return; from.stock[a]--; }
  const kills = Math.min(to.crew - 1, Math.round(guns * (a === 'grape' ? 2.6 : a === 'round' ? 0.9 : a === 'fire' ? 0.7 : 0.3) * from.dmgMult * (from.spec.mods ? from.spec.mods.swivel : 1)));
  const hull = guns * (a === 'round' ? 4.5 : a === 'fire' ? 3.2 : 0.6) * from.dmgMult;
  to.crew -= kills; to.hull = Math.max(1, to.hull - hull);
  from.startReload(side);
  for (const m of from.model.muzzles[side]) { const q = from.toWorld(m, _m); fx.cannon(q, Math.sin(from.heading + (side === 'port' ? 1 : -1) * Math.PI / 2), Math.cos(from.heading + (side === 'port' ? 1 : -1) * Math.PI / 2)); }
  sfx.cannon(1); G.shake = 1;
  const q = to.toWorld(_l.set(0, to.spec.D + 8, 0), new THREE.Vector3());
  fx.grape(q);
  floater(`${name}  −${kills} crew` + (hull >= 5 ? `  −${Math.round(hull)} hull` : ''), to.isPlayer ? 'bad rake' : 'good rake', q);
  toast(from.isPlayer ? `Point-blank ${AMMO[a].long.toLowerCase()}: ${kills} of her crew cut down` : `Her guns at the rail: ${kills} of ours cut down`, from.isPlayer ? 'good' : 'bad', 3500);
}
function startBoarding(by) {
  const p = G.player, e = G.enemy;
  G.state = 'boarding'; G.pending.length = 0; G.aiGrapple = 0;
  const side = wrap(Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - p.heading) > 0 ? 1 : -1;
  const same = Math.abs(wrap(e.heading - p.heading)) < Math.PI / 2, eSide = same ? -side : side;
  pointBlank(p, e, side > 0 ? 'port' : 'stbd', 'Point-blank!');
  pointBlank(e, p, eSide > 0 ? 'port' : 'stbd', 'Her guns!');
  G.bd = { side, off: p.spec.B / 2 + e.spec.B / 2 + 1.4, th: same ? 0 : Math.PI, by, t: 0, fxT: 0, cd: 1.5, eCd: 5, p0: p.crew, e0: e.crew, warned: false };
  p.boardView = { side, lanes: [0, 0, 0], won: [false, false, false], flip: false, reach: e.spec.B * 0.5 };
  e.boardView = { side: eSide, lanes: [0, 0, 0], won: [false, false, false], flip: !same, reach: p.spec.B * 0.5 };
  G.focus = 'both'; G.cam.yaw = 0;
  p.sailLevel = e.sailLevel = 0; // canvas in, so the decks are in plain view
  setMode('melee');
  $('mPN').textContent = p.spec.name; $('mEN').textContent = e.spec.name;
  toast(by === 'player' ? 'Boarders away!' : 'Repel boarders!', 'big');
  sfx.clang();
}
function syncBoardView(pWon, eWon) {
  const p = G.player, e = G.enemy;
  for (let i = 0; i < 3; i++) { p.boardView.lanes[i] = p.crew / 3; e.boardView.lanes[i] = e.crew / 3; p.boardView.won[i] = !!pWon; e.boardView.won[i] = !!eWon; }
}
function boardingUpdate(dt) {
  const b = G.bd, p = G.player, e = G.enemy;
  const tx = p.pos.x + Math.cos(p.heading) * b.side * b.off, tz = p.pos.z - Math.sin(p.heading) * b.side * b.off;
  const k = Math.min(1, dt * 1.5);
  e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k;
  e.heading = wrap(e.heading + wrap(p.heading + b.th - e.heading) * k);
  b.t += dt; b.cd -= dt; b.eCd -= dt;
  syncBoardView();
  if (b.t < 2.4) return; // a beat to take in the opening volley before blades meet
  // each side cuts the other down in proportion to its own strength, so the bigger crew pulls
  // ahead faster and faster; the pace climbs so no fight drags
  const rush = b.t < 6 ? (b.by === 'player' ? 1.15 : 1 / 1.15) : 1, pace = 0.028 + 0.0035 * b.t;
  const sp = strength(p) * rush, se = strength(e) / rush;
  p.crew = Math.max(0, p.crew - pace * se * dt); e.crew = Math.max(0, e.crew - pace * sp * dt);
  if (e.spec.ai.boarder && e.stock.grape > 0 && b.eCd <= 0) { e.stock.grape--; b.eCd = 7; swivel(p, e, 6); }
  if ((b.fxT -= dt) <= 0) {
    b.fxT = 0.1;
    const who = Math.random() < 0.5 ? p : e, q = who.toWorld(_l.set(b.side * (who === p ? 1 : -1) * rand(0.1, 0.5) * who.spec.B, who.spec.D + 1.5, rand(-0.35, 0.35) * who.spec.L), _m);
    if (Math.random() < 0.4) { fx.musket(q.x, q.y, q.z); sfx.musket(); } else if (Math.random() < 0.5) sfx.clang();
  }
  // a crew that has lost seven in ten of the men it brought to the rail gives up the deck
  if (e.crew <= Math.max(1, b.e0 * 0.3)) { syncBoardView(true, false); return endBattle('captured'); }
  if (p.crew <= Math.max(1, b.p0 * 0.3)) { syncBoardView(false, true); return endBattle('overrun'); }
  if (!b.warned && p.crew < b.p0 * 0.55 && sp < se) { b.warned = true; toast('We are losing the deck — cut the grapples!', 'bad', 3000); }
}
function swivel(target, by, n) {
  const kill = Math.min(target.crew - 1, n + Math.random() * 3);
  target.crew -= kill;
  const q = target.toWorld(_l.set(0, target.spec.D + 2, 0), new THREE.Vector3());
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
  swivel(G.enemy, p, 8 * p.spec.mods.swivel);
}
function cutGrapples() {
  const b = G.bd, p = G.player, e = G.enemy;
  if (!b || G.state !== 'boarding') return;
  p.crew = Math.max(3, p.crew * 0.9);
  p.boardView = e.boardView = null; G.bd = null;
  G.state = 'battle'; G.focus = 'player'; G.boardCd = 9; p.speed = 5; e.speed = 1; p.sailLevel = TOP; e.sailLevel = 2;
  p.reload.port = Math.max(p.reload.port, 2); p.reload.stbd = Math.max(p.reload.stbd, 2);
  setMode('battle');
  toast('Grapples cut — make sail!', '');
}
function tryBoard() {
  const p = G.player, e = G.enemy;
  if (G.state !== 'battle') return;
  if (G.canBoard) return startBoarding('player');
  const d = sep(p, e);
  if (G.boardCd > 0 && d < BOARD_RANGE) toast('The crew needs a moment before another attempt', '', 1400);
  else if (d >= BOARD_RANGE) toast(`Too far to board: ${Math.round(d)} yds, need under ${BOARD_RANGE - 3}`, '', 1600);
  else if (e.speed >= BOARD_SLOW * p.spec.mods.boardSpeed) toast('She is moving too fast for grapples to hold — cut up her sails first', '', 2200);
  else toast('Match her speed first — you are passing too fast', '', 1600);
}

// ---------- first-fight coaching: one line at a time, each cleared by doing it ----------
const COACH = [
  { text: '<kbd>A</kbd> <kbd>D</kbd> steer. Bring her inside one of the pale arcs off your sides.', done: (p, e) => ['port', 'stbd'].some((s) => inArc(p, s, e, 1.05)) },
  { text: '<kbd>Space</kbd> fires the side she is on.', done: () => G.fired },
  { text: '<kbd>W</kbd> <kbd>S</kbd> more or less sail. The red wedge on the water is where the wind will not take you.', done: (p) => p.sailLevel !== TOP, max: 16 },
  { text: '<kbd>1</kbd>–<kbd>4</kbd> change shot: round for the hull, chain for sails, grape for crew, heated for fire.', done: (p) => p.ammo !== 'round', max: 14 },
];
function endCoach() { G.coach = null; store.set('broadside.coached', '1'); $('coach').classList.add('hidden'); }
function coachUpdate(dt) {
  const c = G.coach;
  if (!c) return;
  const step = COACH[c.i], el = $('coach');
  if (!step) return endCoach();
  if (c.t === 0) { el.innerHTML = `<span>${step.text}</span><i>${c.i + 1}/${COACH.length}</i><button data-act="skipcoach">skip</button>`; el.classList.remove('hidden'); }
  c.t += dt;
  if ((c.t > 2 && step.done && step.done(G.player, G.enemy)) || (step.max && c.t > step.max)) { c.i++; c.t = 0; sfx.ui(); }
}

// ---------- camera ----------
function updateCamera(dt) {
  const c = G.cam, p = G.player, e = G.enemy, st = G.state;
  const center = _m.set(p.pos.x, 7, p.pos.z);
  let want, dist = c.dist * clamp(p.spec.L / 30, 0.85, 1.6), pitch = c.pitch, rate = 1.5;
  if (st === 'title' || st === 'won') { center.set(p.pos.x - 6, 9, p.pos.z); want = 0.75 + Math.sin(G.t * 0.1) * 0.25 + c.yaw; dist = 72; pitch = 0.16; }
  else if (st === 'port') {
    const sp = G.shop && harbor.spots.find((s) => s.id === G.shop), ts = G.shop && G.trophyShips.find((t) => 'ship:' + t.id === G.shop);
    if (sp) { center.set(sp.pos.x * 0.75, 7, sp.pos.z + 16); dist = 72; } else if (ts) { center.set(ts.pos.x, 8, ts.pos.z); dist = 80; } else { center.set(0, 7, 4); dist = 128; }
    want = 0.3 + Math.sin(G.t * 0.07) * 0.14 + c.yaw; pitch = 0.27;
  } else if (G.focus === 'enemy' && e) {
    const intro = st === 'intro';
    center.set(e.pos.x, intro ? 2 : 8, e.pos.z); want = G.t * 0.12 + c.yaw; dist = 52 + e.spec.L * 1.3; pitch = intro ? 0.12 : 0.22;
  } else if (G.focus === 'both' && e) {
    center.set((p.pos.x + e.pos.x) / 2, 5, (p.pos.z + e.pos.z) / 2);
    want = p.heading - (G.bd ? G.bd.side : 1) * Math.PI / 2 + c.yaw; dist = 30 + (p.spec.L + e.spec.L) * 0.38; pitch = 1.02; rate = 2.5;
  } else if (c.mode === 'helm' && e) {
    // behind your own ship, so left on screen is always port, but swung toward whichever side she is on
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    const rel = wrap(Math.atan2(dx, dz) - p.heading), ease = clamp((3.0 - Math.abs(rel)) / 0.7, 0.2, 1);
    const lead = clamp(d * 0.18, 0, 40);
    center.x += (dx / d) * lead * ease; center.z += (dz / d) * lead * ease;
    want = p.heading + Math.PI + clamp(rel, -1.25, 1.25) * ease + c.yaw; dist *= clamp(1 + d / 420, 1.1, 1.75); pitch = c.pitch + 0.1; rate = 1.8;
  } else if (c.mode === 'combat' && e) {
    // stay behind the player on the line to the enemy, so she is always ahead of the lens
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1, lead = clamp(d * 0.28, 0, 70);
    center.x += (dx / d) * lead; center.z += (dz / d) * lead;
    want = Math.atan2(-dx, -dz) + c.yaw; dist *= clamp(0.85 + d / 330, 0.9, 2); rate = 3;
  } else { want = p.heading + Math.PI + c.yaw; rate = 3.2; }
  if (camera.aspect < 1) dist *= 1.55;
  c.angle += wrap(want - c.angle) * Math.min(1, dt * rate);
  const cp = Math.cos(pitch);
  const tx = center.x + Math.sin(c.angle) * cp * dist, tz = center.z + Math.cos(c.angle) * cp * dist, ty = center.y + Math.sin(pitch) * dist;
  const k = Math.min(1, dt * 5);
  c.pos.x += (tx - c.pos.x) * k; c.pos.y += (ty - c.pos.y) * k; c.pos.z += (tz - c.pos.z) * k;
  c.pos.y = Math.max(c.pos.y, world.height(c.pos.x, c.pos.z) + 2.5);
  c.look.lerp(center, Math.min(1, dt * 6));
  camera.position.copy(c.pos);
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 2.5);
    camera.position.x += (Math.random() - 0.5) * G.shake * 1.2; camera.position.y += (Math.random() - 0.5) * G.shake * 1.2;
  }
  camera.lookAt(c.look);
  camera.updateMatrixWorld();
}
function snapCamera() { for (let i = 0; i < 40; i++) updateCamera(0.1); }

// ---------- HUD ----------
const ICON = {
  round: '<circle cx="13" cy="13" r="8" fill="#222" stroke="#999"/>',
  chain: '<circle cx="6" cy="18" r="5" fill="#222" stroke="#999"/><circle cx="20" cy="8" r="5" fill="#222" stroke="#999"/><path d="M9 15l8-5" stroke="#bbb" stroke-width="2" stroke-dasharray="2 1.5"/>',
  grape: '<g fill="#222" stroke="#999"><circle cx="9" cy="9" r="4"/><circle cx="17" cy="9" r="4"/><circle cx="13" cy="16" r="4"/><circle cx="6" cy="18" r="3"/><circle cx="20" cy="18" r="3"/></g>',
  fire: '<circle cx="13" cy="15" r="7" fill="#e2571c" stroke="#ffb35a"/><path d="M13 1c3 4-2 5 1 9-4-1-5-5-1-9z" fill="#ffb35a"/>',
};
function setMode(m) { // which layer of interface is up: battle, melee, port, or none
  const hud = $('hud');
  hud.className = m ? 'm-' + m : 'hidden';
  $('melee').classList.toggle('hidden', m !== 'melee');
  $('port').classList.toggle('hidden', m !== 'port');
  $('bars').classList.remove('on');
  if (m !== 'battle' && m !== 'melee') { $('pStatus').textContent = ''; $('toasts').innerHTML = ''; }
  if (m !== 'battle') { $('coach').classList.add('hidden'); $('tag').classList.add('hidden'); $('boardGo').classList.add('hidden'); }
}
function buildAmmoBar() {
  $('ammo').innerHTML = AMMO_KEYS.map((k, i) => `<div class="slot" data-ammo="${k}" title="${AMMO[k].tip}"><kbd>${i + 1}</kbd><svg viewBox="0 0 26 26">${ICON[k]}</svg><div class="n">${AMMO[k].name}</div><div class="c"></div></div>`).join('');
}
function setupHudNames() {
  const p = G.player, e = G.enemy;
  $('pName').textContent = p.spec.name; $('pSub').textContent = `${p.spec.cls} · ${p.spec.guns * 2} ${p.cal.name} guns`;
  if (e) { $('eName').textContent = e.spec.name; $('eSub').textContent = `${e.spec.cls} · ${e.spec.guns * 2} ${e.cal.name} guns`; }
}
function selectAmmo(k) {
  const p = G.player;
  if (G.state !== 'battle' || k === p.ammo) return;
  if (k !== 'round' && p.stock[k] <= 0) return toast(`No ${AMMO[k].long.toLowerCase()} left`, 'bad', 1500);
  p.setAmmo(k); sfx.ui();
  $('ammoTip').textContent = `${AMMO[k].long}: ${AMMO[k].tip}`; G.tipT = 3.5;
}
let hudTick = 0;
const rctx = $('radar').getContext('2d');
function setBars(pre, s) {
  $(pre + 'Hull').style.width = s.hullR * 100 + '%'; $(pre + 'Sail').style.width = s.sailR * 100 + '%'; $(pre + 'Crew').style.width = s.crewR * 100 + '%';
  $(pre + 'HullN').textContent = Math.max(0, Math.ceil(s.hull)); $(pre + 'SailN').textContent = Math.max(0, Math.ceil(s.sails)); $(pre + 'CrewN').textContent = Math.round(s.crew);
}
function placeArcs(a, ship, on) {
  a.grp.visible = on;
  if (!on) return;
  a.grp.position.set(ship.pos.x, 1.3, ship.pos.z); a.grp.rotation.y = ship.heading;
  a.grp.scale.setScalar(ship.range());
}
function updateHUD(dt) {
  const p = G.player, e = G.enemy, battle = G.state === 'battle';
  const dist = sep(p, e);
  placeArcs(myArcs, p, battle);
  placeArcs(herArcs, e, battle && dist < 420);
  windRing.visible = battle;
  if (battle) {
    windRing.position.set(p.pos.x, 1.4, p.pos.z);
    noGo.rotation.y = world.wind.dir + Math.PI - Math.PI / 2; // wedge points upwind
    arrowHold.rotation.y = world.wind.dir - Math.PI / 2; // arrow sits downwind of you, pointing the way the wind blows
    const stalled = Math.abs(wrap(p.heading - world.wind.dir)) > Math.PI - noGoHalf(p.spec);
    noGo.material.opacity = stalled ? 0.5 + 0.2 * Math.sin(G.t * 9) : 0.3;
  }
  boardRing.visible = battle && dist < 190 && G.boardCd <= 0;
  if (boardRing.visible) {
    const inside = dist < BOARD_RANGE, ready = inside && relSpeed(p, e) < BOARD_SPEED && e.speed < BOARD_SLOW * p.spec.mods.boardSpeed;
    boardRing.position.set(e.pos.x, 1.5, e.pos.z);
    boardRing.material.color.set(ready ? 0x7fff7a : inside ? 0xffb04a : 0xffffff);
    boardRing.material.opacity = ready ? 0.6 + 0.25 * Math.sin(G.t * 9) : inside ? 0.55 : 0.28;
  }
  for (const side of ['port', 'stbd']) {
    const ready = p.reload[side] <= 0, bear = battle && inArc(p, side, e, 1.05), el = $(side === 'port' ? 'bPort' : 'bStbd');
    const m = myArcs.sides[side].material;
    m.color.set(ready ? (bear ? 0xffd45a : 0xffffff) : 0xff6a5a); m.opacity = ready ? (bear ? 0.26 + 0.06 * Math.sin(G.t * 8) : 0.08) : 0.04;
    herArcs.sides[side].material.opacity = e.reload[side] <= 0 ? (inArc(e, side, p, 1.05) ? 0.15 : 0.08) : 0.025;
    el.classList.toggle('ready', ready); el.classList.toggle('bear', ready && bear);
    el.querySelector('i').style.width = (ready ? 100 : (1 - p.reload[side] / p.reloadMax[side]) * 100) + '%';
    el.querySelector('.s').textContent = ready ? (bear ? 'FIRE!' : 'Ready') : p.reload[side].toFixed(1) + 's';
  }
  // marker on the enemy: pinned above her, or clamped to the screen edge with an arrow when out of view
  const tag = $('tag');
  tag.classList.toggle('hidden', !battle);
  if (battle) {
    const s = project(_l.set(e.pos.x, e.group.position.y + e.model.mastH + 5, e.pos.z));
    const pad = 46, off = s.behind || s.x < pad || s.x > VW - pad || s.y < pad || s.y > VH - pad;
    let x = s.x, y = s.y;
    if (off) {
      let dx = s.x - VW / 2, dy = s.y - VH / 2;
      if (s.behind) { dx = -dx; dy = Math.abs(dy) + VH; }
      const k = Math.min((VW / 2 - pad) / Math.abs(dx || 1), (VH / 2 - pad) / Math.abs(dy || 1));
      x = VW / 2 + dx * k; y = VH / 2 + dy * k;
      tag.querySelector('.arrow').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    tag.classList.toggle('off', off);
    tag.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  }
  if (G.tipT > 0 && (G.tipT -= dt) <= 0) $('ammoTip').textContent = '';
  if (++hudTick % 4) return;
  setBars('p', p); setBars('e', e);
  if (battle) { tag.querySelector('.d').textContent = `${Math.round(dist)} yds`; tag.querySelector('.h i').style.width = e.hullR * 100 + '%'; }
  const st = (s) => [s.fire > 0 ? 'On fire' : '', s.hullR < 0.3 ? 'Taking on water' : '', s.sailR < 0.3 ? 'Rigging in tatters' : ''].filter(Boolean).join(' · ');
  $('pStatus').textContent = st(p);
  $('eStatus').textContent = [AMMO[e.ammo].long, st(e)].filter(Boolean).join(' · ');
  document.querySelectorAll('#ammo .slot').forEach((el) => {
    const k = el.dataset.ammo;
    el.classList.toggle('sel', k === p.ammo); el.classList.toggle('out', k !== 'round' && p.stock[k] <= 0);
    el.querySelector('.c').textContent = k === 'round' ? '∞' : '×' + p.stock[k];
  });
  const off = wrap(p.heading - world.wind.dir), lv = p.sailLevel;
  $('knots').textContent = (p.speed * 0.9).toFixed(1);
  $('sailName').textContent = SAILS[lv].name;
  [...$('sailBars').children].forEach((el, i) => el.classList.toggle('on', i < lv));
  const pos = pointOfSail(off, p.spec.point);
  $('pos').textContent = pos === 'In irons' ? 'In irons!' : ''; 
  // what a boarding would look like, pinned to her marker once you are close
  const near = dist < BOARD_RANGE, slow = relSpeed(p, e) < BOARD_SPEED, warn = G.aiGrapple > 0.02 && G.ai.wantBoard;
  const odds = strength(p) / (strength(e) || 1), o = tag.querySelector('.o');
  const shaken = readiness(e) < 0.8 ? (e.fire > 0 ? ' · her crew fighting fire' : ' · her crew at the pumps') : '';
  const fast = e.speed >= BOARD_SLOW * p.spec.mods.boardSpeed;
  o.textContent = battle && dist < 170 ? `Board: ${Math.round(strength(p))} v ${Math.round(strength(e))}${fast ? ' · too fast to grapple, slow her' : near && !slow ? ' · match her speed' : shaken}` : '';
  o.className = 'o ' + (odds > 1.15 ? 'good' : odds > 0.87 ? '' : 'bad');
  const go = $('boardGo');
  go.classList.toggle('hidden', !(battle && (G.canBoard || warn)));
  go.classList.toggle('warn', warn);
  go.innerHTML = warn ? `She is grappling — pull away!<i style="width:${G.aiGrapple * 100}%"></i>` : `<kbd>B</kbd> Board her <small>${odds > 1.6 ? 'strong odds' : odds > 1.15 ? 'good odds' : odds > 0.87 ? 'even odds' : odds > 0.6 ? 'poor odds' : 'hopeless'} · prize ${prize(e)} g</small>`;
  drawRadar(p, e);
}
function updateMelee() {
  const b = G.bd, p = G.player, e = G.enemy;
  if (!b) return;
  const sp = strength(p), se = strength(e), r = sp / (sp + se || 1);
  $('mPC').textContent = Math.round(p.crew); $('mEC').textContent = Math.round(e.crew);
  $('mBar').style.width = r * 100 + '%';
  // where each side breaks: the notch on its half of the bar
  $('mState').textContent = b.t < 2.4 ? 'Grapples fast…' : r > 0.57 ? 'Your men are driving them back' : r < 0.43 ? 'They are driving your men back' : 'Evenly matched — every man counts';
  $('mState').className = r > 0.57 ? 'good' : r < 0.43 ? 'bad' : '';
  $('mPL').textContent = `breaks at ${Math.ceil(b.p0 * 0.3)}`; $('mEL').textContent = `breaks at ${Math.ceil(b.e0 * 0.3)}`;
  const sw = $('mSwivel');
  sw.disabled = p.stock.grape <= 0 || b.cd > 0;
  sw.querySelector('span').textContent = p.stock.grape <= 0 ? '(no grape)' : b.cd > 0 ? `${Math.ceil(b.cd)}s` : `×${p.stock.grape}`;
}
function drawRadar(p, e) {
  const x = rctx, S = 300, c = S / 2, R = 138, range = 520, k = R / range;
  x.clearRect(0, 0, S, S);
  x.save(); x.translate(c, c);
  x.fillStyle = 'rgba(12,34,52,.85)'; x.beginPath(); x.arc(0, 0, R, 0, 7); x.fill();
  x.save(); x.beginPath(); x.arc(0, 0, R, 0, 7); x.clip();
  const pt = (wx, wz) => { const dx = wx - p.pos.x, dz = wz - p.pos.z, s = Math.sin(p.heading), co = Math.cos(p.heading); return [-(dx * co - dz * s) * k, -(dx * s + dz * co) * k]; };
  const up = wrap(world.wind.dir + Math.PI - p.heading), sa = -Math.PI / 2 - up;
  x.fillStyle = 'rgba(220,80,60,.2)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, sa - noGoHalf(p.spec), sa + noGoHalf(p.spec)); x.fill();
  x.fillStyle = '#8c8266';
  for (const i of world.islands) { const [ix, iy] = pt(i.x, i.z); x.beginPath(); x.arc(ix, iy, i.r * k * 1.1, 0, 7); x.fill(); }
  const ar = p.range() * k;
  for (const [side, a0] of [['port', Math.PI], ['stbd', 0]]) {
    x.fillStyle = p.reload[side] <= 0 ? 'rgba(255,214,110,.22)' : 'rgba(255,110,90,.1)';
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, ar, a0 - p.arc, a0 + p.arc); x.fill();
  }
  if (e && e.sinking < 6) {
    let [ex, ey] = pt(e.pos.x, e.pos.z);
    const d = Math.hypot(ex, ey);
    if (d > R - 8) { ex *= (R - 8) / d; ey *= (R - 8) / d; }
    x.save(); x.translate(ex, ey); x.rotate(-(e.heading - p.heading));
    x.fillStyle = '#ff5b4a'; x.beginPath(); x.moveTo(0, -11); x.lineTo(6, 8); x.lineTo(-6, 8); x.fill();
    x.restore();
  }
  x.restore();
  x.fillStyle = '#f3ead2'; x.beginPath(); x.moveTo(0, -13); x.lineTo(7, 10); x.lineTo(0, 6); x.lineTo(-7, 10); x.fill();
  x.strokeStyle = 'rgba(201,162,74,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
  x.rotate(-wrap(world.wind.dir - p.heading));
  x.fillStyle = '#8fd0ff'; x.beginPath(); x.moveTo(0, R - 30); x.lineTo(9, R - 6); x.lineTo(0, R - 12); x.lineTo(-9, R - 6); x.fill();
  x.fillRect(-1.5, R - 12, 3, 12);
  x.restore();
}

// ---------- screens: a name, a number, a button ----------
function showScreen(html, cls = '') { const s = $('screen'); s.innerHTML = html; s.className = cls; s.scrollTop = 0; }
function hideScreen() { $('screen').className = 'hidden'; }
const KEYS_HTML = `<div class="keys">
  <div><kbd>A</kbd><kbd>D</kbd> rudder</div><div><kbd>W</kbd><kbd>S</kbd> more / less sail</div>
  <div><kbd>Space</kbd> fire the side that bears</div><div><kbd>Q</kbd><kbd>E</kbd> fire port / starboard</div>
  <div><kbd>1</kbd>–<kbd>4</kbd> round · chain · grape · heated</div><div><kbd>B</kbd> board when alongside</div>
  <div><kbd>V</kbd> camera</div><div><kbd>P</kbd> pause · <kbd>M</kbd> mute</div></div>`;
function showTitle() {
  G.state = 'title'; setMode(null);
  showScreen(`<div id="titleWrap"><h1>Broadside</h1><div class="tag">Five pirate captains. One brig. Port Halcyon is counting on you.</div>
    <button class="btn big" data-act="sail">Weigh anchor</button></div>`, 'clear');
}
function showIntro(es) {
  setMode(null); $('bars').classList.add('on');
  showScreen(`<div class="lower"><div class="eyebrow">Wanted · ${G.level + 1} of ${ENEMIES.length}</div><h1>${es.captain}</h1>
    <div class="line">${es.cls} <i>${es.name}</i> · ${es.guns * 2} ${CAL[es.cal].name} guns · ${es.crew} crew · ${es.bounty} g bounty</div>
    <div class="hook">${es.hook}</div><button class="btn big" data-act="engage">Engage</button></div>`, 'clear low');
}
const acc = () => (G.stats.shots ? Math.round((G.stats.hits / G.stats.shots) * 100) : 0);
function showResult() {
  const e = G.enemy, p = G.player, es = e.spec, o = G.outcome;
  setMode(null);
  p.boardView = e.boardView = null;
  if (o === 'lost' || o === 'overrun') {
    G.state = 'over';
    return showScreen(`<div class="banner bad"><div class="eyebrow">${o === 'lost' ? 'Sunk by' : 'Boarded and taken by'} ${es.captain}</div><h1>${p.spec.name} lost</h1>
      <div class="rowc"><button class="btn big" data-act="retry">Fight again</button><button class="btn sm" data-act="restart">New voyage</button></div></div>`);
  }
  G.state = 'result';
  const cap = o === 'captured', gold = cap ? G.prize : es.bounty;
  G.gold += gold; G.earned += gold;
  let loot = '';
  if (cap) {
    const men = Math.max(0, Math.min(15, p.crewMax - Math.round(p.crew)));
    p.crew += men; p.stock.chain += 3; p.stock.grape += 3; p.stock.fire += 2;
    G.trophies.push(G.level);
    loot = `<div class="loot">She is yours to sail — take command of her in port</div><div class="loot">+3 chain · +3 grape · +2 heated${men ? ` · +${men} crew` : ''}</div>`;
  } else loot = `<div class="loot">${o === 'struck' ? 'A wreck, sold for the bounty.' : 'Gone to the bottom.'} Boarded, she would have paid up to ${es.bounty * 2} g and been yours to sail.</div>`;
  p.fire = 0; p.hull = Math.max(p.hull, p.hullMax * 0.35); p.sails = Math.max(p.sails, p.sailsMax * 0.5);
  sfx.coin();
  const last = G.level + 1 >= ENEMIES.length;
  showScreen(`<div class="banner"><div class="eyebrow">${es.captain} is finished</div><h1>${es.name} ${cap ? 'taken' : o === 'struck' ? 'wrecked' : 'sunk'}</h1>
    <div class="gold">+${gold} g</div>${loot}
    <div class="rowc"><button class="btn big" data-act="${last ? 'final' : 'port'}">${last ? 'Sail home' : 'Make port'}</button></div></div>`, 'clear');
}
function showFinal() {
  G.state = 'won'; sfx.horn(true);
  enterHarbor(); snapCamera();
  const s = G.stats, mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
  showScreen(`<div class="banner"><div class="eyebrow">The southern sea is quiet</div><h1>Pirate hunter</h1>
    <div class="stats"><div>Taken<b>${s.captured}</b></div><div>Sunk<b>${s.sunk}</b></div><div>Gold<b>${G.earned}</b></div><div>Accuracy<b>${acc()}%</b></div><div>In action<b>${mm}:${ss}</b></div></div>
    <div class="rowc"><button class="btn big" data-act="restart">Sail again</button></div></div>`, 'clear');
}

// ---------- Port Halcyon ----------
function enterHarbor() {
  harbor.group.visible = true;
  world.setEnv('harbor'); world.clearIslands(); world.wind.dir = world.wind.target = 2.2;
  clearBalls();
  if (G.enemy) { scene.remove(G.enemy.group); G.enemy = null; }
  moor();
  // every ship you own but are not sailing rides at anchor in the bay
  for (const t of G.trophyShips) scene.remove(t.group);
  G.trophyShips = ['wren', ...G.trophies].filter((id) => id !== G.ship).map((id, i) => {
    const t = new Ship(hullSpec(id), false), m = harbor.moorings[i % harbor.moorings.length];
    t.id = id; t.crew = 14; t.sailLevel = 0;
    t.pos.set(m[0], 0, m[1]); t.heading = m[2];
    scene.add(t.group);
    return t;
  });
}
const ROLE = { wren: 'Your old brig. Does everything fairly well.', 0: 'Darts and turns on a coin, and sails closer to the wind than anything afloat. Light guns with a wide sweep; a thin hull.', 1: 'A sound, balanced brig.', 2: 'Room for a huge crew: made for boarding. Light quick-firing guns, thin hull, points well to windward.', 3: 'Heavy guns that outreach everything smaller, slow to load. Ponderous at the helm, and short of hands.', 4: 'A fortress.' };
function takeCommand(id) {
  G.ship = id === 'wren' ? 'wren' : +id;
  buildPlayer(true); moor(); enterHarbor(); G.shop = null;
  buildSpots(); renderPort(); setupHudNames(); sfx.horn(true);
  toast(`You take command of the ${G.player.spec.name}`, 'big', 3000);
}
function buildSpots() {
  $('spots').innerHTML = harbor.spots.map((s) => `<button class="spot" data-spot="${s.id}">${s.name}<i></i></button>`).join('')
    + G.trophyShips.map((t) => `<button class="spot ship" data-spot="ship:${t.id}">${t.spec.name}</button>`).join('');
}
function showPort() {
  G.state = 'port'; G.focus = 'player'; G.shop = null; G.cam.yaw = 0;
  enterHarbor(); hideScreen(); setMode('port'); setupHudNames();
  buildSpots();
  renderPort();
}
const COST = (k) => REPAIR[k][1];
function renderPort() {
  const p = G.player, g = G.gold, nx = ENEMIES[G.level];
  setBars('p', p);
  $('purse').textContent = `${g} g`;
  $('nextLine').innerHTML = `Next: <b>${nx.captain}</b><br>${nx.cls} <i>${nx.name}</i>`;
  const need = { hull: p.hullMax - p.hull, sails: p.sailsMax - p.sails, crew: Math.round(p.crewMax - p.crew) };
  document.querySelectorAll('#spots .spot').forEach((el) => {
    const sh = SHOPS[el.dataset.spot] || {};
    el.classList.toggle('need', !!sh.repair && need[sh.repair] >= 1);
    el.classList.toggle('sel', G.shop === el.dataset.spot);
  });
  const box = $('shop');
  box.classList.toggle('hidden', !G.shop);
  if (!G.shop) return;
  if (G.shop.startsWith('ship:')) {
    // another ship of yours: compare her with the one you are sailing, bar for bar
    const id = G.shop.slice(5), h = hullSpec(id === 'wren' ? 'wren' : +id), cur = hullSpec(G.ship);
    const val = { hull: (x) => x.hull, guns: (x) => x.guns, reach: (x) => 250 * CAL[x.cal].range, rate: (x) => 60 / (x.reload * CAL[x.cal].reload), crew: (x) => x.crew, speed: (x) => x.speed, turn: (x) => x.turn };
    const row = (label, k, max, txt) => `<div class="cmp"><span>${label}</span><div class="t"><i style="width:${(val[k](h) / max) * 100}%"></i><u style="left:${(val[k](cur) / max) * 100}%"></u></div><b>${txt || ''}</b></div>`;
    box.innerHTML = `<h3>${h.name}<button class="x" data-act="closeshop">✕</button></h3><div class="role">${h.cls} · <b>${KITS[KIT_OF[id]].name}</b>. ${ROLE[id]}</div>
      ${row('Hull', 'hull', 660, h.hull)}${row('Guns', 'guns', 13, h.guns * 2)}${row('Reach', 'reach', 310, CAL[h.cal].name)}${row('Loading', 'rate', 14)}${row('Crew', 'crew', 210, h.crew)}${row('Speed', 'speed', 16)}${row('Helm', 'turn', 0.8)}
      <div class="role"><u class="mk"></u> marks the ${cur.name}. Fittings stay with each ship; your shot comes with you.</div>
      <div class="rowc" style="margin-top:8px"><button class="btn" data-act="cmd:${id}">Take command</button></div>`;
    return;
  }
  const sh = SHOPS[G.shop], rows = [];
  if (sh.repair) {
    const k = sh.repair, n = need[k], full = Math.ceil(n * COST(k));
    rows.push(`<div class="item"><div class="d">${REPAIR[k][0]}<small>${Math.floor(p[k])} / ${p[k + 'Max']}</small></div>
      <button class="btn sm" data-act="rep:${k}" ${n < 1 || g < COST(k) ? 'disabled' : ''}>${n < 1 ? 'Full' : g >= full ? full + ' g' : 'Spend ' + g + ' g'}</button></div>`);
  }
  for (const it of KITS[KIT_OF[G.ship]].items.filter((x) => x.at === G.shop)) {
    const lv = fitOf(G.ship)[it.id] || 0, c = kitCost(lv);
    rows.push(`<div class="item"><div class="d">${it.name} <span class="lv">${[0, 1].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><small>${it.desc}</small></div>
      <button class="btn sm" data-act="up:${it.id}" ${lv >= 2 || g < c ? 'disabled' : ''}>${lv >= 2 ? 'Fitted' : c + ' g'}</button></div>`);
  }
  if (!rows.length) rows.push(`<div class="role">Nothing here suits a ${KITS[KIT_OF[G.ship]].name.toLowerCase()} like the ${p.spec.name}.</div>`);
  for (const [k, n, c] of sh.ammo || []) {
    rows.push(`<div class="item"><svg viewBox="0 0 26 26">${ICON[k]}</svg><div class="d">${AMMO[k].long} ×${n}<small>Aboard: ${p.stock[k]}</small></div>
      <button class="btn sm" data-act="ammo:${k}:${n}:${c}" ${g < c ? 'disabled' : ''}>${c} g</button></div>`);
  }
  box.innerHTML = `<h3>${harbor.spots.find((s) => s.id === G.shop).name}<button class="x" data-act="closeshop">✕</button></h3>${rows.join('')}`;
}
function portAction(a) {
  const p = G.player, [kind, k, n, c] = a.split(':');
  if (kind === 'rep') {
    const max = p[k + 'Max'], amt = Math.min(max - p[k], G.gold / COST(k)), cost = Math.min(G.gold, Math.ceil(amt * COST(k)));
    p[k] = Math.min(max, p[k] + (k === 'crew' ? Math.floor(amt) : amt)); G.gold -= cost;
    if (max - p[k] < 0.5) p[k] = max;
  } else if (kind === 'ammo') { if (G.gold < +c) return; G.gold -= +c; p.stock[k] += +n; }
  else if (kind === 'up') { const f = fitOf(G.ship), cost = kitCost(f[k] || 0); if ((f[k] || 0) >= 2 || G.gold < cost) return; G.gold -= cost; f[k] = (f[k] || 0) + 1; buildPlayer(); moor(); setupHudNames(); }
  sfx.coin(); renderPort();
}
function updatePortUI() {
  const n = harbor.spots.length;
  document.querySelectorAll('#spots .spot').forEach((el, i) => {
    const t = G.trophyShips[i - n];
    const s = project(i < n ? harbor.spots[i].pos : _l.set(t.pos.x, t.model.mastH + 6, t.pos.z));
    el.style.transform = `translate(-50%,-100%) translate(${s.x}px,${s.y}px)`;
    el.style.display = s.behind ? 'none' : '';
  });
}

function restart(full) {
  G.paused = false;
  const p = G.player;
  if (full) {
    G.level = 0; G.gold = 0; G.earned = 0; G.fit = {}; G.stats = freshStats(); G.trophies = []; G.ship = 'wren';
    for (const t of G.trophyShips) scene.remove(t.group);
    G.trophyShips = [];
    scene.remove(p.group); G.player = null; buildPlayer();
  } else { const s = G.saved; p.hull = s.hull; p.sails = s.sails; p.crew = s.crew; p.stock = { ...s.stock }; }
  startIntro();
}
function act(a) {
  sfx.init(); sfx.ui();
  if (a === 'sail') startIntro();
  else if (a === 'engage') beginBattle();
  else if (a === 'port') { G.level++; showPort(); snapCamera(); }
  else if (a === 'final') showFinal();
  else if (a === 'restart') restart(true);
  else if (a === 'retry') restart(false);
  else if (a === 'resume') togglePause();
  else if (a === 'closeshop') { G.shop = null; renderPort(); }
  else if (a === 'skipcoach') endCoach();
  else if (a === 'hidecoach') { G.coachHide = 0; $('coach').classList.add('hidden'); }
  else if (a.startsWith('cmd:')) takeCommand(a.slice(4));
  else if (a.includes(':') && !a.startsWith('cmd:')) portAction(a);
}
function togglePause() {
  if (G.state !== 'battle' && G.state !== 'boarding' && !G.paused) return;
  G.paused = !G.paused;
  if (G.paused) showScreen(`<div class="banner"><h1>Paused</h1>${KEYS_HTML}<div class="rowc"><button class="btn big" data-act="resume">Resume</button><button class="btn sm" data-act="restart">Abandon voyage</button></div></div>`);
  else hideScreen();
}

// ---------- input ----------
const keys = {};
function tap(k) {
  const p = G.player;
  if (k === 'p' || k === 'escape') return togglePause();
  if (k === 'm') return toast(sfx.toggleMute() ? 'Sound off' : 'Sound on', '', 1200);
  if (G.paused) return;
  if ((k === ' ' || k === 'enter') && G.state === 'intro') return act('engage');
  if (G.state === 'boarding') {
    if (k === 'f' || k === ' ') boardSwivel();
    else if (k === 'x') cutGrapples();
    return;
  }
  if (k === 'v') { G.cam.mode = G.cam.mode === 'helm' ? 'combat' : 'helm'; G.cam.yaw = 0; return toast(G.cam.mode === 'helm' ? 'Camera: at the helm' : 'Camera: facing the enemy', '', 1400); }
  if (k === 'h') return $('help').classList.toggle('open');
  if (G.state !== 'battle') return;
  if (k === 'w' || k === 'arrowup' || k === 's' || k === 'arrowdown') {
    const lv = clamp(p.sailLevel + (k === 'w' || k === 'arrowup' ? 1 : -1), 0, TOP);
    if (lv !== p.sailLevel) { p.sailLevel = lv; sfx.creak(); floater(SAILS[lv].name + (lv === TOP ? ' — fast, unsteady guns' : lv === 0 ? '' : ' — steadier guns'), '', _m.set(p.pos.x, p.model.mastH + 6, p.pos.z)); }
  }
  else if (k === 'q') fire(p, 'port');
  else if (k === 'e') fire(p, 'stbd');
  else if (k === 'b') tryBoard();
  else if (k === ' ') {
    const sides = ['port', 'stbd'].filter((s) => inArc(p, s, G.enemy, 1.12));
    if (!sides.length) toastOnce('noarc', 1.5, 'She is not in either arc — bring her onto your beam', '', 1500);
    else if (!sides.some((s) => fire(p, s))) toastOnce('reload', 1.2, 'Still reloading', '', 900);
  } else if ('1234'.includes(k) && k.length === 1) selectAmmo(AMMO_KEYS[+k - 1]);
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys[k] = true; tap(k);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-ammo],[data-fire],[data-spot],[data-tapkey]');
  if (!t) return;
  const d = t.dataset;
  if (d.act) act(d.act);
  else if (d.ammo) selectAmmo(d.ammo);
  else if (d.fire) fire(G.player, d.fire);
  else if (d.spot) { G.shop = G.shop === d.spot ? null : d.spot; sfx.init(); sfx.ui(); renderPort(); }
  else if (d.tapkey) tap(d.tapkey);
});
document.querySelectorAll('.tb').forEach((b) => {
  const k = b.dataset.key, tp = b.dataset.tap;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); if (k) keys[k] = true; if (tp) tap(tp); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { b.classList.remove('on'); if (k) keys[k] = false; });
});
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  G.cam.yaw -= (e.clientX - drag.x) * 0.006; G.cam.pitch = clamp(G.cam.pitch + (e.clientY - drag.y) * 0.004, 0.06, 1.2);
  drag.x = e.clientX; drag.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => (drag = null));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); G.cam.dist = clamp(G.cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 35, 220); }, { passive: false });
canvas.addEventListener('dblclick', () => (G.cam.yaw = 0));

// ---------- main loop ----------
function update(dt) {
  G.t += dt;
  const st = G.state;
  if (st === 'battle') battleUpdate(dt);
  else if (st === 'boarding') boardingUpdate(dt);
  else if (st === 'ending') { if ((G.endT -= dt) <= 0) showResult(); }
  const p = G.player, e = G.enemy, now = G.state;
  const home = now === 'title' || now === 'port' || now === 'won';
  if (now === 'intro') { p.input.turn = 0.12; p.sailLevel = 2; if (e) { e.input.turn = -0.15; e.sailLevel = 2; } }
  if (now === 'ending' || now === 'result' || now === 'over') {
    p.input.turn = 0; if (e) e.input.turn = 0;
    if (G.outcome === 'captured' || G.outcome === 'overrun' || G.outcome === 'struck') { if (e) e.sailLevel = 0; p.sailLevel = 0; }
  }
  const frozen = now === 'boarding' || home;
  p.update(dt, world, frozen);
  if (home) for (const t of G.trophyShips) t.update(dt, world, true);
  if (e) {
    e.update(dt, world, frozen);
    if (now === 'battle' || now === 'ending') collide(p, e);
    collideIslands(e); shipEffects(e, dt); flushTally(e, dt);
  }
  if (!home) { collideIslands(p); shipEffects(p, dt); }
  flushTally(p, dt);
  updateBalls(dt);
  world.fast = !!G.fast;
  if (G.fast) { world.update(dt, camera.position); return; } // balance harness: rules only, nothing drawn
  fx.update(dt);
  updateCamera(dt);
  world.update(dt, camera.position);
  world.updateStreaks(dt, home ? harbor.focus : p.pos);
  if (e && (now === 'battle' || now === 'boarding' || now === 'ending')) updateHUD(dt);
  else { myArcs.grp.visible = herArcs.grp.visible = windRing.visible = boardRing.visible = false; }
  if (now === 'boarding') updateMelee();
  if (now === 'port') updatePortUI();
  updateFloaters(dt);
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!G.paused) update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
G.step = (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); renderer.render(scene, camera); };
G.newAI = newAI;
G.tick = (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); };
G.world = world;
G.api = { aiApi, cutGrapples, hullSpec, updateAI, reach, inArc, hasGauge, strength: (s) => strength(s), rebuild: () => { scene.remove(G.player.group); G.player = null; buildPlayer(true); }, fire, act, tap, keys, startBoarding, boardSwivel, endBattle, toast, showPort, prize };
showTitle();
snapCamera();
requestAnimationFrame(frame);
