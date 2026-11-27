import * as THREE from 'three';
import { WorldView } from './world.js';
import { FX, Sfx } from './fx.js';
import { ShipView } from './shipview.js';
import { AMMO, AMMO_KEYS, CAL, SAILS, TOP, noGoHalf, wrap, clamp, pointOfSail } from './ship.js';
import { ENEMIES, kitCost, SHOPS, REPAIR } from './data.js';
import { HULLS } from './fleet.js';
import { buildHarbor, rowboat, barrel, crate } from './harbor.js';
import { HOMES } from './homes.js';
import { CAMP } from './campaign.js';
import { PT } from './playtest.js';
import { portrait, speakerOf, captainFace } from './portraits.js';
import { dialogShown, dialogOpen, dialogLast, dialogAct } from './dialog.js';
import { works, wall, tower, town, minaret, dome, campanile, mole, lantern, arsenal, yard, lighters, bastion, smoke, blaze, palazzo, basilica, careened, tents } from './works.js';
import { buildFortModel } from './fort.js';
import { shade } from './geo.js';

// The game as a player sees, hears and touches it in the browser: the 3D scene, the HUD, the screens, sound and
// input. The rules are all in game.js; this view follows the game's state (G) and draws it. The game calls the
// methods of the view it returns (toasts, ships coming and going, screens to show); main.js runs the frame loop.
const SCENERY = { works, wall, tower, town, minaret, dome, campanile, mole, lantern, arsenal, yard, lighters, bastion, smoke, blaze, palazzo, basilica, careened, tents, rowboat, barrel, crate, buildFortModel, shade };
const $ = (id) => document.getElementById(id);
const vrand = (a, b) => a + Math.random() * (b - a);
let G, A, world, BOARD_RANGE = 33; // the game, its api, its sea; the boarding ring's size (the game sets it)

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 14000);
let worldView = null; // made when the game is attached: it draws the game's sea
const fx = new FX(scene);
const sfx = new Sfx();
// a harbour for each home port, built the first time you make port there; the quay, the berth and the
// moorings are the same in all of them, so only the one in use is shown
const HARBORS = {};
let harbor = useHarbor('island');
function useHarbor(place) {
  if (!HARBORS[place]) { HARBORS[place] = buildHarbor(place, HOMES[place]); scene.add(HARBORS[place].group); }
  for (const k in HARBORS) HARBORS[k].group.visible = k === place;
  return (harbor = HARBORS[place]);
}
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
const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (TOUCH) document.body.classList.add('touch');
// Full screen (and, where the browser allows it, locked sideways). iPhone Safari has no full screen
// for pages, so the buttons hide there; adding the page to the home screen does the same job.
const docEl = document.documentElement, FS_OK = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
if (!FS_OK) document.body.classList.add('fsOff');
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const PHONE = TOUCH && Math.min(screen.width, screen.height) < 600;
function toggleFull(on = !isFull()) {
  if (!FS_OK || on === isFull()) return;
  if (!on) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  Promise.resolve((docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' }))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => { /* refused: play on as we are */ });
}
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
};

// ---------- broadside arcs drawn on the water (yours and hers) ----------
const arcGeo = (half) => { const g = new THREE.RingGeometry(0.07, 1, 28, 1, -half, half * 2); g.rotateX(-Math.PI / 2); return g; };
// each ship carries her own: white for yours, red for an enemy's, blue for a friend's
function arcsOf(ship) {
  if (ship.arcs) return ship.arcs;
  const grp = new THREE.Group(), sides = {}, color = ship.isPlayer ? 0xffffff : ship.side ? 0xff4a3a : 0x7ab8ff;
  for (const side of ship.sides) {
    const m = new THREE.Mesh(arcGeo(ship.bat[side].arc), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.y = side === 'stbd' ? Math.PI : side === 'bow' ? -Math.PI / 2 : 0;
    m.renderOrder = 2;
    sides[side] = m; grp.add(m);
  }
  grp.visible = false;
  scene.add(grp);
  return (ship.arcs = { grp, sides });
}
function dropArcs(ship) { for (const k in ship.arcs.sides) { ship.arcs.sides[k].geometry.dispose(); ship.arcs.sides[k].material.dispose(); } scene.remove(ship.arcs.grp); ship.arcs = null; }
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
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  const who = speakerOf(text); // a line someone says gets their face beside it
  if (who) { el.classList.add('said'); el.insertAdjacentHTML('afterbegin', `<span class="face">${portrait(who, { small: true })}</span>`); }
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, ms);
}
const camVol = (p) => clamp(1 - camera.position.distanceTo(p) / 800, 0, 1) ** 2;
const _v = new THREE.Vector3(), _m = new THREE.Vector3(), _l = new THREE.Vector3(), _n = new THREE.Vector3();
function project(p) {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * VW, y: (-_v.y * 0.5 + 0.5) * VH, behind: _v.z > 1 };
}
const floaters = [];
function floater(text, cls, pos) {
  const el = document.createElement('div');
  el.className = 'fl ' + cls; el.textContent = text;
  $('floaters').appendChild(el);
  floaters.push({ el, pos: new THREE.Vector3(pos.x, pos.y, pos.z), t: 0 });
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
// ---------- shot ----------
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
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(ballGeo, ironMat); b.position.set(vrand(-0.7, 0.7), vrand(-0.5, 0.5), vrand(-0.7, 0.7)); b.scale.setScalar(0.38); m.add(b); }
  } else m = new THREE.Mesh(ballGeo, ammo === 'fire' ? hotMat : ironMat);
  scene.add(m);
  return m;
}
// a mesh for each ball in flight, from a pool; balls() keeps them where the game's balls are
function addBall(b) { b.mesh = ballMesh(b.ammo); b.mesh.position.copy(b.pos); b.spin = vrand(8, 16); }
function dropBall(b) { if (!b.mesh) return; b.mesh.visible = false; pools[b.ammo].push(b.mesh); b.mesh = null; }
function balls(dt) {
  for (const b of G.balls) {
    if (!b.mesh) continue;
    b.mesh.position.copy(b.pos);
    if (b.ammo === 'chain') { b.mesh.rotation.y += b.spin * dt; b.mesh.rotation.z += b.spin * 0.6 * dt; }
  }
}
// ---------- ships ----------
// a view for every ship the game shows; sync() after each tick puts her where the game has her
const views = new Map();
function addShip(s) { if (views.has(s)) return; const v = new ShipView(s); views.set(s, v); scene.add(v.group); }
function dropShip(s) {
  if (!s) return;
  if (s.arcs) dropArcs(s);
  if (s.pip) { s.pip.remove(); s.pip = null; }
  const v = views.get(s); if (v) { scene.remove(v.group); views.delete(s); }
}
function showShip(s, on) { const v = views.get(s); if (v) v.group.visible = on; }
// what a fight looks like aboard: flames and smoke from a fire, smoke from a battered hull, her wake, the sea closing over her
function shipFx(s, dt) {
  const sp = s.spec;
  if (s.fire > 0 && s.sinking <= 0) {
    for (let i = 0; i < s.fire; i++) {
      const p = s.toWorld(_l.set(vrand(-0.3, 0.3) * sp.B, sp.D + vrand(0, 4), vrand(-0.35, 0.35) * sp.L), _m);
      fx.flame(p.x, p.y, p.z);
      if (Math.random() < 0.25) fx.smoke(p.x, p.y + 2, p.z, 0.12, Math.sin(world.wind.dir) * 3, Math.cos(world.wind.dir) * 3);
    }
  }
  s.fxT = (s.fxT || 0) - dt;
  if (s.fxT > 0) return;
  s.fxT = 0.06;
  if ((s.hullR < 0.45 || s.sinking > 0) && Math.random() < 0.5) {
    const p = s.toWorld(_l.set(0, sp.D + 1, vrand(-0.3, 0.3) * sp.L), _m);
    fx.smoke(p.x, p.y, p.z, 0.22, Math.sin(world.wind.dir) * 3, Math.cos(world.wind.dir) * 3);
  }
  const v = s.speed;
  if (v > 1.5 && s.sinking < 2) {
    const sx = s.pos.x - s.fwdX * sp.L * 0.5, sz = s.pos.z - s.fwdZ * sp.L * 0.5;
    fx.foam(sx + vrand(-1.5, 1.5), world.height(sx, sz) + 0.25, sz + vrand(-1.5, 1.5), 0, 0, 1.6 + v * 0.14, 2.2 + v * 0.12);
    for (const side of [-1, 1]) {
      const bx = s.pos.x + s.fwdX * sp.L * 0.4 + s.fwdZ * side * 1.4, bz = s.pos.z + s.fwdZ * sp.L * 0.4 - s.fwdX * side * 1.4;
      fx.foam(bx, world.height(bx, bz) + 0.3, bz, s.fwdZ * side * v * 0.35, -s.fwdX * side * v * 0.35, 1.2 + v * 0.08, 1.4);
    }
  }
  if (s.sinking > 0 && s.sinking < 7) fx.splash(_m.set(s.pos.x + vrand(-6, 6), 0.3, s.pos.z + vrand(-8, 8)), 0.4);
}

// ---------- marks on the water ----------
let zoneMeshes = [];
function zones(list) {
  for (const z of zoneMeshes) { scene.remove(z); z.geometry.dispose(); }
  zoneMeshes = [];
  for (const z of list) {
    const m = decal(new THREE.RingGeometry(z.r - 2.2, z.r, 64), z.color || 0x9dff9a, 0.5);
    m.position.set(z.x, 1.2, z.z); scene.add(m); zoneMeshes.push(m);
  }
}
// a leg's scenery: the towns, forts and boats ashore (maps.js), built from the scenery kit and set on the land
function scenery(def) { worldView.islandGroup.add(def.works({ ground: (x, z) => world.ground(x, z), islandGroup: worldView.islandGroup }, SCENERY)); }
// ---------- cards and screens ----------
const faces = (ids, cls = '') => (ids && ids.length ? `<div class="faces ${cls}">${ids.map((id) => portrait(id)).join('')}</div>` : '');
function showLegCard(h) {
  setMode(null); $('bars').classList.add('on');
  showScreen(`<div class="lower"><div class="eyebrow">${h.eyebrow}</div><h1>${h.title}</h1><div class="line">${h.line}</div>
    <div class="hook">${h.hook || ''}</div><button class="btn big" data-act="engage">${h.go || 'Beat to quarters'}</button></div>`, 'clear low');
}
function battleHud() {
  noGo.geometry.dispose(); noGo.geometry = noGoGeo(noGoHalf(G.player.spec));
  $('bars').classList.remove('on');
  buildAmmoBar(); setupHudNames();
  $('bBow').classList.toggle('hidden', !G.player.bat.bow);
  $('bPort').classList.toggle('hidden', !G.player.bat.port); $('bStbd').classList.toggle('hidden', !G.player.bat.stbd);
  $('oars').classList.toggle('hidden', !G.player.spec.oars); $('tbOar').classList.toggle('hidden', !G.player.spec.oars);
}
function target(e, range) {
  BOARD_RANGE = range;
  boardRing.geometry.dispose(); boardRing.geometry = new THREE.RingGeometry(BOARD_RANGE - 1.6, BOARD_RANGE, 72).rotateX(-Math.PI / 2);
  setupHudNames();
}
function coach(html) {
  const el = $('coach');
  if (html == null) return el.classList.add('hidden');
  el.innerHTML = html; el.classList.remove('hidden');
}
// ---------- camera ----------
function updateCamera(dt) {
  const c = G.cam, p = G.player, e = G.enemy, st = G.state;
  const center = _m.set(p.pos.x, 7, p.pos.z);
  let want, dist = c.dist * clamp(p.spec.L / 30, 0.85, 1.6), pitch = c.pitch, rate = 1.5;
  if (st === 'title' || st === 'won') { center.set(p.pos.x - 6, 9, p.pos.z); want = 0.75 + Math.sin(G.t * 0.1) * 0.25 + c.yaw; dist = 72; pitch = 0.16; }
  else if (st === 'port') {
    const sp = G.shop && harbor.spots.find((s) => s.id === G.shop), ts = G.shop && G.trophyShips.find((t) => 'ship:' + t.id === G.shop);
    if (sp) { center.set(sp.pos.x * 0.75, 7, sp.pos.z + 16); dist = 72; } else if (ts) { center.set(ts.pos.x, 8, ts.pos.z); dist = 80; } else { center.set(0, 7, 4); dist = VH < 540 && camera.aspect > 1.6 ? 100 : 128; } // a short wide screen: closer, so the shop signs do not pile up
    want = 0.3 + Math.sin(G.t * 0.07) * 0.14 + c.yaw; pitch = 0.27;
  } else if (st === 'story' && G.envoys && G.envoys.length) {
    // the choice of side: the harbour from the sea, with both navies' galleys and your brig in frame above the dialog
    center.set(harbor.berth.x, 0, harbor.berth.z + 40); want = Math.sin(G.t * 0.05) * 0.05 + c.yaw; dist = 80; pitch = 0.17;
    if (G.envoyCut) { center.y = 5; dist = 92; pitch = 0.07; } // the opening shot: low on the water, like a fight's card
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
  else if (VH < 540 && st !== 'title' && st !== 'won' && st !== 'port') dist *= 1.18; // a phone on its side: stand off a little, the HUD takes the edges
  if (st !== 'title' && st !== 'won') dist *= c.zoom; // pinch or wheel
  c.angle += wrap(want - c.angle) * Math.min(1, dt * rate);
  const cp = Math.cos(pitch);
  const tx = center.x + Math.sin(c.angle) * cp * dist, tz = center.z + Math.cos(c.angle) * cp * dist, ty = center.y + Math.sin(pitch) * dist;
  const k = Math.min(1, dt * 5);
  c.pos.x += (tx - c.pos.x) * k; c.pos.y += (ty - c.pos.y) * k; c.pos.z += (tz - c.pos.z) * k;
  c.pos.y = Math.max(c.pos.y, world.height(c.pos.x, c.pos.z) + 2.5, world.pieces.length ? world.ground(c.pos.x, c.pos.z) + 4 : -9);
  c.look.lerp(center, Math.min(1, dt * 6));
  camera.position.set(c.pos.x, c.pos.y, c.pos.z);
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 2.5);
    camera.position.x += (Math.random() - 0.5) * G.shake * 1.2; camera.position.y += (Math.random() - 0.5) * G.shake * 1.2;
  }
  camera.lookAt(c.look.x, c.look.y, c.look.z);
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
  if (m === 'melee' && G.bd) { $('mPN').textContent = G.player.spec.name; $('mEN').textContent = G.bd.foe.spec.name; }
  if (m !== 'battle' && m !== 'melee') { $('pStatus').textContent = ''; $('toasts').innerHTML = ''; }
  if (m !== 'battle') { $('coach').classList.add('hidden'); $('tag').classList.add('hidden'); $('boardGo').classList.add('hidden'); }
}
function buildAmmoBar() {
  $('ammo').innerHTML = AMMO_KEYS.map((k, i) => `<div class="slot" data-ammo="${k}" title="${AMMO[k].tip}"><kbd>${i + 1}</kbd><svg viewBox="0 0 26 26">${ICON[k]}</svg><div class="n">${AMMO[k].name}</div><div class="c"></div></div>`).join('');
}
const gunLine = (s) => s.spec.fixed ? `${s.spec.bow.n} ${s.cal.name} guns` : `${s.spec.guns * 2} ${(s.bat.port || s.main).cal.name} guns` + (s.spec.bow ? ` · ${s.spec.bow.n} ${s.bat.bow.cal.name} bow guns` : '');
function setupHudNames() {
  const p = G.player, e = G.enemy;
  $('pName').textContent = p.spec.name; $('pSub').textContent = `${p.spec.cls} · ${gunLine(p)}`;
  if (e) { $('eName').textContent = e.spec.name; $('eSub').textContent = `${e.spec.cls} · ${gunLine(e)}`; }
}
function ammoTip(k) { $('ammoTip').textContent = `${AMMO[k].long}: ${AMMO[k].tip}`; G.tipT = 3.5; }
let hudTick = 0;
const rctx = $('radar').getContext('2d');
function setBars(pre, s) {
  $(pre + 'Hull').style.width = s.hullR * 100 + '%'; $(pre + 'Sail').style.width = s.sailR * 100 + '%'; $(pre + 'Crew').style.width = s.crewR * 100 + '%';
  $(pre + 'HullN').textContent = Math.max(0, Math.ceil(s.hull)); $(pre + 'SailN').textContent = Math.max(0, Math.ceil(s.sails)); $(pre + 'CrewN').textContent = Math.round(s.crew);
}
function placeArcs(ship, on) {
  if (!on && !ship.arcs) return;
  const a = arcsOf(ship);
  a.grp.visible = on;
  if (!on) return;
  a.grp.position.set(ship.pos.x, 1.3, ship.pos.z); a.grp.rotation.y = ship.heading;
  for (const k in a.sides) a.sides[k].scale.setScalar(ship.range(ship.ammo, k));
}
const BAT_EL = { port: 'bPort', stbd: 'bStbd', bow: 'bBow' };
// a thin green line under an oared ship's name: her oarsmen's wind. Red when they are spent
function oarBar(el, s) { const on = !!s.spec.oars && s.active; el.classList.toggle('on', on); if (on) { el.classList.toggle('spent', !!s.spent); el.firstChild.style.width = s.stamina * 100 + '%'; } }
function updatePips(p, battle) {
  const box = $('pips');
  for (const s of G.ships) {
    const show = battle && s !== p && s !== G.enemy && !s.sinking && s.out !== 'blown' && (s.active || s.out === 'captured' || s.out === 'struck');
    if (!show) { if (s.pip) s.pip.style.display = 'none'; continue; }
    if (!s.pip) { s.pip = document.createElement('div'); s.pip.innerHTML = '<b></b><div class="h"><i></i></div><div class="st"><i></i></div>'; box.appendChild(s.pip); s.pip.onclick = () => { if (s.side !== p.side && s.active) { A.setTarget(s); sfx.ui(); } }; }
    const q = project(_l.set(s.pos.x, s.y + s.mastH + 4, s.pos.z)), el = s.pip;
    if (q.behind || q.x < 0 || q.x > VW || q.y < 0 || q.y > VH) { el.style.display = 'none'; continue; }
    el.style.display = ''; el.className = 'pip ' + (!s.active ? 'out' : s.side === p.side ? 'friend' : 'foe');
    el.style.transform = `translate(-50%,-100%) translate(${q.x}px,${q.y}px)`;
    if (hudTick % 4 === 0) { el.firstChild.textContent = s.name + (!s.active ? (s.out === 'captured' ? ' · taken' : ' · struck') : s.aground > 0 ? ' · aground' : ''); el.querySelector('i').style.width = s.hullR * 100 + '%'; oarBar(el.querySelector('.st'), s); }
  }
}
function updateHUD(dt) {
  const { BOARD_SPEED, BOARD_SLOW } = A.boardState();
  const p = G.player, e = G.enemy, battle = G.state === 'battle', foes = foesOf(p);
  const dist = e ? sep(p, e) : 1e9;
  for (const s of G.ships) placeArcs(s, battle && s.active && (s === p || s.spec.fixed || sep(p, s) < 420));
  windRing.visible = battle;
  if (battle) {
    windRing.position.set(p.pos.x, 1.4, p.pos.z);
    noGo.rotation.y = world.wind.dir + Math.PI - Math.PI / 2; // wedge points upwind
    arrowHold.rotation.y = world.wind.dir - Math.PI / 2; // arrow sits downwind of you, pointing the way the wind blows
    arrowHold.scale.setScalar(0.45 + 0.55 * Math.min(1.4, world.wind.str));
    const stalled = Math.abs(wrap(p.heading - world.wind.dir)) > Math.PI - noGoHalf(p.spec);
    noGo.visible = world.wind.str > 0.3 || !p.spec.oars;
    noGo.material.opacity = stalled ? 0.5 + 0.2 * Math.sin(G.t * 9) : 0.3;
  }
  const boardable = e && e.side !== p.side && !e.sinking && (e.active || G.sc.boardWrecks) && e.out !== 'captured';
  boardRing.visible = battle && boardable && dist < 190 && G.boardCd <= 0;
  if (boardRing.visible) {
    const inside = dist < BOARD_RANGE, ready = inside && relSpeed(p, e) < BOARD_SPEED && e.speed < BOARD_SLOW * p.spec.mods.boardSpeed;
    boardRing.position.set(e.pos.x, 1.5, e.pos.z);
    boardRing.material.color.set(ready ? 0x7fff7a : inside ? 0xffb04a : 0xffffff);
    boardRing.material.opacity = ready ? 0.6 + 0.25 * Math.sin(G.t * 9) : inside ? 0.55 : 0.28;
  }
  for (const side of p.sides) {
    const ready = p.reload[side] <= 0, bear = battle && foes.some((o) => inArc(p, side, o, 1.05)), el = $(BAT_EL[side]);
    const m = arcsOf(p).sides[side].material;
    m.color.set(ready ? (bear ? 0xffd45a : 0xffffff) : 0xff6a5a); m.opacity = ready ? (bear ? 0.26 + 0.06 * Math.sin(G.t * 8) : 0.08) : 0.04;
    el.classList.toggle('ready', ready); el.classList.toggle('bear', ready && bear);
    el.querySelector('i').style.width = (ready ? 100 : (1 - p.reload[side] / p.reloadMax[side]) * 100) + '%';
    el.querySelector('.s').textContent = ready ? (bear ? 'FIRE!' : 'Ready') : p.reload[side].toFixed(1) + 's';
  }
  for (const s of G.ships) if (s !== p && s.arcs && s.arcs.grp.visible) for (const side of s.sides) s.arcs.sides[side].material.opacity = s.side === p.side ? 0.04 : s.reload[side] <= 0 ? (inArc(s, side, p, 1.05) ? 0.15 : 0.08) : 0.025;
  // marker on your target: pinned above her, or clamped to the screen edge with an arrow when out of view
  const tag = $('tag');
  tag.classList.toggle('hidden', !battle || !e);
  if (battle && e) {
    const s = project(_l.set(e.pos.x, e.y + e.mastH + 5, e.pos.z));
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
  updatePips(p, battle);
  if (G.tipT > 0 && (G.tipT -= dt) <= 0) $('ammoTip').textContent = '';
  if (++hudTick % 4) return;
  setBars('p', p);
  $('ePanel').style.visibility = e ? '' : 'hidden';
  const st = (s) => [s.fire > 0 ? 'On fire' : '', s.aground > 0 ? 'Aground' : '', s.anchored ? (s === p ? 'At anchor: A / D haul on the spring' : 'At anchor') : '', s.spent ? 'Oarsmen spent' : '', s.hullR < 0.3 ? 'Taking on water' : '', s.sailR < 0.3 && !s.spec.fixed ? 'Rigging in tatters' : ''].filter(Boolean).join(' · ');
  $('pStatus').textContent = st(p);
  const ob = G.sc.objective, obT = typeof ob === 'function' ? ob() : ob || '';
  if ($('objective').textContent !== obT) $('objective').textContent = obT;
  $('objective').classList.toggle('hidden', !obT || !battle);
  document.querySelectorAll('#ammo .slot').forEach((el) => {
    const k = el.dataset.ammo;
    el.classList.toggle('sel', k === p.ammo); el.classList.toggle('out', k !== 'round' && p.stock[k] <= 0);
    el.querySelector('.c').textContent = k === 'round' ? '∞' : '×' + p.stock[k];
  });
  const off = wrap(p.heading - world.wind.dir), lv = p.sailLevel;
  $('knots').textContent = (p.speed * 0.9).toFixed(1);
  $('sailName').textContent = SAILS[lv].name;
  [...$('sailBars').children].forEach((el, i) => el.classList.toggle('on', i < lv));
  const pos = pointOfSail(off, p.spec.point), wn = world.windName();
  $('pos').textContent = p.aground > 0 ? 'Aground!' : pos === 'In irons' && world.wind.str > 0.3 && !p.oarSpeed(world) ? 'In irons!' : '';
  $('windName').textContent = wn === 'Breeze' ? '' : wn; $('windName').className = wn === 'Gale' ? 'bad' : '';
  if (p.spec.oars) { $('oarName').textContent = p.spent ? 'Spent — resting' : ['Oars shipped', 'Rowing', 'Sprinting'][p.oar] + (p.stamina < 0.3 && p.oar ? ', tiring' : ''); $('stam').style.width = p.stamina * 100 + '%'; }
  drawRadar(p, e);
  if (!e) { $('boardGo').classList.add('hidden'); return; }
  setBars('e', e);
  $('eOarRow').classList.toggle('hidden', !e.spec.oars);
  if (e.spec.oars) { $('eOar').style.width = e.stamina * 100 + '%'; $('eOarRow').classList.toggle('spent', !!e.spent); $('eOarN').textContent = e.spent ? 'spent' : e.stamina < 0.3 ? 'tiring' : ''; }
  if (battle) { tag.querySelector('.d').textContent = `${e.name} · ${Math.round(dist)} yds`; tag.querySelector('.h i').style.width = e.hullR * 100 + '%'; oarBar(tag.querySelector('.st'), e); }
  $('eStatus').textContent = [e.active ? AMMO[e.ammo].long : e.out === 'captured' ? 'Taken' : e.out === 'silenced' ? 'Silenced' : 'Out of the fight', st(e)].filter(Boolean).join(' · ');
  // what a boarding would look like, pinned to her marker once you are close
  const near = dist < BOARD_RANGE, slow = relSpeed(p, e) < BOARD_SPEED, warn = !!G.grappler;
  const odds = strength(p) / (strength(e) || 1), o = tag.querySelector('.o');
  const shaken = readiness(e) < 0.8 ? (e.fire > 0 ? ' · her crew fighting fire' : ' · her crew at the pumps') : '';
  const fast = e.speed >= BOARD_SLOW * p.spec.mods.boardSpeed;
  o.textContent = battle && boardable && dist < 170 ? `Board: ${Math.round(strength(p))} v ${Math.round(strength(e))}${fast ? ' · too fast to grapple, slow her' : near && !slow ? ' · match her speed' : shaken}` : '';
  o.className = 'o ' + (odds > 1.15 ? 'good' : odds > 0.87 ? '' : 'bad');
  const go = $('boardGo');
  go.classList.toggle('hidden', !(battle && (G.canBoard || warn)));
  go.classList.toggle('warn', warn);
  const worth = G.mode === 'skirmish' ? ` · prize ${prize(e)} g` : '';
  go.innerHTML = warn ? `${G.grappler.name} is grappling — pull away!<i style="width:${G.aiGrapple * 100}%"></i>` : `<kbd>B</kbd> ${e.spec.fixed ? 'Storm the battery' : 'Board her'} <small>${odds > 1.6 ? 'strong odds' : odds > 1.15 ? 'good odds' : odds > 0.87 ? 'even odds' : odds > 0.6 ? 'poor odds' : 'hopeless'}${worth}</small>`;
}
function updateMelee() {
  const b = G.bd, p = G.player;
  if (!b) return;
  const e = b.foe, sp = strength(p), se = strength(e), r = sp / (sp + se || 1);
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
  x.fillStyle = 'rgba(143,224,207,.35)';
  for (const sh of world.shoals) { x.beginPath(); const P = sh.shape.pts; for (let i = 0; i < P.length; i += 2) { const [ix, iy] = pt(P[i][0], P[i][1]); if (i) x.lineTo(ix, iy); else x.moveTo(ix, iy); } x.closePath(); x.fill(); }
  x.fillStyle = '#8c8266';
  for (const i of world.islands) { if (i.soft) continue; const [ix, iy] = pt(i.x, i.z); x.beginPath(); x.arc(ix, iy, i.r * k * 1.1, 0, 7); x.fill(); }
  for (const c of world.coasts) { x.beginPath(); const P = c.shape.pts; for (let i = 0; i < P.length; i += 2) { const [ix, iy] = pt(P[i][0], P[i][1]); if (i) x.lineTo(ix, iy); else x.moveTo(ix, iy); } x.closePath(); x.fill(); }
  if (world.moles.length) { x.strokeStyle = '#8c8266'; x.lineCap = x.lineJoin = 'round'; for (const m of world.moles) { x.lineWidth = Math.max(2, m.w * k); x.beginPath(); m.path.forEach((q, i) => { const [ix, iy] = pt(q[0], q[1]); if (i) x.lineTo(ix, iy); else x.moveTo(ix, iy); }); x.stroke(); } }
  x.strokeStyle = '#9dff9a'; x.lineWidth = 3;
  for (const z of G.sc.zones || []) {
    let [zx, zy] = pt(z.x, z.z); const d = Math.hypot(zx, zy);
    if (d > R - 6) { zx *= (R - 6) / d; zy *= (R - 6) / d; x.fillStyle = '#9dff9a'; x.beginPath(); x.arc(zx, zy, 6, 0, 7); x.fill(); }
    else { x.beginPath(); x.arc(zx, zy, Math.max(5, z.r * k), 0, 7); x.stroke(); }
  }
  for (const [side, a0] of [['port', Math.PI], ['stbd', 0], ['bow', -Math.PI / 2]]) {
    if (!p.bat[side]) continue;
    x.fillStyle = p.reload[side] <= 0 ? 'rgba(255,214,110,.22)' : 'rgba(255,110,90,.1)';
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, p.range(p.ammo, side) * k, a0 - p.bat[side].arc, a0 + p.bat[side].arc); x.fill();
  }
  for (const o of G.ships) {
    if (o === p || o.sinking > 6 || o.out === 'blown') continue;
    let [ex, ey] = pt(o.pos.x, o.pos.z);
    const d = Math.hypot(ex, ey);
    if (d > R - 8) { if (o !== e) continue; ex *= (R - 8) / d; ey *= (R - 8) / d; }
    x.save(); x.translate(ex, ey); x.rotate(-(o.heading - p.heading));
    x.fillStyle = !o.active ? '#8a8a8a' : o.side === p.side ? '#7ab8ff' : '#ff5b4a';
    const q = o === e ? 1 : 0.72;
    if (o.spec.fixed) x.fillRect(-7 * q, -7 * q, 14 * q, 14 * q);
    else { x.beginPath(); x.moveTo(0, -11 * q); x.lineTo(6 * q, 8 * q); x.lineTo(-6 * q, 8 * q); x.fill(); }
    if (o === e) { x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.stroke(); }
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
  <div><kbd>V</kbd> camera</div><div><kbd>P</kbd> pause · <kbd>M</kbd> mute</div>
  <div><kbd>T</kbd> next target</div><div><kbd>G</kbd> anchor: hold still, steady guns, A / D swing her round</div>
  <div><kbd>R</kbd> oars: rest · row · sprint</div><div><kbd>F</kbd> fire the bow guns</div></div>
  <div class="touchKeys">◀ ▶ rudder · Sail + / − · FIRE shoots whichever side bears<br>Tap PORT or STBD to fire one side · tap a shot to load it<br>Drag the sea to look around · pinch to zoom · tap the oars line to row</div>`;
function showTitle(saved) {
  showScreen(`<div id="titleWrap"><h1>Broadside</h1><div class="tag">The war for Candia. An island captain, two flags to choose from.</div>
    <div class="rowc">${saved ? `<button class="btn big" data-act="camp:continue">Continue the campaign</button><button class="btn" data-act="camp:new">New campaign</button>` : `<button class="btn big" data-act="camp:new">Begin the campaign</button>`}
    <button class="btn" data-act="skirmish">Skirmish: five pirates</button>${__PLAYTEST__ ? PT.titleButton() : ''}</div>${saved ? `<div class="tag" style="font-size:15px;margin-top:14px">${saved}</div>` : ''}</div>`, 'clear');
}
function showIntro(es) {
  setMode(null); $('bars').classList.add('on');
  showScreen(`<div class="lower">${faces([captainFace(es.captain)].filter(Boolean))}<div class="eyebrow">Wanted · ${G.level + 1} of ${ENEMIES.length}</div><h1>${es.captain}</h1>
    <div class="line">${es.cls} <i>${es.name}</i> · ${es.guns * 2} ${CAL[es.cal].name} guns · ${es.crew} crew · ${es.bounty} g bounty</div>
    <div class="hook">${es.hook}</div><button class="btn big" data-act="engage">Engage</button></div>`, 'clear low');
}
function showResult({ o, es, lost, cap, gold, men, last }) {
  const p = G.player;
  if (lost) {
    return showScreen(`<div class="banner bad">${faces([captainFace(es.captain)].filter(Boolean))}<div class="eyebrow">${o === 'lost' ? 'Sunk by' : 'Boarded and taken by'} ${es.captain}</div><h1>${p.spec.name} lost</h1>
      <div class="rowc"><button class="btn big" data-act="retry">Fight again</button><button class="btn sm" data-act="restart">New voyage</button></div></div>`);
  }
  const loot = cap
    ? `<div class="loot">She is yours to sail — take command of her in port</div><div class="loot">+3 chain · +3 grape · +2 heated${men ? ` · +${men} crew` : ''}</div>`
    : `<div class="loot">${o === 'struck' ? 'A wreck, sold for the bounty.' : 'Gone to the bottom.'} Boarded, she would have paid up to ${es.bounty * 2} g and been yours to sail.</div>`;
  showScreen(`<div class="banner">${faces([captainFace(es.captain)].filter(Boolean), 'beaten')}<div class="eyebrow">${es.captain} is finished</div><h1>${es.name} ${cap ? 'taken' : o === 'struck' ? 'wrecked' : 'sunk'}</h1>
    <div class="gold">+${gold} g</div>${loot}
    <div class="rowc"><button class="btn big" data-act="${last ? 'final' : 'port'}">${last ? 'Sail home' : 'Make port'}</button></div></div>`, 'clear');
}
function showFinal(acc) {
  const s = G.stats, mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
  showScreen(`<div class="banner"><div class="eyebrow">The southern sea is quiet</div><h1>Pirate hunter</h1>
    <div class="stats"><div>Taken<b>${s.captured}</b></div><div>Sunk<b>${s.sunk}</b></div><div>Gold<b>${G.earned}</b></div><div>Accuracy<b>${acc}%</b></div><div>In action<b>${mm}:${ss}</b></div></div>
    <div class="rowc"><button class="btn big" data-act="restart">Sail again</button></div></div>`, 'clear');
}
function offersCard(c) {
  if (!c) return $('bars').classList.remove('on');
  setMode(null); $('bars').classList.add('on');
  showScreen(`<div class="lower"><div class="eyebrow">${c.eyebrow}</div><h1>${c.title}</h1><div class="line">${c.line}</div><button class="btn big" data-act="camp:offers">${c.go || 'Hear them out'}</button></div>`, 'clear low');
}
function pause(on) {
  if (on) showScreen(`<div class="banner"><h1>Paused</h1>${KEYS_HTML}<div class="rowc"><button class="btn big" data-act="resume">Resume</button><button class="btn sm" data-act="restart">${G.mode === 'campaign' ? 'Give up this fight' : 'Abandon voyage'}</button></div>${__PLAYTEST__ && G.mode === 'campaign' ? PT.pauseRow() : ''}</div>`);
  else hideScreen();
}

// ---------- the port ----------
function buildSpots() {
  // shops float over their buildings; your other ships are a fixed list, so a label can never sit on a shop
  $('spots').innerHTML = harbor.spots.map((s) => `<button class="spot" data-spot="${s.id}">${s.name}<i></i></button>`).join('');
  $('fleetList').innerHTML = G.trophyShips.length ? `<div class="eyebrow">${G.mode === 'campaign' ? 'Your other ships' : 'Your prizes'}</div>`
    + G.trophyShips.map((t) => `<button class="spot ship" data-spot="ship:${t.id}">${t.spec.name}<small>${t.spec.cls}</small></button>`).join('') : '';
}
function showPort() {
  setMode(G.state === 'port' ? 'port' : null); setupHudNames();
  $('portName').textContent = G.mode === 'campaign' ? CAMP.portName() : 'Port Halcyon';
  buildSpots();
  renderPort();
}
const COST = (k) => REPAIR[k][1];
function renderPort() {
  const p = G.player, g = G.gold, nx = ENEMIES[G.level];
  setBars('p', p);
  $('purse').textContent = `${g} g`;
  const cam = G.mode === 'campaign';
  $('nextLine').innerHTML = cam ? CAMP.nextLine() : `Next: <b>${nx.captain}</b><br>${nx.cls} <i>${nx.name}</i>`;
  const need = { hull: p.hullMax - p.hull, sails: p.sailsMax - p.sails, crew: Math.round(p.crewMax - p.crew) };
  document.querySelectorAll('#spots .spot, #fleetList .spot').forEach((el) => {
    const sh = SHOPS[el.dataset.spot] || {};
    el.classList.toggle('need', !cam && !!sh.repair && need[sh.repair] >= 1);
    el.classList.toggle('sel', G.shop === el.dataset.spot);
  });
  const box = $('shop');
  box.classList.toggle('hidden', !G.shop);
  if (!G.shop) return;
  if (G.shop.startsWith('ship:')) {
    // another ship of yours: compare her with the one you are sailing, bar for bar
    const id = A.sid(G.shop.slice(5)), h = A.hullSpec(id), cur = A.hullSpec(G.ship);
    const val = { hull: (x) => x.hull, guns: (x) => x.guns + (x.bow ? x.bow.n / 2 : 0), reach: (x) => 250 * CAL[x.bow && x.bow.main ? x.bow.cal : x.cal].range, rate: (x) => 60 / (x.reload * CAL[x.cal].reload), crew: (x) => x.crew, speed: (x) => x.speed, turn: (x) => x.turn };
    const row = (label, k, max, txt) => `<div class="cmp"><span>${label}</span><div class="t"><i style="width:${(val[k](h) / max) * 100}%"></i><u style="left:${(val[k](cur) / max) * 100}%"></u></div><b>${txt || ''}</b></div>`;
    box.innerHTML = `<h3>${h.name}<button class="x" data-act="closeshop">✕</button></h3><div class="role">${h.cls} · <b>${A.kitOf(id).name}</b>. ${A.roleOf(id)}</div>
      ${row('Hull', 'hull', 900, h.hull)}${row('Guns', 'guns', 18, h.guns * 2 + (h.bow ? h.bow.n : 0))}${row('Reach', 'reach', 310, CAL[h.bow && h.bow.main ? h.bow.cal : h.cal].name)}${row('Loading', 'rate', 14)}${row('Crew', 'crew', 220, h.crew)}${row('Speed', 'speed', 16)}${row('Helm', 'turn', 0.8)}
      <div class="role">Draws ${h.D.toFixed(1)}${h.oars ? ' · oars' : ''}${cam && CAMP.crewFor(h) < h.crew ? ` · <b>short-handed</b>: you can man her with ${CAMP.crewFor(h)} of ${h.crew}` : ''}</div>
      <div class="role"><u class="mk"></u> marks the ${cur.name}. Fittings stay with each ship; your shot comes with you.</div>
      <div class="rowc" style="margin-top:8px"><button class="btn" data-act="cmd:${id}">Take command</button></div>`;
    return;
  }
  const sh = SHOPS[G.shop], rows = [];
  if (sh.repair && !cam) {
    const k = sh.repair, n = need[k], full = Math.ceil(n * COST(k));
    rows.push(`<div class="item"><div class="d">${REPAIR[k][0]}<small>${Math.floor(p[k])} / ${p[k + 'Max']}</small></div>
      <button class="btn sm" data-act="rep:${k}" ${n < 1 || g < COST(k) ? 'disabled' : ''}>${n < 1 ? 'Full' : g >= full ? full + ' g' : 'Spend ' + g + ' g'}</button></div>`);
  }
  for (const it of A.kitOf(G.ship).items.filter((x) => x.at === G.shop)) {
    const lv = A.fitOf(G.ship)[it.id] || 0, c = kitCost(lv);
    rows.push(`<div class="item"><div class="d">${it.name} <span class="lv">${[0, 1].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><small>${it.desc}</small></div>
      <button class="btn sm" data-act="up:${it.id}" ${lv >= 2 || g < c ? 'disabled' : ''}>${lv >= 2 ? 'Fitted' : c + ' g'}</button></div>`);
  }
  if (!rows.length) rows.push(`<div class="role">${cam && sh.repair ? 'Repairs are on the fleet’s account. ' : ''}Nothing here suits a ${A.kitOf(G.ship).name.toLowerCase()} like the ${p.spec.name}.</div>`);
  for (const [k, n, c] of sh.ammo || []) {
    rows.push(`<div class="item"><svg viewBox="0 0 26 26">${ICON[k]}</svg><div class="d">${AMMO[k].long} ×${n}<small>Aboard: ${p.stock[k]}</small></div>
      <button class="btn sm" data-act="ammo:${k}:${n}:${c}" ${g < c ? 'disabled' : ''}>${c} g</button></div>`);
  }
  box.innerHTML = `<h3>${harbor.spots.find((s) => s.id === G.shop).name}<button class="x" data-act="closeshop">✕</button></h3>${rows.join('')}`;
}
function updatePortUI() {
  const n = harbor.spots.length;
  document.querySelectorAll('#spots .spot').forEach((el, i) => {
    if (i >= n) return;
    const s = project(harbor.spots[i].pos);
    el.style.transform = `translate(-50%,-100%) translate(${s.x}px,${s.y}px)`;
    el.style.display = s.behind ? 'none' : '';
  });
}

// ---------- input ----------
// keys held (the helm) go into the game's keys; keys pressed go to tap(), after the view's own (camera, sound, help)
let keys = {}; // the game's (attach)
function tap(k) {
  if (k === 'm') return toast(sfx.toggleMute() ? 'Sound off' : 'Sound on', '', 1200);
  if ((k === 'v' || k === 'h') && !G.paused && G.state !== 'boarding') {
    if (k === 'v') { G.cam.mode = G.cam.mode === 'helm' ? 'combat' : 'helm'; G.cam.yaw = 0; return toast(G.cam.mode === 'helm' ? 'Camera: at the helm' : 'Camera: facing the enemy', '', 1400); }
    return $('help').classList.toggle('open');
  }
  A.tap(k);
}
// buttons on the screens: the view's own, then the game's
function act(a) {
  if (a === 'upright') { sfx.init(); sfx.ui(); return document.body.classList.add('upright'); }
  if (PHONE && (a === 'camp:new' || a === 'camp:continue' || a === 'skirmish')) toggleFull(true); // a phone plays full screen, on its side
  if (__PLAYTEST__ && a.startsWith('pt:')) { sfx.init(); sfx.ui(); return PT.act(a.slice(3)); }
  A.act(a);
}
// keys while a page of the story is being told; true if the key was used
function dialogKey(k) {
  if (!dialogOpen()) return false;
  if (k === ' ' || k === 'enter' || k === 'arrowright') {
    if (!dialogLast()) { dialogAct('next'); return true; }
    const btns = document.querySelectorAll('#screen .dlg-end .btn.big');
    if (btns.length === 1) { btns[0].click(); return true; } // one way on: Enter takes it
    return false;
  }
  if (k === 'arrowleft' || k === 'backspace') { dialogAct('back'); return true; }
  if (k === 'escape') { dialogAct('skip'); return true; }
  return false;
}
dialogShown(() => !!document.querySelector('#screen.dlgscr .dlg'));
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (G.state === 'story' && G.envoyCut && [' ', 'enter', 'escape', 'arrowright'].includes(k)) { e.preventDefault(); return act('camp:offers'); }
  if (G.state === 'story' && dialogKey(k)) return e.preventDefault();
  keys[k] = true; tap(k);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-ammo],[data-fire],[data-spot],[data-tapkey],[data-fs]');
  if (!t) return;
  const d = t.dataset;
  if (d.fs) toggleFull();
  else if (d.act) act(d.act);
  else if (d.ammo) { G.rec.input(String(AMMO_KEYS.indexOf(d.ammo) + 1)); A.selectAmmo(d.ammo); } // recorded as the key that does the same
  else if (d.fire) { G.rec.input({ port: 'q', stbd: 'e', bow: 'f' }[d.fire]); A.fire(G.player, d.fire); }
  else if (d.spot) { G.shop = G.shop === d.spot ? null : d.spot; sfx.init(); sfx.ui(); renderPort(); }
  else if (d.tapkey) tap(d.tapkey);
});
// Tap buttons fire on the press. Hold buttons (the rudder) are not tracked press by press: every touch
// event re-reads which of them has a finger on it, so a lost release (a system edge swipe, a long-press
// callout, a finger sliding off) can never leave one stuck, and sliding from one to the other swaps them.
const holdBtns = [...document.querySelectorAll('.tb[data-key]')];
function syncHolds(list) {
  const SLACK = 14; // a held thumb drifts: keep the button down a little past its edge
  const down = new Set();
  for (const t of list) {
    let best = null, bd = Infinity;
    for (const b of holdBtns) {
      const r = b.getBoundingClientRect();
      if (!r.width) continue; // hidden
      const dx = Math.max(r.left - t.clientX, 0, t.clientX - r.right), dy = Math.max(r.top - t.clientY, 0, t.clientY - r.bottom), d = Math.hypot(dx, dy);
      if (d <= SLACK && d < bd) { best = b; bd = d; }
    }
    if (best) down.add(best);
  }
  for (const b of holdBtns) { const on = down.has(b); b.classList.toggle('on', on); keys[b.dataset.key] = on; }
}
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(ev, (e) => syncHolds(e.touches), { passive: true });
for (const ev of ['blur', 'pagehide']) window.addEventListener(ev, () => syncHolds([]));
document.addEventListener('visibilitychange', () => { if (document.hidden) syncHolds([]); });
document.querySelectorAll('.tb').forEach((b) => {
  const k = b.dataset.key, tp = b.dataset.tap;
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (tp) { b.classList.add('on'); tap(tp); }
    else if (k && e.pointerType === 'mouse') { b.classList.add('on'); keys[k] = true; } // touch holds are handled above
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, (e) => {
    if (tp) b.classList.remove('on');
    else if (k && e.pointerType === 'mouse') { b.classList.remove('on'); keys[k] = false; }
  });
});
let drag = null, pinch = 0;
const touchPts = new Map();
const spread = () => { const [a, b] = [...touchPts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
canvas.addEventListener('pointerdown', (e) => {
  touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchPts.size === 2) { pinch = spread(); drag = null; return; } // two fingers: zoom, not look
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (touchPts.has(e.pointerId)) touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touchPts.size >= 2) { const d = spread(); G.cam.zoom = clamp(G.cam.zoom * (pinch / d), 0.45, 2.8); pinch = d; return; }
  if (!drag || drag.id !== e.pointerId) return;
  G.cam.yaw -= (e.clientX - drag.x) * 0.006; G.cam.pitch = clamp(G.cam.pitch + (e.clientY - drag.y) * 0.004, 0.06, 1.2);
  drag.x = e.clientX; drag.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => { touchPts.delete(e.pointerId); if (touchPts.size < 2) pinch = 0; drag = null; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); G.cam.zoom = clamp(G.cam.zoom * (1 + Math.sign(e.deltaY) * 0.1), 0.45, 2.8); }, { passive: false });
// a phone call or a switch to another app pauses the fight
document.addEventListener('visibilitychange', () => { if (document.hidden && !G.paused && (G.state === 'battle' || G.state === 'boarding')) A.tap('p'); });
canvas.addEventListener('dblclick', () => (G.cam.yaw = 0));


// ---------- each frame ----------
const hush0 = (now) => now === 'intro' && G.mode === 'campaign';
// after each tick of the rules: ships to where the game has them, then the effects, the camera, the sea and the HUD
function frame(dt) {
  const p = G.player, now = G.state;
  const home = now === 'title' || now === 'port' || now === 'won' || now === 'story';
  for (const v of views.values()) v.sync(dt, world);
  if (home) harbor.update(dt);
  else for (const s of G.ships) shipFx(s, dt);
  balls(dt);
  fx.update(dt);
  updateCamera(dt);
  worldView.update(dt, camera.position);
  worldView.updateStreaks(dt, home ? harbor.focus : p.pos);
  worldView.updateFeatures(dt, home ? harbor.focus : p.pos);
  if (now === 'battle' || now === 'boarding' || now === 'ending') updateHUD(dt);
  else { for (const s of G.ships) if (s.arcs) s.arcs.grp.visible = false; windRing.visible = boardRing.visible = false; if ($('pips').firstChild) updatePips(p, false); }
  if (now === 'boarding') updateMelee();
  if (now === 'port') updatePortUI();
  updateFloaters(dt);
  if (__PLAYTEST__) PT.tick();
}

const foesOf = (s) => A.foesOf(s), sep = (a, b) => A.sep(a, b), relSpeed = (a, b) => A.relSpeed(a, b), inArc = (...a) => A.inArc(...a);
const strength = (s) => A.strength(s), readiness = (s) => A.readiness(s), prize = (e) => A.prize(e);

// The view the game draws through (see V in game.js).
export const VIEW = {
  on: true, fx, sfx, store, camVol,
  attach(g) {
    G = g; A = g.api; world = g.world;
    worldView = new WorldView(scene, world);
    keys = A.keys;
    G.view = { renderer, scene, camera, world: worldView, frame, views };
  },
  toast, floater, addShip, dropShip, showShip, addBall, dropBall, target, zones, coach, ammoTip,
  works: scenery,
  mode: (m) => setMode(m),
  screen: (h, c) => showScreen(h, c), hideScreen: () => hideScreen(),
  legCard: (h) => showLegCard(h), intro: (es) => showIntro(es), battle: () => battleHud(),
  leavePort: () => { harbor.group.visible = false; for (const t of G.trophyShips) showShip(t, false); },
  harbour: (place) => useHarbor(place),
  title: (saved) => showTitle(saved), result: (r) => showResult(r), final: (acc) => showFinal(acc),
  offersCard: (c) => offersCard(c), pause: (on) => pause(on),
  port: () => showPort(), renderPort: () => renderPort(), names: () => setupHudNames(),
  snapCamera: () => snapCamera(), later: (ms, fn) => setTimeout(fn, ms),
  act, tap, keys,
};
