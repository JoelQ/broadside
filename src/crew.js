import * as THREE from 'three';
import { wrap, clamp } from './geo.js';
import { halfWidth, deckLevel } from './model.js';

// Little people. One instanced mesh draws a whole crowd; arms and legs swing in the vertex
// shader, so a figure costs one matrix and one pose however it moves.
const SKIN = [0xe0ac82, 0xc68a5e, 0x9a6a44, 0xf0c8a0], PANTS = [0xd8cfb8, 0x2a3040, 0x5a4632, 0x8a8272, 0x3a3a3a];
let base = null;
function figureParts() {
  if (base) return base;
  const pos = [], col = [], tint = [], limb = [], kind = [], c = new THREE.Color();
  // tint: 0 fixed colour, 1 shirt, 2 trousers, 3 skin. limb: 1/2 left/right arm, 3/4 left/right leg.
  // kind: 0 always drawn, 1-4 one of the hats, 9 a cutlass drawn only in a fight.
  const part = (w, h, d, x, y, z, colour, tn = 0, lm = 0, kd = 0) => {
    const p = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed().attributes.position;
    c.set(colour);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.r, c.g, c.b); tint.push(tn); limb.push(lm); kind.push(kd); }
  };
  for (const s of [1, -1]) {
    part(0.2, 0.74, 0.24, s * 0.125, 0.45, 0, 0, 2, s > 0 ? 3 : 4);
    part(0.21, 0.14, 0.33, s * 0.125, 0.07, 0.04, 0x2a1f18, 0, s > 0 ? 3 : 4);
    part(0.15, 0.5, 0.17, s * 0.33, 1.17, 0, 0, 1, s > 0 ? 1 : 2);
    part(0.13, 0.15, 0.15, s * 0.33, 0.85, 0, 0, 3, s > 0 ? 1 : 2);
  }
  part(0.5, 0.1, 0.3, 0, 0.84, 0, 0x2a1f18);
  part(0.5, 0.56, 0.28, 0, 1.16, 0, 0, 1);
  part(0.3, 0.3, 0.3, 0, 1.6, 0, 0, 3);
  part(0.32, 0.12, 0.32, 0, 1.74, -0.01, 0x3a2a1c, 0, 0, 1); // bare head
  part(0.33, 0.13, 0.33, 0, 1.72, 0, 0xa8322a, 0, 0, 2); part(0.1, 0.16, 0.08, 0.08, 1.66, -0.2, 0xa8322a, 0, 0, 2); // kerchief
  part(0.54, 0.05, 0.54, 0, 1.77, 0, 0x1a1a1c, 0, 0, 3); part(0.3, 0.16, 0.3, 0, 1.86, 0, 0x1a1a1c, 0, 0, 3); // cocked hat
  part(0.32, 0.2, 0.32, 0, 1.8, 0, 0, 2, 0, 4); // knitted cap
  part(0.05, 0.7, 0.1, -0.33, 0.42, 0.04, 0xc8ccd0, 0, 2, 9); part(0.16, 0.05, 0.2, -0.33, 0.78, 0.04, 0x8a6a2a, 0, 2, 9); // cutlass
  const f = (a, n) => new THREE.Float32BufferAttribute(a, n);
  return (base = { position: f(pos, 3), color: f(col, 3), aTint: f(tint, 1), aLimb: f(limb, 1), aKind: f(kind, 1) });
}
const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
material.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aTint, aLimb, aKind;
      attribute vec3 iShirt, iPants, iSkin;
      attribute vec4 iPose; // leg swing, left arm, right arm, hat
      attribute float iArmed;`)
    .replace('#include <color_vertex>', `#include <color_vertex>
      vColor.rgb = aTint < 0.5 ? color : aTint < 1.5 ? iShirt : aTint < 2.5 ? iPants : iSkin;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      if (aLimb > 0.5) {
        float ang = aLimb < 1.5 ? iPose.y : aLimb < 2.5 ? iPose.z : aLimb < 3.5 ? iPose.x : -iPose.x;
        float py = aLimb < 2.5 ? 1.38 : 0.82, sn = sin(ang), cs = cos(ang);
        vec2 q = transformed.yz - vec2(py, 0.);
        transformed.yz = vec2(q.x*cs - q.y*sn, q.x*sn + q.y*cs) + vec2(py, 0.);
      }
      if ((aKind > 8.5 && iArmed < 0.5) || (aKind > 0.5 && aKind < 8.5 && abs(aKind - iPose.w) > 0.5)) transformed = vec3(0., 1.5, 0.);`);
};
material.customProgramCacheKey = () => 'figures';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
export class Figures {
  constructor(n, size = 1.6) {
    this.n = n; this.size = size;
    const g = new THREE.BufferGeometry(), b = figureParts();
    for (const k in b) g.setAttribute(k, b[k]);
    const inst = (name, w) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * w), w); g.setAttribute(name, a); return a; };
    this.shirt = inst('iShirt', 3); this.pants = inst('iPants', 3); this.skin = inst('iSkin', 3); this.pose = inst('iPose', 4); this.armed = inst('iArmed', 1);
    this.mesh = new THREE.InstancedMesh(g, material, n);
    this.mesh.frustumCulled = false;
  }
  // clothes for figure i: shirt colour, and a seed that picks trousers, skin and hat
  dress(i, shirt, seed, hat = [1, 2, 2, 4, 1, 2, 3, 4][seed % 8]) {
    _c.set(shirt); this.shirt.setXYZ(i, _c.r, _c.g, _c.b);
    _c.set(PANTS[(seed * 7 + 3) % PANTS.length]); this.pants.setXYZ(i, _c.r, _c.g, _c.b);
    _c.set(SKIN[(seed * 5 + 1) % SKIN.length]); this.skin.setXYZ(i, _c.r, _c.g, _c.b);
    this.pose.setW(i, hat);
  }
  // where figure i stands, which way he faces, and how his limbs are swung (radians, forward is negative)
  put(i, x, y, z, yaw, scale = 1, leg = 0, armL = 0, armR = 0, armed = 0) {
    _q.setFromAxisAngle(_up, yaw); _s.setScalar(Math.max(0.0001, scale) * this.size);
    this.mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s));
    const a = this.pose.array; a[i * 4] = leg; a[i * 4 + 1] = armL; a[i * 4 + 2] = armR;
    this.armed.array[i] = armed;
  }
  commit() { this.mesh.instanceMatrix.needsUpdate = this.pose.needsUpdate = this.armed.needsUpdate = true; }
}

// ---------- a ship's crew on deck ----------
const FIG_MAX = 64, WALK = 3.2;
export class CrewFigures {
  constructor(ship) {
    this.ship = ship;
    const sp = ship.spec;
    this.per = Math.max(2.5, sp.crew / FIG_MAX);
    this.figs = new Figures(FIG_MAX);
    this.mesh = this.figs.mesh;
    const cols = sp.crewCols || [0x7a2a22, 0x2c2c2c, 0x8a6a3a, 0x5a4a3a];
    this.f = [];
    for (let i = 0; i < FIG_MAX; i++) {
      const f = { ph: Math.random() * 6.28, yaw: Math.random() * 6.28, r1: Math.random(), r2: Math.random(), s: 1, step: 0, wait: Math.random() * 20 };
      this.post(f); f.x = f.sx; f.z = f.sz; f.face = f.yaw; f.y = deckLevel(sp, f.z / sp.L + 0.5, ship.model.decks);
      this.f.push(f);
      this.figs.dress(i, cols[i % cols.length], i);
    }
    ship.group.add(this.mesh);
  }
  // somewhere on deck to stand, clear of the hatches and masts down the middle
  post(f) {
    const sp = this.ship.spec, t = 0.16 + Math.random() * 0.68, hw = halfWidth(sp, t) * 0.68, x = (Math.random() - 0.5) * 2 * hw;
    f.sx = Math.abs(x) < 0.9 && hw > 1.6 ? Math.sign(x || 1) * (0.9 + Math.random() * 0.4) : x; f.sz = (t - 0.5) * sp.L;
  }
  // bd (while boarding): { side: local x sign facing the foe, lanes: [men per lane], won: [bool], flip, reach }
  update(dt, time, bd) {
    const ship = this.ship, sp = ship.spec, n = Math.min(FIG_MAX, Math.ceil(ship.crew / this.per));
    let lane = 0, used = 0, quota = bd ? Math.ceil(bd.lanes[0] / this.per) : 0, shown = 0;
    for (let i = 0; i < FIG_MAX; i++) {
      const f = this.f[i];
      // every so often a hand crosses the deck to another job
      if (!bd && (f.wait -= dt) <= 0) { f.wait = 6 + Math.random() * 24; this.post(f); f.yaw = Math.random() * 6.28; }
      let tx = f.sx, tz = f.sz, alive = i < n, fight = 0;
      if (bd && alive) {
        while (lane < 2 && used >= quota) { lane++; used = 0; quota = Math.ceil(bd.lanes[lane] / this.per); }
        if (used >= quota) alive = false;
        else {
          used++;
          const k = bd.flip ? 2 - lane : lane, hw = halfWidth(sp, 0.5);
          tz = (k - 1) * sp.L * 0.27 + (f.r1 - 0.5) * sp.L * 0.2;
          tx = bd.won[lane] ? bd.side * (hw + 1.6 + f.r2 * bd.reach) : bd.side * hw * (0.35 + f.r2 * 0.5);
          fight = 1;
        }
      }
      const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), go = Math.min(d, (fight ? 3 : 1) * WALK * dt), walk = d > 0.05 ? 1 : 0;
      if (d > 0) { f.x += (dx / d) * go; f.z += (dz / d) * go; }
      f.step += go * 2.6;
      f.s += ((alive ? 1 : 0) - f.s) * Math.min(1, dt * 6);
      if (f.s > 0.01) shown = i + 1;
      const t = clamp(f.z / sp.L + 0.5, 0, 1), fighting = fight && !walk, sw = Math.sin(time * 9 + f.ph);
      f.y += (deckLevel(sp, t, ship.model.decks) - f.y) * Math.min(1, dt * 9);
      f.face += wrap((walk ? Math.atan2(dx, dz) : fight ? bd.side * Math.PI / 2 : f.yaw) - f.face) * Math.min(1, dt * 8);
      let leg = Math.sin(f.step) * 0.7 * walk, armL = -leg * 0.8, armR = leg * 0.8;
      if (fighting) { leg = sw * 0.3; armL = -0.5; armR = -1.9 + sw * 0.9; } // cut and parry at the rail
      else if (ship.struck) armL = armR = -2.9; // hands up
      else if (!walk) armL = armR = Math.sin(time * 1.3 + f.ph) * 0.07;
      this.figs.put(i, f.x + (fighting ? bd.side * sw * 0.3 : 0), f.y + (fighting ? Math.abs(sw) * 0.2 : walk ? Math.abs(Math.sin(f.step)) * 0.06 : 0), f.z, f.face, f.s, leg, armL, armR, fight);
    }
    this.mesh.count = shown; // men lost are not drawn at all
    this.figs.commit();
  }
}
