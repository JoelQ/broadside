import * as THREE from 'three';
import { wrap, clamp } from './geo.js';
import { buildShipModel } from './model.js';
import { buildFortModel } from './fort.js';
import { CrewFigures } from './crew.js';

export { wrap, clamp };

// Speed fraction by angle off dead-downwind (deg).
const POLAR = [[0, 0.76], [45, 1], [90, 0.88], [115, 0.66], [135, 0.4], [150, 0.14], [180, 0.02]];
// Sail settings: more canvas is faster, less is a steadier gun platform that turns tighter and is harder to dismast.
export const SAILS = [
  { name: 'Furled', spd: 0, turn: 1, aim: 0.8, dmg: 0.3 },
  { name: 'Reefed', spd: 0.4, turn: 1.12, aim: 0.8, dmg: 0.5 },
  { name: 'Battle sails', spd: 0.7, turn: 1.22, aim: 1, dmg: 0.75 },
  { name: 'Full sail', spd: 1, turn: 0.85, aim: 1.3, dmg: 1.15 },
];
export const TOP = SAILS.length - 1;
// `point` (radians) is how much closer to the wind a rig can sail than a square-rigger.
export function polar(a, point = 0) {
  let d = (Math.abs(a) * 180) / Math.PI;
  d -= ((point * 180) / Math.PI) * clamp((d - 60) / 60, 0, 1);
  for (let i = 1; i < POLAR.length; i++) {
    if (d <= POLAR[i][0]) {
      const [a0, v0] = POLAR[i - 1], [a1, v1] = POLAR[i];
      return v0 + ((v1 - v0) * (d - a0)) / (a1 - a0);
    }
  }
  return 0.05;
}
export function pointOfSail(a, point = 0) {
  const d = (Math.abs(a) * 180) / Math.PI - (point * 180) / Math.PI;
  if (d > 148) return 'In irons';
  if (d > 118) return 'Close-hauled';
  if (d > 75) return 'Beam reach';
  if (d > 25) return 'Broad reach';
  return 'Running';
}

export const AMMO = {
  round: { name: 'Round', long: 'Round shot', range: 250, speed: 128, hull: 6.2, sail: 0.6, crew: 0.3, reload: 1, tip: 'Smashes hulls at long range' },
  chain: { name: 'Chain', long: 'Chain shot', range: 175, speed: 108, hull: 1, sail: 4.5, crew: 0.1, reload: 1, tip: 'Shreds sails. Grapples only hold a ship that has been slowed' },
  grape: { name: 'Grape', long: 'Grapeshot', range: 100, speed: 98, hull: 0.6, sail: 0.5, crew: 0, kills: [2, 4], reload: 0.9, tip: 'Kills the crew on deck. The hatched part of her crew bar is below, out of reach' },
  fire: { name: 'Heated', long: 'Heated shot', range: 185, speed: 112, hull: 4.2, sail: 2, crew: 0.2, ignite: 0.4, reload: 1.3, tip: 'Starts fires. The bigger the ship the more there is to burn, and she loads at half speed while it lasts' },
};
export const AMMO_KEYS = ['round', 'chain', 'grape', 'fire'];
// Gun weight. Heavier guns reach further and hit harder, and take longer to load.
export const CAL = [
  { name: 'light', pdr: '6-pdr', range: 0.8, dmg: 0.7, reload: 0.72 },
  { name: 'medium', pdr: '12-pdr', range: 1, dmg: 1, reload: 1 },
  { name: 'heavy', pdr: '24-pdr', range: 1.22, dmg: 1.45, reload: 1.4 },
];
// Mass, relative to a brig. Heavy ships gather way, lose way and answer the helm slowly.
export const massOf = (spec) => clamp(Math.sqrt((spec.L * spec.B) / 240) * 0.95 + 0.05, 0.6, 2.3);
export const noGoHalf = (spec) => Math.max(0.2, 0.6 - (spec.point || 0)); // half-width of the no-sail wedge
export const JURY = 0.34; // sails jury-rig back to this fraction
export const BELOW = 0.3; // share of a crew below decks, out of reach of gunfire // broadside half-angle (rad)

// ---------- ship simulation ----------
export class Ship {
  constructor(spec, isPlayer) {
    this.spec = spec; this.isPlayer = isPlayer;
    this.model = spec.fixed ? buildFortModel(spec) : buildShipModel(spec);
    this.group = this.model.group;
    this.pos = new THREE.Vector3(); this.heading = 0; this.speed = 0; this.rudder = 0;
    this.input = { turn: 0 };
    this.sailLevel = TOP;
    this.hullMax = this.hull = spec.hull; this.sailsMax = this.sails = spec.sails; this.crewMax = this.crew = spec.crew;
    // batteries: a broadside on each beam, and on a galley or a fort a battery that fires ahead
    const cal0 = CAL[spec.cal ?? 1];
    this.bat = {};
    if (spec.guns > 0) { this.bat.port = { cal: cal0, arc: spec.arc || 0.5, dir: Math.PI / 2 }; this.bat.stbd = { cal: cal0, arc: spec.arc || 0.5, dir: -Math.PI / 2 }; }
    if (spec.bow) this.bat.bow = { cal: CAL[spec.bow.cal ?? spec.cal ?? 1], arc: spec.bow.arc || 0.24, dir: 0 };
    this.sides = Object.keys(this.bat);
    this.main = this.bat[spec.bow && (spec.bow.main || !spec.guns) ? 'bow' : this.sides[0]];
    this.reload = {}; this.reloadMax = {};
    for (const k of this.sides) { this.reload[k] = 0; this.reloadMax[k] = 1; }
    this.side = isPlayer ? 0 : 1; this.ai = null; this.grapple = 0; this.out = null;
    this.oar = spec.oars ? 1 : 0; this.stamina = 1; this.anchored = !!spec.anchored; this.aground = 0; this.offT = 0; this.weighT = 0;
    this.ammo = 'round';
    this.stock = { chain: 0, grape: 0, fire: 0, ...(spec.stock || {}) };
    this.fire = 0; this.fireT = 0;
    this.cal = this.main.cal; this.arc = this.main.arc; this.mass = massOf(spec); this.yaw = 0;
    this.dmgMult = spec.dmg || 1; this.disp = spec.disp || 0.022; this.reloadMult = 1; this.melee = spec.melee || 1;
    this.sinking = 0; this.dead = false; this.struck = false;
    this.ramCd = 0; this.sailTier = 0; this.roll = 0; this.fxT = 0;
    this.target = null; this.rigT = 0;
    this.figs = spec.fixed ? null : new CrewFigures(this);
  }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }
  get hullR() { return clamp(this.hull / this.hullMax, 0, 1); }
  get sailR() { return clamp(this.sails / this.sailsMax, 0, 1); }
  get crewR() { return clamp(this.crew / this.crewMax, 0, 1); }
  get exposed() { return Math.max(0, this.crew - this.crewMax * BELOW); } // men a broadside can reach
  get active() { return !this.out && this.sinking <= 0 && !this.struck; } // still in the fight
  range(ammo = this.ammo, side) { return AMMO[ammo].range * (this.bat[side] || this.main).cal.range * (this.spec.reach || 1); }
  dmgOf(side) { return this.dmgMult * (this.bat[side] || this.main).cal.dmg; }
  normal(side) { return this.heading + this.bat[side].dir; }
  reloadTime(ammo = this.ammo, side) {
    return (this.spec.reload * (this.bat[side] || this.main).cal.reload * AMMO[ammo].reload * this.reloadMult) / (0.45 + 0.55 * this.crewR);
  }
  startReload(side, frac = 1) { this.reload[side] = this.reloadMax[side] = this.reloadTime(this.ammo, side) * frac; }
  setAmmo(a) {
    if (a === this.ammo) return false;
    if (a !== 'round' && this.stock[a] <= 0) return false;
    this.ammo = a;
    if (!this.quickShot) for (const s of this.sides) if (this.reload[s] <= 0) this.startReload(s, 0.6); // a good gunner draws the charge without losing the load
    return true;
  }
  // oars: 0 rest, 1 row, 2 sprint. Speed under oars owes nothing to the wind; only a gale troubles it.
  oarSpeed(world) {
    if (!this.spec.oars || !this.oar) return 0;
    const tired = this.oar === 2 && this.stamina <= 0.02;
    return this.spec.oars * (this.oar === 2 && !tired ? 1 : 0.62) * (0.3 + 0.7 * this.crewR) * ((world.wind.str ?? 1) > 1.3 ? 0.5 : 1);
  }
  toWorld(local, out = new THREE.Vector3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    return out.set(this.pos.x + local.x * c + local.z * s, this.group.position.y + local.y, this.pos.z - local.x * s + local.z * c);
  }
  toLocal(p, out = new THREE.Vector3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading), dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    return out.set(dx * c - dz * s, p.y - this.group.position.y, dx * s + dz * c);
  }
  maxSpeedNow(world) {
    const off = wrap(this.heading - world.wind.dir);
    const str = world.wind.str ?? 1, windF = str <= 1 ? str : 1 + (str - 1) * 0.3; // a gale adds less than it takes from the gunnery
    const v = this.spec.speed * SAILS[this.sailLevel].spd * polar(off, this.spec.point) * (0.25 + 0.75 * this.sailR) * (this.hullR < 0.3 ? 0.82 : 1) * windF;
    const s = this.sailLevel > 0 ? Math.max(v, (this.spec.sweeps || 0) * this.crewR) : v; // sweeps: oars give a floor under the wind
    return Math.max(s, this.oarSpeed(world));
  }

  update(dt, world, frozen) {
    const sp = this.spec;
    if (this.sinking > 0) {
      this.sinking += dt; this.speed *= Math.max(0, 1 - dt);
    } else if (sp.fixed) {
      if (!frozen) for (const s of this.sides) if (this.reload[s] > 0) this.reload[s] = Math.max(0, this.reload[s] - dt * (this.fire > 0 ? 0.5 : 1));
    } else if (!frozen) {
      const held = this.anchored || this.aground > 0;
      const oars = this.oarSpeed(world), tgt = this.struck || held ? 0 : this.maxSpeedNow(world);
      const m = this.mass, rowing = oars > 0 && oars >= tgt - 0.01;
      this.speed += (tgt - this.speed) * Math.min(1, (dt * (held ? 2.2 : tgt > this.speed ? (rowing ? 0.8 : 0.42) : 0.7)) / m ** 0.8);
      this.rudder += clamp(this.input.turn - this.rudder, -dt * 2.2, dt * 2.2);
      const way = 0.3 + 0.7 * clamp(this.speed / (0.45 * sp.speed), 0, 1);
      // the hull swings toward the rate the rudder asks for; a heavy hull takes longer to start and to stop swinging.
      // At anchor she is hauled round on a spring, slowly but whatever the wind; aground she does not answer at all.
      const rate = this.aground > 0 ? 0 : this.anchored ? this.rudder * 0.12 : this.rudder * sp.turn * Math.max(way, rowing ? 0.75 : 0) * SAILS[this.sailLevel].turn;
      this.yaw += (rate - this.yaw) * Math.min(1, dt / (0.35 * m));
      this.heading = wrap(this.heading + this.yaw * dt);
      this.speed *= 1 - Math.abs(this.rudder) * 0.07 * dt;
      if (this.aground > 0) this.aground = Math.max(0, this.aground - dt);
      this.offT -= dt;
      if (this.weighT > 0 && (this.weighT -= dt) <= 0) this.anchored = false;
      if (sp.oars) this.stamina = clamp(this.stamina + dt * (held || this.oar === 0 ? 0.045 : this.oar === 2 ? -0.03 : 0.006), 0, 1);
      // carrying full sail in a gale tears it
      if ((world.wind.str ?? 1) > 1.3 && this.sailLevel === TOP && !held) { this.sails = Math.max(0, this.sails - 0.9 * dt); this.rigT = 0; }
      if (!held && world.currentAt) { const c = world.currentAt(this.pos.x, this.pos.z); this.pos.x += c[0] * dt; this.pos.z += c[1] * dt; }
      // while a ship burns her gun crews are fighting the fire: she loads at half speed
      for (const s of this.sides) if (this.reload[s] > 0) this.reload[s] = Math.max(0, this.reload[s] - dt * (this.fire > 0 ? 0.5 : 1));
    } else {
      this.speed *= Math.max(0, 1 - dt * 2);
    }
    this.pos.x += this.fwdX * this.speed * dt; this.pos.z += this.fwdZ * this.speed * dt;
    this.ramCd -= dt;
    // a crew left alone for a few seconds jury-rigs torn canvas back to about a third
    this.rigT += dt;
    if (this.rigT > 4 && this.sinking <= 0 && this.sails < this.sailsMax * JURY) this.sails = Math.min(this.sailsMax * JURY, this.sails + 1.4 * dt);
    this.syncVisual(dt, world);
  }

  syncVisual(dt, world) {
    const g = this.group, L = this.spec.L, fx = this.fwdX, fz = this.fwdZ;
    const hb = world.height(this.pos.x + fx * L * 0.35, this.pos.z + fz * L * 0.35);
    const hs = world.height(this.pos.x - fx * L * 0.35, this.pos.z - fz * L * 0.35);
    const hp = world.height(this.pos.x + fz * 4, this.pos.z - fx * 4), hq = world.height(this.pos.x - fz * 4, this.pos.z + fx * 4);
    const relWind = wrap(world.wind.dir - this.heading);
    const set = SAILS[this.sailLevel].spd;
    let roll = (hp - hq) / 8 * 0.6 - this.rudder * clamp(this.speed / 12, 0, 1) * 0.07 + Math.sin(relWind) * 0.05 * set;
    let y = (hb + hs) * 0.5 * 0.85, pitch = -Math.atan2(hb - hs, L * 0.7) * 0.8;
    if (this.sinking > 0) {
      const k = this.sinking;
      y -= k * k * 0.22; roll += Math.min(0.6, k * 0.09) * (this.spec.seedSign || 1); pitch += Math.min(0.35, k * 0.04);
    }
    if (this.spec.fixed) { g.position.set(this.pos.x, 0, this.pos.z); g.rotation.set(0, this.heading, 0); if (!world.fast) this.model.flag.visible = !this.struck; return; }
    this.roll += (roll - this.roll) * Math.min(1, dt * 3);
    g.position.set(this.pos.x, y, this.pos.z);
    g.rotation.set(pitch, this.heading, this.roll, 'YXZ');
    if (world.fast) return;

    // rig: brace yards to the wind, furl by sail level, tatter by damage
    const brace = clamp(Math.sin(relWind) * 0.85, -0.8, 0.8) * (Math.cos(relWind) > -0.5 ? 1 : 0.5);
    for (const yd of this.model.yards) yd.rotation.y += (brace - yd.rotation.y) * Math.min(1, dt * 1.5);
    const swing = clamp(-Math.sin(relWind) * 0.5, -0.45, 0.45) * (0.4 + 0.6 * set);
    for (const bm of this.model.booms) bm.rotation.y += (swing - bm.rotation.y) * Math.min(1, dt * 1.5);
    const fill = 0.35 + 0.65 * polar(wrap(this.heading - world.wind.dir)) + Math.sin(world.time * 3 + this.pos.x) * 0.04;
    const tier = this.sailR > 0.66 ? 0 : this.sailR > 0.3 ? 1 : 2;
    const gone = this.sailR <= 0.02;
    const lee = clamp(Math.sin(relWind) * 5, -1, 1), draw = 0.3 + 0.7 * fill;
    this.model.sails.forEach((s, i) => {
      const u = s.userData, lv = this.sailLevel;
      const want = u.fa ? (lv >= 2 ? 1 : lv === 1 ? 0.5 : 0.08) : lv === 3 ? 1 : lv === 2 ? (u.course ? 0.1 : 1) : lv === 1 ? (u.course ? 0.1 : 0.5) : 0.1;
      u.furl += (want - u.furl) * Math.min(1, dt * 1.6);
      u.lee = (u.lee || 0) + (lee - (u.lee || 0)) * Math.min(1, dt * 2); // fore-and-aft canvas bellies to leeward
      if (u.jib) { s.scale.x = u.lee * draw; s.visible = lv > 1 && !gone; }
      else if (u.fa) { s.scale.set(u.lee * draw, u.furl, 1); s.visible = !gone; }
      else { s.scale.set(1, u.furl, (0.25 + 0.75 * fill) * (0.12 + 0.88 * u.furl)); s.visible = !(gone && i % 2 === 0); }
      if (tier !== this.sailTier) s.material = this.model.mats[tier][u.emblem];
    });
    this.sailTier = tier;
    const fl = this.model.flag;
    fl.visible = !this.struck;
    fl.rotation.y = relWind - Math.PI / 2;
    const fp = fl.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin(x * 2.2 - world.time * 9) * 0.12 * x); }
    fp.needsUpdate = true;
    this.figs.update(dt, world.time, this.boardView || null);
    if (this.model.oars) {
      // the oars: a long pull and a quick recovery when rowing, shipped level when resting
      const on = this.oar && !this.anchored && this.aground <= 0 && this.sinking <= 0 && !this.struck;
      this.oarPh = (this.oarPh || 0) + dt * (on ? (this.oar === 2 ? 5.2 : 3.2) : 0);
      const sw = on ? Math.sin(this.oarPh) * 0.42 : 0, lift = on ? Math.max(0, Math.cos(this.oarPh)) * 0.16 : 0.2;
      for (const o of this.model.oars) { const e = o.matrix.elements, sx = o.userData.sx; e[2] = sw * sx; e[1] = lift * sx; }
    }
  }
}
