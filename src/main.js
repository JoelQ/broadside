import * as THREE from 'three';
import { World } from './world.js';
import { FX, Sfx } from './fx.js';
import { Ship, AMMO, AMMO_KEYS, ARC, wrap, clamp, polar, pointOfSail } from './ship.js';
import { PLAYER_SPEC, ENEMIES, UPGRADES, upgradeCost } from './data.js';
import { updateAI, newAI } from './ai.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ~unit std
const GRAV = 22;

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 14000);
const world = new World(scene);
const fx = new FX(scene);
const sfx = new Sfx();
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  fx.setScale(renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
window.addEventListener('resize', resize);
resize();
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');

// ---------- game state ----------
const G = {
  state: 'title', level: 0, gold: 0, earned: 0, up: { hull: 0, guns: 0, sail: 0, drill: 0, rudder: 0, marines: 0 },
  player: null, enemy: null, ai: newAI(), balls: [], pending: [], paused: false,
  grapple: 0, boardCd: 0, endT: 0, outcome: null, bd: null, t: 0, shake: 0, focus: 'player',
  stats: { volleys: 0, shots: 0, hits: 0, sunk: 0, captured: 0, time: 0 },
  cam: { yaw: 0, pitch: 0.3, dist: 78, mode: 'chase', angle: 0, look: new THREE.Vector3(), pos: new THREE.Vector3(0, 30, -60) },
};
window.G = G;

function playerSpec() {
  const u = G.up;
  return { ...PLAYER_SPEC, guns: 7 + u.guns, hull: 300 + 60 * u.hull, sails: 100 + 20 * u.sail, speed: 14 * (1 + 0.07 * u.sail), turn: 0.62 * (1 + 0.1 * u.rudder), crew: 80 + 10 * u.marines };
}
function buildPlayer() {
  const old = G.player, p = new Ship(playerSpec(), true);
  p.reloadMult = 0.9 ** G.up.drill; p.melee = 1 + 0.18 * G.up.marines;
  if (old) {
    p.hull = old.hull + p.hullMax - old.hullMax; p.sails = old.sails + p.sailsMax - old.sailsMax; p.crew = old.crew + p.crewMax - old.crewMax;
    p.stock = old.stock; p.pos.copy(old.pos); p.heading = old.heading; p.speed = old.speed; p.sailLevel = old.sailLevel; p.input = old.input;
    scene.remove(old.group);
  }
  scene.add(p.group);
  G.player = p;
  if (G.enemy) { p.target = G.enemy; G.enemy.target = p; }
}
buildPlayer();
G.player.sailLevel = 1; G.player.speed = 6;

// ---------- broadside arc indicators ----------
const arcGroup = new THREE.Group();
const arcs = {};
for (const side of ['port', 'stbd']) {
  const g = new THREE.RingGeometry(0.07, 1, 28, 1, -ARC, ARC * 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
  if (side === 'stbd') m.rotation.y = Math.PI;
  m.renderOrder = 2;
  arcs[side] = m; arcGroup.add(m);
}
arcGroup.visible = false;
scene.add(arcGroup);

// ---------- toasts ----------
function toast(text, cls = '', ms = 2600) {
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, ms);
}
const said = {};
function toastOnce(key, gap, ...a) { if ((said[key] || -99) + gap > G.t) return; said[key] = G.t; toast(...a); }
const camVol = (p) => clamp(1 - camera.position.distanceTo(p) / 800, 0, 1) ** 2;

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
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), ironMat); m.add(bar);
  } else if (ammo === 'grape') {
    m = new THREE.Group();
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(ballGeo, ironMat); b.position.set(rand(-0.7, 0.7), rand(-0.5, 0.5), rand(-0.7, 0.7)); b.scale.setScalar(0.38); m.add(b); }
  } else m = new THREE.Mesh(ballGeo, ammo === 'fire' ? hotMat : ironMat);
  scene.add(m);
  return m;
}
function inArc(ship, side, tgt, slack = 1.1) {
  const dx = tgt.pos.x - ship.pos.x, dz = tgt.pos.z - ship.pos.z;
  const off = wrap(Math.atan2(dx, dz) - (ship.heading + (side === 'port' ? 1 : -1) * Math.PI / 2));
  return Math.abs(off) <= ARC && Math.hypot(dx, dz) <= AMMO[ship.ammo].range * slack;
}
function clearShot(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, l2 = dx * dx + dz * dz;
  for (const i of world.islands) {
    const t = clamp(((i.x - a.pos.x) * dx + (i.z - a.pos.z) * dz) / l2, 0, 1);
    if (Math.hypot(a.pos.x + dx * t - i.x, a.pos.z + dz * t - i.z) < i.r * 0.9) return false;
  }
  return true;
}
function fire(ship, side) {
  if (G.state !== 'battle' || ship.reload[side] > 0 || ship.sinking > 0 || ship.struck) return false;
  let ammo = ship.ammo;
  if (ammo !== 'round') { if (ship.stock[ammo] <= 0) ammo = ship.ammo = 'round'; else ship.stock[ammo]--; }
  const n = ship.model.muzzles[side].length;
  for (let i = 0; i < n; i++) G.pending.push({ t: i * 0.075 + Math.random() * 0.07, ship, side, i, ammo });
  ship.startReload(side);
  if (ammo !== 'round' && ship.stock[ammo] <= 0) {
    ship.ammo = 'round';
    if (ship.isPlayer) toast(`Out of ${AMMO[ammo].long.toLowerCase()} — loading round shot`);
  }
  if (ship.isPlayer) { G.stats.volleys++; G.shake = Math.max(G.shake, 0.5); }
  return true;
}
const _m = new THREE.Vector3(), _l = new THREE.Vector3();
function launch(p) {
  const { ship, side, ammo } = p, A = AMMO[ammo], sgn = side === 'port' ? 1 : -1;
  if (ship.sinking > 0) return;
  ship.toWorld(ship.model.muzzles[side][p.i], _m);
  const normal = ship.heading + sgn * Math.PI / 2;
  let aim = normal, dist = A.range * 0.75, h = -_m.y;
  const tgt = ship.target;
  if (tgt && tgt.sinking <= 0) {
    let tx = tgt.pos.x, tz = tgt.pos.z;
    const tt = Math.hypot(tx - _m.x, tz - _m.z) / (A.speed * 0.98);
    const along = (Math.random() - 0.5) * tgt.spec.L * 0.62;
    tx += tgt.fwdX * (tgt.speed * tt + along); tz += tgt.fwdZ * (tgt.speed * tt + along);
    const dx = tx - _m.x, dz = tz - _m.z, ang = Math.atan2(dx, dz), d = Math.hypot(dx, dz);
    if (Math.abs(wrap(ang - normal)) <= ARC + 0.06 && d <= A.range * 1.12) {
      aim = ang; dist = Math.min(d, A.range);
      h = (ammo === 'chain' ? tgt.model.mastH * 0.5 : tgt.spec.D * 0.45) + tgt.group.position.y - _m.y;
    }
  }
  const spread = ship.disp * (ammo === 'grape' ? 1.15 : 1) * (1.25 - 0.25 * ship.crewR);
  aim += gauss() * spread * 1.6;
  const v = A.speed * (1 + gauss() * 0.02), v2 = v * v;
  const disc = v2 * v2 - GRAV * (GRAV * dist * dist + 2 * h * v2);
  const el = (disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (GRAV * dist))) + gauss() * spread * 1.15;
  const ce = Math.cos(el);
  const mesh = ballMesh(ammo);
  mesh.position.copy(_m);
  G.balls.push({ mesh, ammo, owner: ship, rigged: false, spin: rand(8, 16), vel: new THREE.Vector3(Math.sin(aim) * ce * v, Math.sin(el) * v, Math.cos(aim) * ce * v) });
  fx.cannon(_m, Math.sin(normal), Math.cos(normal));
  sfx.cannon(0.25 + 0.75 * camVol(_m));
  if (ship.isPlayer) G.stats.shots++;
}

function hullHit(b, ship) {
  const A = AMMO[b.ammo], hv = Math.hypot(b.vel.x, b.vel.z) || 1;
  const d = (b.vel.x * ship.fwdX + b.vel.z * ship.fwdZ) / hv;
  let m = b.owner.dmgMult, rake = 0;
  if (Math.abs(d) > 0.78) { rake = d > 0 ? 1.8 : 1.5; m *= rake; }
  ship.hull -= A.hull * m;
  if (b.ammo !== 'chain') ship.sails -= A.sail * 0.4;
  let kills = 0;
  if (A.kills) kills = Math.round(rand(A.kills[0], A.kills[1]) * (rake ? 1.6 : 1) * b.owner.dmgMult);
  else if (Math.random() < A.crew * (rake ? 2.4 : 1)) kills = 1 + (rake && Math.random() < 0.5 ? 1 : 0);
  ship.crew = Math.max(0, ship.crew - kills);
  if (A.ignite && Math.random() < A.ignite) {
    if (ship.fire === 0) toast(ship.isPlayer ? 'Fire on deck!' : `${ship.spec.name} is ablaze!`, ship.isPlayer ? 'bad' : 'good');
    ship.fire = Math.min(3, ship.fire + 1); ship.fireT = 9;
  }
  const p = b.mesh.position;
  if (b.ammo === 'grape') fx.grape(p); else fx.wood(p, rake ? 16 : 10);
  sfx.thud(0.2 + 0.8 * camVol(p));
  if (rake) toastOnce(ship.isPlayer ? 'rakedP' : 'rakedE', 3, ship.isPlayer ? 'We are being raked!' : d > 0 ? 'Stern rake! Devastating!' : 'Raking fire across her bow!', ship.isPlayer ? 'bad' : 'good');
  if (b.owner.isPlayer) G.stats.hits++;
  if (ship.isPlayer) G.shake = Math.max(G.shake, 0.7);
}
function rigHit(b, ship, amt) {
  ship.sails = Math.max(0, ship.sails - amt * b.owner.dmgMult * (ship.sailLevel === 0 ? 0.35 : ship.sailLevel === 1 ? 0.75 : 1));
  fx.canvas(b.mesh.position, new THREE.Color(ship.spec.sailCol));
  sfx.rip(0.2 + 0.8 * camVol(b.mesh.position));
  if (b.owner.isPlayer) G.stats.hits++;
}
function testHit(b, ship) {
  ship.toLocal(b.mesh.position, _l);
  const sp = ship.spec, hl = sp.L / 2;
  if (Math.abs(_l.z) > hl || Math.abs(_l.x) > sp.B / 2 + 1.5) return false;
  const zf = _l.z / hl, hw = (sp.B / 2 + 0.3) * (zf > 0.2 ? 1 - ((zf - 0.2) / 0.8) * 0.7 : 1), deck = sp.D + 1.3;
  if (_l.y > -1.6 && _l.y <= deck && Math.abs(_l.x) <= hw) { hullHit(b, ship); return true; }
  if (_l.y > deck && _l.y < ship.model.mastH && Math.abs(_l.z) < hl * 0.82) {
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
    const nx = dx / d, nz = dz / d, rel = Math.hypot(a.fwdX * a.speed - b.fwdX * b.speed, a.fwdZ * a.speed - b.fwdZ * b.speed);
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
  if (!s) return;
  const sp = s.spec, y = s.group.position.y;
  if (s.fire > 0 && s.sinking <= 0) {
    s.hull -= 1.3 * s.fire * dt; s.sails = Math.max(0, s.sails - 0.5 * s.fire * dt);
    if (Math.random() < 0.13 * s.fire * dt) s.crew = Math.max(0, s.crew - 1);
    s.fireT -= dt * (0.5 + 0.9 * s.crewR);
    if (s.fireT <= 0) { s.fire--; s.fireT = 9; if (s.fire === 0 && s.isPlayer) toast('Fires are out', 'good'); }
    for (let i = 0; i < s.fire; i++) {
      const k = rand(-0.35, 0.35) * sp.L, w = rand(-0.3, 0.3) * sp.B;
      const p = s.toWorld(_l.set(w, sp.D + rand(0, 4), k), _m);
      fx.flame(p.x, p.y, p.z);
      if (Math.random() < 0.25) fx.smoke(p.x, p.y + 2, p.z, 0.12, Math.sin(world.wind.dir) * 3, Math.cos(world.wind.dir) * 3);
    }
  }
  s.fxT -= dt;
  if (s.fxT <= 0) {
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
    if (s.sinking > 0 && s.sinking < 7) { const p = _m.set(s.pos.x + rand(-6, 6), 0.3, s.pos.z + rand(-8, 8)); fx.splash(p, 0.4); }
  }
}

// ---------- battle flow ----------
function startIntro() {
  const es = ENEMIES[G.level];
  if (G.enemy) scene.remove(G.enemy.group);
  for (const b of G.balls) { b.mesh.visible = false; pools[b.ammo].push(b.mesh); }
  G.balls.length = 0; G.pending.length = 0;
  world.setEnv(es.env);
  world.setIslands(4242 + G.level * 97 + ((Math.random() * 1000) | 0), es.islands);
  world.wind.dir = world.wind.target = rand(0, Math.PI * 2);
  const e = (G.enemy = new Ship({ ...es, seedSign: Math.random() < 0.5 ? -1 : 1 }, false));
  scene.add(e.group);
  const p = G.player;
  p.pos.set(0, 0, 0); p.heading = wrap(world.wind.dir + Math.PI / 2); p.speed = 7; p.sailLevel = 2; p.input.turn = 0;
  p.reload.port = p.reload.stbd = 0; p.fire = 0; p.ammo = 'round';
  let a = p.heading + rand(-0.7, 0.7), tries = 0;
  do { e.pos.set(Math.sin(a) * 500, 0, Math.cos(a) * 500); a += 0.4; } while (tries++ < 16 && world.islands.some((i) => Math.hypot(i.x - e.pos.x, i.z - e.pos.z) < i.r + 60));
  e.heading = Math.atan2(-e.pos.x, -e.pos.z) + 0.5; e.speed = 6; e.sailLevel = 1;
  p.target = e; e.target = p;
  G.ai = newAI(); G.grapple = 0; G.boardCd = 0; G.outcome = null; G.bd = null;
  G.state = 'intro'; G.focus = 'enemy';
  showIntro(es);
}
function beginBattle() {
  G.state = 'battle'; G.focus = 'player'; G.cam.yaw = 0; G.battleT = 0;
  const e = G.enemy; e.sailLevel = 2; G.player.sailLevel = 2;
  hideScreen(); $('hud').classList.remove('hidden');
  buildAmmoBar(); setupHudNames();
  toast(`${e.spec.name} sighted!`, 'big', 3200);
  setTimeout(() => G.state === 'battle' && toast(ENEMIES[G.level].tip, '', 7000), 1800);
  sfx.horn(true);
}
function endBattle(outcome) {
  if (G.state === 'ending') return;
  G.outcome = outcome; G.state = 'ending';
  G.endT = outcome === 'captured' ? 3 : 6.5;
  G.pending.length = 0; $('boarding').classList.add('hidden'); $('boardBox').classList.add('hidden');
  const e = G.enemy, p = G.player;
  if (outcome === 'sunk') { e.sinking = Math.max(e.sinking, 0.01); toast(`${e.spec.name} is going down!`, 'big', 4000); sfx.horn(true); G.focus = 'enemy'; }
  else if (outcome === 'captured') { e.struck = true; e.fire = 0; toast(`${e.spec.name} strikes her colours!`, 'big', 4000); sfx.horn(true); G.focus = 'enemy'; }
  else { if (outcome === 'lost') p.sinking = Math.max(p.sinking, 0.01); toast(outcome === 'lost' ? 'We are sinking!' : 'The deck is lost!', 'bad', 4000); sfx.horn(false); }
}
function battleUpdate(dt) {
  const p = G.player, e = G.enemy;
  G.battleT += dt; G.stats.time += dt;
  if (G.auto) updateAI(G.auto, p, e, world, dt, { fire, clearShot });
  else p.input.turn = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0);
  updateAI(G.ai, e, p, world, dt, { fire, clearShot });
  // grappling
  G.boardCd -= dt;
  const dist = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
  const rel = Math.hypot(p.fwdX * p.speed - e.fwdX * e.speed, p.fwdZ * p.speed - e.fwdZ * e.speed);
  const can = dist < 33 && rel < 6.5 && G.boardCd <= 0;
  G.canBoard = can; G.nearBoard = dist < 60 && G.boardCd <= 0;
  G.grapple = clamp(G.grapple + (can && keys.b ? dt / 1.4 : -dt), 0, 1);
  G.ai.grapple = clamp(G.ai.grapple + (can && G.ai.wantBoard ? dt / 2.4 : -dt * 0.7), 0, 1);
  if (G.ai.grapple > 0.05 && G.ai.wantBoard) toastOnce('grap', 6, 'They are throwing grapples — break away!', 'bad');
  if (G.grapple >= 1) return startBoarding('player');
  if (G.ai.grapple >= 1) return startBoarding('enemy');
  // outcomes
  if (e.hull <= 0) { G.stats.sunk++; return endBattle('sunk'); }
  if (p.hull <= 0) return endBattle('lost');
  if (e.crew <= Math.max(3, e.crewMax * 0.1)) { G.stats.captured++; return endBattle('captured'); }
  if (p.crew <= 2) return endBattle('overrun');
}

// ---------- boarding ----------
const ORD = { charge: { beats: 'volley', name: 'Charge' }, volley: { beats: 'hold', name: 'Volley' }, hold: { beats: 'charge', name: 'Hold' } };
const HINTS = {
  charge: ['Their men mass at the rail, blades drawn and howling.', 'Boarding axes rise along their bulwark — they mean to rush you.'],
  volley: ['Musket barrels glint along their bulwark.', 'Their marksmen are climbing into the shrouds, priming pans.'],
  hold: ['They are dragging barrels and pikes into a barricade.', 'Their crew falls back behind a hedge of pikes.'],
};
function startBoarding(by) {
  const p = G.player, e = G.enemy;
  G.state = 'boarding'; G.pending.length = 0; G.grapple = 0; G.ai.grapple = 0;
  const side = wrap(Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - p.heading) > 0 ? 1 : -1;
  const off = p.spec.B / 2 + e.spec.B / 2 + 1.4;
  G.bd = { side, off, th: Math.abs(wrap(e.heading - p.heading)) < Math.PI / 2 ? 0 : Math.PI, round: 0, busy: false, by, fxT: 0, melee: 0 };
  G.focus = 'both';
  $('boarding').classList.remove('hidden'); $('boardBox').classList.add('hidden');
  $('bPN').textContent = p.spec.name; $('bEN').textContent = e.spec.name;
  $('bLog').textContent = by === 'player' ? 'Grapples away! Your boarders have the first rush.' : 'They have grappled us! Repel boarders!';
  toast(by === 'player' ? 'Boarders away!' : 'Repel boarders!', 'big');
  sfx.clang();
  nextRound();
}
function nextRound() {
  const b = G.bd, P = G.enemy.spec.ai;
  b.round++; b.busy = false;
  const w = P.boarder ? [0.5, 0.25, 0.25] : [0.3, 0.35, 0.35];
  const r = Math.random(), keys3 = ['charge', 'volley', 'hold'];
  b.pick = r < w[0] ? 'charge' : r < w[0] + w[1] ? 'volley' : 'hold';
  const shown = Math.random() < 0.72 ? b.pick : keys3.filter((k) => k !== b.pick)[(Math.random() * 2) | 0];
  $('bHint').textContent = '“' + HINTS[shown][(Math.random() * 2) | 0] + '”';
  refreshBoarding();
}
function refreshBoarding() {
  const p = G.player, e = G.enemy;
  $('bPC').textContent = Math.round(p.crew); $('bEC').textContent = Math.round(e.crew);
  $('bPB').style.width = p.crewR * 100 + '%'; $('bEB').style.width = e.crewR * 100 + '%';
  document.querySelectorAll('#boarding .btn').forEach((x) => (x.disabled = G.bd.busy));
}
function boardOrder(o) {
  const b = G.bd, p = G.player, e = G.enemy;
  if (!b || b.busy || G.state !== 'boarding') return;
  b.busy = true; b.melee = 1.3;
  const res = ORD[o].beats === b.pick ? 1 : ORD[b.pick].beats === o ? -1 : 0;
  const first = b.round === 1 ? (b.by === 'player' ? 1.25 : 0.8) : 1;
  const pStr = p.crew * p.melee * first, eStr = e.crew * e.melee / first;
  const pLoss = Math.max(1, Math.round(eStr * 0.11 * (res > 0 ? 0.5 : res < 0 ? 1.55 : 1) * rand(0.8, 1.2)));
  const eLoss = Math.max(1, Math.round(pStr * 0.11 * (res > 0 ? 1.55 : res < 0 ? 0.5 : 1) * rand(0.8, 1.2)));
  p.crew = Math.max(0, p.crew - pLoss); e.crew = Math.max(0, e.crew - eLoss);
  const head = res > 0 ? `Your ${ORD[o].name.toLowerCase()} breaks their ${ORD[b.pick].name.toLowerCase()}!` : res < 0 ? `Their ${ORD[b.pick].name.toLowerCase()} cuts through your ${ORD[o].name.toLowerCase()}!` : `${ORD[o].name} meets ${ORD[b.pick].name.toLowerCase()} — a bloody stalemate.`;
  $('bLog').textContent = `${head}  You lose ${pLoss}, they lose ${eLoss}.`;
  $('bHint').textContent = '';
  refreshBoarding();
  setTimeout(() => {
    if (G.state !== 'boarding') return;
    if (e.crew <= Math.max(4, e.crewMax * 0.12)) { G.stats.captured++; return endBattle('captured'); }
    if (p.crew <= Math.max(4, p.crewMax * 0.12)) return endBattle('overrun');
    nextRound();
  }, 1500);
}
function cutGrapples() {
  const b = G.bd, p = G.player, e = G.enemy;
  if (!b || b.busy || G.state !== 'boarding') return;
  p.crew = Math.max(3, p.crew - Math.ceil(p.crew * 0.08));
  G.state = 'battle'; G.focus = 'player'; G.boardCd = 9; p.speed = 5; e.speed = 1;
  p.reload.port = Math.max(p.reload.port, 2); p.reload.stbd = Math.max(p.reload.stbd, 2);
  $('boarding').classList.add('hidden');
  toast('Grapples cut — make sail!', '');
}
function boardingUpdate(dt) {
  const b = G.bd, p = G.player, e = G.enemy;
  const tx = p.pos.x + Math.cos(p.heading) * b.side * b.off, tz = p.pos.z - Math.sin(p.heading) * b.side * b.off;
  const k = Math.min(1, dt * 1.5);
  e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k;
  e.heading = wrap(e.heading + wrap(p.heading + b.th - e.heading) * k);
  if (b.melee > 0) {
    b.melee -= dt; b.fxT -= dt;
    if (b.fxT <= 0) {
      b.fxT = 0.09;
      const who = Math.random() < 0.5 ? p : e, q = who.toWorld(_l.set(rand(-0.4, 0.4) * who.spec.B, who.spec.D + 1.5, rand(-0.35, 0.35) * who.spec.L), _m);
      fx.musket(q.x, q.y, q.z);
      Math.random() < 0.5 ? sfx.musket() : sfx.clang();
    }
  }
}

// ---------- camera ----------
function updateCamera(dt) {
  const c = G.cam, p = G.player, e = G.enemy;
  let center = _m.set(p.pos.x, 7, p.pos.z), want, dist = c.dist, pitch = c.pitch;
  if (G.focus === 'enemy' && e) {
    center.set(e.pos.x, G.state === 'intro' ? -4 - e.spec.L * 0.25 : 8, e.pos.z); want = G.t * 0.12 + c.yaw; dist = 52 + e.spec.L * 1.3; pitch = G.state === 'intro' ? 0.1 : 0.22;
  } else if (G.focus === 'both' && e) {
    center.set((p.pos.x + e.pos.x) / 2, 7, (p.pos.z + e.pos.z) / 2); want = G.t * 0.08 + c.yaw; dist = 62; pitch = 0.42;
  } else if (G.state === 'title' || G.state === 'port') {
    want = G.t * 0.07 + 2.5 + c.yaw; dist = 64; pitch = 0.2;
  } else if (c.mode === 'target' && e) {
    want = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z) + c.yaw;
  } else want = p.heading + Math.PI + c.yaw;
  if (camera.aspect < 1) dist *= 1.55;
  c.angle += wrap(want - c.angle) * Math.min(1, dt * (G.state === 'battle' ? 3.2 : 1.5));
  const cp = Math.cos(pitch);
  const tx = center.x + Math.sin(c.angle) * cp * dist, tz = center.z + Math.cos(c.angle) * cp * dist;
  let ty = center.y + Math.sin(pitch) * dist;
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
}

// ---------- HUD ----------
const ICON = {
  round: '<circle cx="13" cy="13" r="8" fill="#222" stroke="#999"/>',
  chain: '<circle cx="6" cy="18" r="5" fill="#222" stroke="#999"/><circle cx="20" cy="8" r="5" fill="#222" stroke="#999"/><path d="M9 15l8-5" stroke="#bbb" stroke-width="2" stroke-dasharray="2 1.5"/>',
  grape: '<g fill="#222" stroke="#999"><circle cx="9" cy="9" r="4"/><circle cx="17" cy="9" r="4"/><circle cx="13" cy="16" r="4"/><circle cx="6" cy="18" r="3"/><circle cx="20" cy="18" r="3"/></g>',
  fire: '<circle cx="13" cy="15" r="7" fill="#e2571c" stroke="#ffb35a"/><path d="M13 1c3 4-2 5 1 9-4-1-5-5-1-9z" fill="#ffb35a"/>',
};
function buildAmmoBar() {
  $('ammo').innerHTML = AMMO_KEYS.map((k, i) => `<div class="slot" data-ammo="${k}"><kbd>${i + 1}</kbd><svg viewBox="0 0 26 26">${ICON[k]}</svg><div class="n">${AMMO[k].name}</div><div class="c"></div></div>`).join('');
}
function setupHudNames() {
  const p = G.player, e = G.enemy;
  $('pName').textContent = p.spec.name; $('pSub').textContent = `${p.spec.cls} · ${p.spec.guns * 2} guns`;
  $('eName').textContent = e.spec.name; $('eSub').textContent = `${e.spec.captain} · ${e.spec.cls}`;
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
function updateHUD(dt) {
  const p = G.player, e = G.enemy;
  const battle = G.state === 'battle';
  $('hud').classList.toggle('melee', G.state === 'boarding');
  arcGroup.visible = battle;
  if (battle) {
    arcGroup.position.set(p.pos.x, 1.3, p.pos.z); arcGroup.rotation.y = p.heading;
    arcGroup.scale.setScalar(AMMO[p.ammo].range);
  }
  for (const side of ['port', 'stbd']) {
    const ready = p.reload[side] <= 0, bear = battle && inArc(p, side, e, 1.05), el = $(side === 'port' ? 'bPort' : 'bStbd');
    const m = arcs[side].material;
    m.color.set(ready ? (bear ? 0xffd45a : 0xffffff) : 0xff6a5a); m.opacity = ready ? (bear ? 0.26 + 0.06 * Math.sin(G.t * 8) : 0.09) : 0.045;
    el.classList.toggle('ready', ready); el.classList.toggle('bear', ready && bear);
    el.querySelector('i').style.width = (ready ? 100 : (1 - p.reload[side] / p.reloadMax[side]) * 100) + '%';
    el.querySelector('.s').textContent = ready ? (bear ? 'BEARING — FIRE!' : 'Ready') : p.reload[side].toFixed(1) + 's';
  }
  if (G.tipT > 0 && (G.tipT -= dt) <= 0) $('ammoTip').textContent = '';
  if (++hudTick % 4) return;
  setBars('p', p); setBars('e', e);
  const st = (s) => [s.fire > 0 ? '🔥 On fire' : '', s.hullR < 0.3 ? 'Taking on water' : '', s.sailR < 0.3 ? 'Rigging in tatters' : ''].filter(Boolean).join(' · ');
  $('pStatus').textContent = st(p);
  const dist = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
  $('eStatus').textContent = [`${Math.round(dist)} yds`, AMMO[e.ammo].long, st(e)].filter(Boolean).join(' · ');
  document.querySelectorAll('#ammo .slot').forEach((el) => {
    const k = el.dataset.ammo;
    el.classList.toggle('sel', k === p.ammo); el.classList.toggle('out', k !== 'round' && p.stock[k] <= 0);
    el.querySelector('.c').textContent = k === 'round' ? '∞' : '×' + p.stock[k];
  });
  const off = wrap(p.heading - world.wind.dir);
  $('knots').textContent = (p.speed * 0.9).toFixed(1);
  $('sailName').textContent = ['Sails furled', 'Battle sails', 'Full sail'][p.sailLevel];
  $('pips').children[0].className = p.sailLevel > 0 ? 'on' : ''; $('pips').children[1].className = p.sailLevel > 1 ? 'on' : '';
  $('pos').textContent = pointOfSail(off); $('eff').textContent = `Wind ${Math.round(polar(off) * 100)}%`;
  // boarding prompt
  const bb = $('boardBox'), warn = G.ai.grapple > 0.02 && G.ai.wantBoard;
  const show = battle && (G.nearBoard || warn);
  bb.classList.toggle('hidden', !show); $('help').classList.toggle('hidden', show);
  if (show) {
    bb.classList.toggle('warn', warn && G.grapple <= 0);
    const rel = Math.hypot(p.fwdX * p.speed - e.fwdX * e.speed, p.fwdZ * p.speed - e.fwdZ * e.speed);
    bb.querySelector('.h').textContent = warn && G.grapple <= 0 ? 'They are grappling!' : G.canBoard ? 'Hold [B] to grapple' : 'Boarding range near';
    bb.querySelector('.t').textContent = warn && G.grapple <= 0 ? 'Make sail and pull clear' : G.canBoard ? `Crew ${Math.round(p.crew)} vs ${Math.round(e.crew)}` : dist >= 33 ? 'Come alongside…' : rel >= 6.5 ? 'Match her speed…' : '';
    bb.querySelector('i').style.width = Math.max(G.grapple, warn ? G.ai.grapple : 0) * 100 + '%';
  }
  drawRadar(p, e);
}
function drawRadar(p, e) {
  const x = rctx, S = 300, c = S / 2, R = 138, range = 520, k = R / range;
  x.clearRect(0, 0, S, S);
  x.save(); x.translate(c, c);
  x.fillStyle = 'rgba(12,34,52,.85)'; x.beginPath(); x.arc(0, 0, R, 0, 7); x.fill();
  x.save(); x.beginPath(); x.arc(0, 0, R, 0, 7); x.clip();
  const pt = (wx, wz) => { const dx = wx - p.pos.x, dz = wz - p.pos.z, s = Math.sin(p.heading), co = Math.cos(p.heading); return [-(dx * co - dz * s) * k, -(dx * s + dz * co) * k]; };
  // no-go zone (dead upwind)
  const up = wrap(world.wind.dir + Math.PI - p.heading), sa = -Math.PI / 2 - up;
  x.fillStyle = 'rgba(220,80,60,.16)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, sa - 0.56, sa + 0.56); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 1.5;
  for (const r of [0.33, 0.66]) { x.beginPath(); x.arc(0, 0, R * r, 0, 7); x.stroke(); }
  x.fillStyle = '#8c8266';
  for (const i of world.islands) { const [ix, iy] = pt(i.x, i.z); x.beginPath(); x.arc(ix, iy, i.r * k * 1.1, 0, 7); x.fill(); }
  // broadside arcs
  const ar = AMMO[p.ammo].range * k;
  for (const [side, a0] of [['port', Math.PI], ['stbd', 0]]) {
    const ready = p.reload[side] <= 0;
    x.fillStyle = ready ? 'rgba(255,214,110,.22)' : 'rgba(255,110,90,.1)';
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, ar, a0 - ARC, a0 + ARC); x.fill();
  }
  // enemy
  if (e && e.sinking < 6) {
    let [ex, ey] = pt(e.pos.x, e.pos.z);
    const d = Math.hypot(ex, ey);
    if (d > R - 8) { ex *= (R - 8) / d; ey *= (R - 8) / d; }
    x.save(); x.translate(ex, ey); x.rotate(-(e.heading - p.heading));
    x.fillStyle = '#ff5b4a'; x.beginPath(); x.moveTo(0, -11); x.lineTo(6, 8); x.lineTo(-6, 8); x.fill();
    const ea = AMMO[e.ammo].range * k;
    if (d <= R - 8) { x.fillStyle = 'rgba(255,90,70,.13)'; for (const a0 of [Math.PI, 0]) { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, ea, a0 - ARC, a0 + ARC); x.fill(); } }
    x.restore();
  }
  x.restore();
  // player
  x.fillStyle = '#f3ead2'; x.beginPath(); x.moveTo(0, -13); x.lineTo(7, 10); x.lineTo(0, 6); x.lineTo(-7, 10); x.fill();
  x.strokeStyle = 'rgba(201,162,74,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
  // wind arrow on the rim, pointing the way the wind blows
  const wr = wrap(world.wind.dir - p.heading);
  x.rotate(-wr);
  x.fillStyle = '#8fd0ff'; x.beginPath(); x.moveTo(0, R - 30); x.lineTo(9, R - 6); x.lineTo(0, R - 12); x.lineTo(-9, R - 6); x.fill();
  x.fillRect(-1.5, R - 12, 3, 12);
  x.restore();
}

// ---------- screens ----------
function showScreen(html, clear) { const s = $('screen'); s.innerHTML = html; s.classList.remove('hidden'); s.classList.toggle('clear', !!clear); s.scrollTop = 0; }
function hideScreen() { $('screen').classList.add('hidden'); }
const KEYS_HTML = `<div class="keys">
  <div><kbd>A</kbd><kbd>D</kbd> Rudder (port / starboard)</div><div><kbd>W</kbd><kbd>S</kbd> Make / shorten sail</div>
  <div><kbd>Q</kbd><kbd>E</kbd> Fire port / starboard battery</div><div><kbd>Space</kbd> Fire whichever side bears</div>
  <div><kbd>1</kbd>–<kbd>4</kbd> Round · Chain · Grape · Heated</div><div><kbd>B</kbd> Hold alongside to grapple &amp; board</div>
  <div><kbd>V</kbd> Chase / enemy-lock camera</div><div>Drag &amp; wheel to look · <kbd>P</kbd> pause · <kbd>M</kbd> mute</div></div>`;
function showTitle() {
  G.state = 'title';
  showScreen(`<div id="titleWrap"><h1>Broadside</h1><div class="tag">Five pirate captains. One brig-of-war. Hunt them down.</div>
    <button class="btn" data-act="start">Weigh anchor</button>
    <div class="hint">Your guns only fire from the sides — and so do theirs. Mind the wind.</div></div>`, true);
}
function showBriefing() {
  showScreen(`<div class="card wide"><div class="eyebrow">Letters of marque</div><h2>How to fight a ship</h2>
    <p><b>Guns fire from your sides only.</b> Steer so the enemy sits inside a glowing broadside arc while you stay out of theirs. Shot that travels the length of a hull — across the <b>bow or stern</b> — <b>rakes</b> it for up to 1.8× damage.</p>
    <p><b>The wind is your engine.</b> You cannot sail into the red wedge on the dial. Full sail is fast; battle sails turn tighter and protect your canvas.</p>
    <p><b>Choose your shot.</b> <i>Round</i> breaks hulls at range. <i>Chain</i> shreds sails so she cannot run. <i>Grape</i> clears her deck up close. <i>Heated</i> shot starts fires. Switching takes time to reload.</p>
    <p><b>Board for the big prize.</b> Cripple her, come alongside at matching speed, and hold <kbd style="background:#3a2412;color:#ead9b0">B</kbd>. A captured ship pays nearly double a sunk one — if your crew wins the deck.</p>
    <hr>${KEYS_HTML}
    <div class="row end"><button class="btn" data-act="intro">To sea</button></div></div>`);
}
function showIntro(es) {
  $('hud').classList.add('hidden');
  showScreen(`<div class="card" style="margin-top:auto;margin-bottom:4vh"><div class="eyebrow">Wanted · bounty ${G.level + 1} of ${ENEMIES.length}</div>
    <h2>${es.captain}</h2><p style="margin-top:0"><i>${es.cls} “${es.name}”</i></p>
    <p>${es.blurb}</p>
    <div class="stats"><div class="stat">Hull<b>${es.hull}</b></div><div class="stat">Crew<b>${es.crew}</b></div><div class="stat">Guns<b>${es.guns * 2}</b></div><div class="stat">Bounty<b class="gold">${es.bounty} g</b></div></div>
    <p class="tip">${es.tip}</p>
    <div class="row end"><button class="btn red" data-act="engage">Beat to quarters</button></div></div>`, true);
}
function showResult() {
  const e = G.enemy, p = G.player, es = e.spec, o = G.outcome;
  $('hud').classList.add('hidden');
  if (o === 'lost' || o === 'overrun') {
    G.state = 'over';
    return showScreen(`<div class="card"><div class="eyebrow">Lost at sea</div><h1>${o === 'lost' ? 'The Sea Wren is sunk' : 'Your deck is taken'}</h1>
      <p>${o === 'lost' ? `${es.captain} watches your topmasts slide beneath the swell.` : `${es.captain}'s crew swarms the quarterdeck. Your colours come down.`}</p>
      <div class="stats"><div class="stat">Pirates beaten<b>${G.level}</b></div><div class="stat">Gold earned<b>${G.earned}</b></div><div class="stat">Accuracy<b>${acc()}%</b></div></div>
      <div class="row end"><button class="btn sm" data-act="restart">Start over</button><button class="btn" data-act="retry">Fight ${es.name} again</button></div></div>`);
  }
  G.state = 'result';
  const cap = o === 'captured', gold = Math.round(es.bounty * (cap ? 1.8 : 1));
  G.gold += gold; G.earned += gold;
  let loot = '';
  if (cap) {
    const men = Math.min(15, p.crewMax - Math.round(p.crew));
    p.crew += Math.max(0, men); p.stock.chain += 3; p.stock.grape += 3; p.stock.fire += 2;
    loot = `<p>From her hold: <b>+3 chain, +3 grape, +2 heated shot</b>${men > 0 ? `, and <b>${men} hands</b> sign your articles` : ''}.</p>`;
  }
  p.fire = 0; p.hull = Math.max(p.hull, p.hullMax * 0.35); p.sails = Math.max(p.sails, p.sailsMax * 0.5);
  sfx.coin();
  showScreen(`<div class="card"><div class="eyebrow">Victory</div><h1>${es.name} ${cap ? 'captured' : 'sunk'}</h1>
    <p>${cap ? `${es.captain} hands over a sword, hilt first. A prize crew takes her to port.` : `${es.captain} goes down with the ship. The bounty is yours, though the cargo is not.`}</p>
    <div class="stats"><div class="stat">${cap ? 'Prize money' : 'Bounty'}<b class="gold">+${gold} g</b></div><div class="stat">Hull left<b>${Math.round(p.hullR * 100)}%</b></div><div class="stat">Crew left<b>${Math.round(p.crew)}</b></div><div class="stat">Accuracy<b>${acc()}%</b></div></div>
    ${loot}${cap ? '' : '<p class="tip">A captured ship pays 1.8× the bounty. Next time, try chain and grape, then board.</p>'}
    <div class="row end"><button class="btn" data-act="${G.level + 1 >= ENEMIES.length ? 'final' : 'port'}">${G.level + 1 >= ENEMIES.length ? 'Sail home' : 'Make port'}</button></div></div>`);
}
const acc = () => (G.stats.shots ? Math.round((G.stats.hits / G.stats.shots) * 100) : 0);
const COST = { hull: 0.6, sails: 0.5, crew: 3 };
function showPort() {
  G.state = 'port'; G.focus = 'player';
  if (G.enemy) { scene.remove(G.enemy.group); }
  const p = G.player, g = G.gold;
  const need = { hull: Math.ceil(p.hullMax - p.hull), sails: Math.ceil(p.sailsMax - p.sails), crew: Math.round(p.crewMax - p.crew) };
  const rep = (k, label) => {
    const full = Math.ceil(need[k] * COST[k]);
    return `<div class="item"><div class="d">${label}<small>${k === 'crew' ? Math.round(p.crew) : Math.floor(p[k])} / ${p[k + 'Max']}</small></div>
      <button class="btn sm" data-act="rep:${k}" ${need[k] <= 0 || g < COST[k] ? 'disabled' : ''}>${need[k] <= 0 ? 'Full' : g >= full ? full + ' g' : 'Spend ' + g + ' g'}</button></div>`;
  };
  const am = (k, n, c) => `<div class="item"><div class="d">${AMMO[k].long} ×${n}<small>In the locker: ${p.stock[k]}</small></div><button class="btn sm" data-act="ammo:${k}:${n}:${c}" ${g < c ? 'disabled' : ''}>${c} g</button></div>`;
  const ups = UPGRADES.map((u) => {
    const lv = G.up[u.id], c = lv < u.max ? upgradeCost(lv) : 0;
    return `<div class="item"><div class="d">${u.name} <span class="lv">${[0, 1, 2].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><small>${u.desc}</small></div>
      <button class="btn sm" data-act="up:${u.id}" ${lv >= u.max || g < c ? 'disabled' : ''}>${lv >= u.max ? 'Max' : c + ' g'}</button></div>`;
  }).join('');
  const nx = ENEMIES[G.level];
  showScreen(`<div class="card wide"><div class="row"><div class="grow"><div class="eyebrow">Port Halcyon</div><h2>Shipyard &amp; chandlery</h2></div><div style="text-align:right"><div class="eyebrow">Purse</div><h2 class="gold">${g} g</h2></div></div>
    <h4>Refit</h4><div class="shop">${rep('hull', 'Repair hull')}${rep('sails', 'Mend sails')}${rep('crew', 'Recruit crew')}</div>
    <h4>Powder &amp; shot</h4><div class="shop">${am('chain', 3, 25)}${am('grape', 3, 25)}${am('fire', 2, 35)}</div>
    <h4>Improvements</h4><div class="shop">${ups}</div>
    <div class="row end"><span class="grow" style="font-style:italic">Next: ${nx.captain} — ${nx.cls} “${nx.name}”</span><button class="btn red" data-act="intro">Put to sea</button></div></div>`);
}
function portAction(a) {
  const p = G.player, [kind, k, n, c] = a.split(':');
  if (kind === 'rep') {
    const key = k === 'crew' ? 'crew' : k, max = p[key + 'Max'], missing = max - p[key];
    const amt = Math.min(missing, G.gold / COST[k]), cost = Math.min(G.gold, Math.ceil(amt * COST[k]));
    p[key] = Math.min(max, p[key] + (k === 'crew' ? Math.floor(amt) : amt)); G.gold -= cost;
    if (max - p[key] < 0.5) p[key] = max;
  } else if (kind === 'ammo') { if (G.gold < +c) return; G.gold -= +c; p.stock[k] += +n; }
  else if (kind === 'up') { const cost = upgradeCost(G.up[k]); if (G.gold < cost) return; G.gold -= cost; G.up[k]++; buildPlayer(); }
  sfx.coin(); showPort();
}
function showFinal() {
  G.state = 'won'; sfx.horn(true);
  const s = G.stats, mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
  showScreen(`<div class="card"><div class="eyebrow">The southern sea is quiet</div><h1>Pirate hunter</h1>
    <p>Korrigan's black galleon is gone, and with it the last of the five. Harbour bells ring from Port Halcyon to the cape. They will be telling this one for years.</p>
    <div class="stats"><div class="stat">Captured<b>${s.captured}</b></div><div class="stat">Sunk<b>${s.sunk}</b></div><div class="stat">Gold earned<b class="gold">${G.earned}</b></div><div class="stat">Accuracy<b>${acc()}%</b></div><div class="stat">Broadsides<b>${s.volleys}</b></div><div class="stat">Time in action<b>${mm}:${ss}</b></div></div>
    <div class="row end"><button class="btn" data-act="restart">Sail again</button></div></div>`);
}
function restart(full) {
  if (full) {
    G.level = 0; G.gold = 0; G.earned = 0; G.up = { hull: 0, guns: 0, sail: 0, drill: 0, rudder: 0, marines: 0 };
    G.stats = { volleys: 0, shots: 0, hits: 0, sunk: 0, captured: 0, time: 0 };
    scene.remove(G.player.group); G.player = null; buildPlayer();
  } else {
    const p = G.player, s = G.saved;
    p.hull = s.hull; p.sails = s.sails; p.crew = s.crew; p.stock = { ...s.stock };
  }
  G.player.sinking = 0; G.player.struck = false; G.player.fire = 0;
  startIntro();
}
function act(a) {
  sfx.init(); sfx.ui();
  if (a === 'start') showBriefing();
  else if (a === 'intro') { if (G.state === 'port') G.level = G.level; startIntro(); }
  else if (a === 'engage') { const p = G.player; G.saved = { hull: p.hull, sails: p.sails, crew: p.crew, stock: { ...p.stock } }; beginBattle(); }
  else if (a === 'port') { G.level++; showPort(); }
  else if (a === 'final') showFinal();
  else if (a === 'restart') { G.paused = false; restart(true); }
  else if (a === 'retry') restart(false);
  else if (a === 'resume') togglePause();
  else if (a.includes(':')) portAction(a);
}
function togglePause() {
  if (G.state !== 'battle' && !G.paused) return;
  G.paused = !G.paused;
  if (G.paused) showScreen(`<div class="card"><div class="eyebrow">Hove to</div><h2>Paused</h2>${KEYS_HTML}<div class="row end"><button class="btn sm" data-act="restart">Abandon voyage</button><button class="btn" data-act="resume">Resume</button></div></div>`);
  else hideScreen();
}

// ---------- input ----------
const keys = {};
function tap(k) {
  const p = G.player;
  if (k === 'p' || k === 'escape') return togglePause();
  if (k === 'm') return toast(sfx.toggleMute() ? 'Sound off' : 'Sound on', '', 1200);
  if (G.paused) return;
  if (k === 'v') { G.cam.mode = G.cam.mode === 'chase' ? 'target' : 'chase'; G.cam.yaw = 0; return toast(G.cam.mode === 'chase' ? 'Chase camera' : 'Enemy-lock camera', '', 1200); }
  if (G.state !== 'battle') return;
  if (k === 'w' || k === 'arrowup') { if (p.sailLevel < 2) { p.sailLevel++; sfx.creak(); } }
  else if (k === 's' || k === 'arrowdown') { if (p.sailLevel > 0) { p.sailLevel--; sfx.creak(); } }
  else if (k === 'q') fire(p, 'port');
  else if (k === 'e') fire(p, 'stbd');
  else if (k === ' ') {
    const sides = ['port', 'stbd'].filter((s) => inArc(p, s, G.enemy, 1.12));
    if (!sides.length) toastOnce('noarc', 1.5, 'No target in either arc — bring her onto your beam', '', 1500);
    else if (!sides.some((s) => fire(p, s))) toastOnce('reload', 1.2, 'Still reloading!', '', 900);
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
  const t = e.target.closest('[data-act],[data-o],[data-ammo],[data-fire],#bCut');
  if (!t) return;
  if (t.dataset.act) act(t.dataset.act);
  else if (t.dataset.o) boardOrder(t.dataset.o);
  else if (t.dataset.ammo) selectAmmo(t.dataset.ammo);
  else if (t.dataset.fire) fire(G.player, t.dataset.fire);
  else if (t.id === 'bCut') cutGrapples();
});
document.querySelectorAll('.tb').forEach((b) => {
  const k = b.dataset.key, tp = b.dataset.tap;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); if (k) keys[k] = true; if (tp) tap(tp); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { b.classList.remove('on'); if (k) keys[k] = false; });
});
const bb = $('boardBox');
bb.addEventListener('pointerdown', () => (keys.b = true));
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bb.addEventListener(ev, () => (keys.b = false));
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
  const p = G.player, e = G.enemy, st = G.state;
  if (st === 'battle') battleUpdate(dt);
  else if (st === 'boarding') boardingUpdate(dt);
  else if (st === 'ending') { if ((G.endT -= dt) <= 0) showResult(); }
  if (st === 'title' || st === 'port' || st === 'intro' || st === 'won') { p.input.turn = 0.12; p.sailLevel = 1; }
  if (st === 'intro' && e) { e.input.turn = -0.15; e.sailLevel = 1; }
  if (st === 'ending' || st === 'result' || st === 'over') { p.input.turn = 0; if (e) e.input.turn = 0; if (G.outcome !== 'sunk' && e && G.outcome !== 'lost') { e.sailLevel = 0; p.sailLevel = 0; } }
  const frozen = G.state === 'boarding';
  p.update(dt, world, frozen);
  if (e && e.group.parent) {
    e.update(dt, world, frozen);
    if (G.state === 'battle' || G.state === 'ending') collide(p, e);
    collideIslands(e); shipEffects(e, dt);
  }
  collideIslands(p); shipEffects(p, dt);
  updateBalls(dt);
  fx.update(dt);
  updateCamera(dt);
  world.update(dt, camera.position);
  if (G.state === 'battle' || G.state === 'boarding' || G.state === 'ending') updateHUD(dt); else arcGroup.visible = false;
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
G.api = { fire, act, tap, keys, startBoarding, boardOrder, endBattle, toast };
showTitle();
requestAnimationFrame(frame);
