import { wrap, clamp } from './util.js';
import { Vec3 } from './vec.js';
import { gunsOf } from './hull.js';

export { wrap, clamp };

// Speed fraction by angle off dead-downwind (deg).
// Close-hauled (about 115 to 145 degrees) is slow but workable; the wedge nearer the wind still stops her.
const POLAR = [[0, 0.76], [45, 1], [90, 0.9], [115, 0.74], [130, 0.55], [145, 0.22], [160, 0.06], [180, 0.02]];
// How a hull carries way and answers her helm. Each is one dial, so the feel can be tuned a piece at a time.
export const HANDLING = {
  gather: 0.42, // how quickly she gathers way toward what her sails give (per second, before mass)
  shed: 0.3, // how quickly she loses way when her sails give less: low numbers carry way through a tack
  helmAt: 0.3, // the share of her top speed at which she answers her helm fully
  helmFloor: 0.28, // how much helm she keeps with no way on, for a brig in a breeze (she can back a sail to pay off);
  // lighter hulls keep more, heavier less, and in a calm none: there the spring is the only way round
  drag: 0.06, // way lost per second with the helm hard over, for a brig; heavier hulls lose more
  spring: 0.2, // how fast the spring hauls her round at anchor (not while the anchor is coming up)
  rudder: 1.22, // how fast any hull turns at full way, times her own turn
  lightAir: [0.4, 0.4], // speed in light airs goes as strength ** (a + b * mass): heavy hulls need a breeze to move
  leeway: 1.6, // yd/s she slides to leeward broadside-on with no way on, for a brig in a breeze; way on and a deep keel cut it
  backing: 1, // yd/s she is pushed straight downwind when head to wind with no way on (in irons, her sails aback)
};
export const helmFloor = (mass) => clamp(HANDLING.helmFloor / mass ** 1.5, 0.06, 0.4);
// Sail settings: more canvas is faster; less is a steadier gun platform, harder to dismast, and turns tighter only
// because she is going slower. Canvas also drives her round when she has no way on, so a ship with her sails shot
// away, or furled, answers her helm worse when she is slow.
export const SAILS = [
  { name: 'Furled', spd: 0, aim: 0.8, dmg: 0.3 },
  { name: 'Reefed', spd: 0.4, aim: 0.8, dmg: 0.5 },
  { name: 'Battle sails', spd: 0.7, aim: 1, dmg: 0.75 },
  { name: 'Full sail', spd: 1, aim: 1.3, dmg: 1.15 },
];
// how much her canvas is pulling, 1 for whole battle sails: furled 0, chain-shot rags about half
export const drive = (s) => Math.min(1.2, SAILS[s.sailLevel].spd / 0.7) * (0.25 + 0.75 * s.sailR);
// wind strength as a hull feels it: light airs move a light hull, barely stir a heavy one; a gale adds a little
export const windFor = (str, mass) => (str <= 1 ? Math.max(0, str) ** (HANDLING.lightAir[0] + HANDLING.lightAir[1] * mass) : 1 + (str - 1) * 0.3);
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
    const guns = gunsOf(spec);
    this.muzzles = guns.muzzles; this.mastH = guns.mastH; // where her guns are, and how tall her rig: see hull.js
    this.pos = new Vec3(); this.y = 0; this.heading = 0; this.speed = 0; this.rudder = 0;
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
    this.ramCd = 0; this.fxT = 0;
    this.target = null; this.rigT = 0;
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
    if (!this.spec.oars || !this.oar || this.spent) return 0;
    const fresh = 0.75 + 0.25 * clamp(this.stamina / 0.4, 0, 1); // a tiring crew pulls a slower stroke
    return this.spec.oars * (this.oar === 2 ? 1 : 0.62) * fresh * (0.3 + 0.7 * this.crewR) * ((world.wind.str ?? 1) > 1.3 ? 0.5 : 1);
  }
  toWorld(local, out = new Vec3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    return out.set(this.pos.x + local.x * c + local.z * s, this.y + local.y, this.pos.z - local.x * s + local.z * c);
  }
  toLocal(p, out = new Vec3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading), dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    return out.set(dx * c - dz * s, p.y - this.y, dx * s + dz * c);
  }
  maxSpeedNow(world) {
    const off = wrap(this.heading - world.wind.dir);
    const str = world.strAt ? world.strAt(this.pos.x, this.pos.z) : world.wind.str ?? 1, windF = windFor(str, this.mass);
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
      this.speed += (tgt - this.speed) * Math.min(1, (dt * (held ? 2.2 : tgt > this.speed ? (rowing ? 0.8 : HANDLING.gather) : HANDLING.shed)) / m ** 0.8);
      this.rudder += clamp(this.input.turn - this.rudder, -dt * 2.2, dt * 2.2);
      const str = world.strAt ? world.strAt(this.pos.x, this.pos.z) : world.wind.str ?? 1;
      const floor = helmFloor(m) * clamp(str, 0, 1) * drive(this), way = floor + (1 - floor) * clamp(this.speed / (HANDLING.helmAt * sp.speed), 0, 1);
      // the hull swings toward the rate the rudder asks for; a heavy hull takes longer to start and to stop swinging.
      // At anchor she is hauled round on a spring, slowly but whatever the wind; aground she does not answer at all.
      const rate = this.aground > 0 ? 0 : this.anchored ? (this.weighT > 0 ? 0 : (this.rudder * HANDLING.spring * (0.35 + 0.65 * this.crewR)) / this.mass ** 0.7) : this.rudder * sp.turn * Math.max(way, rowing ? 0.75 : 0) * HANDLING.rudder;
      this.yaw += (rate - this.yaw) * Math.min(1, dt / (0.35 * m));
      this.heading = wrap(this.heading + this.yaw * dt);
      this.speed *= 1 - Math.abs(this.rudder) * HANDLING.drag * m * dt;
      if (this.aground > 0) this.aground = Math.max(0, this.aground - dt);
      this.offT -= dt;
      if (this.weighT > 0 && (this.weighT -= dt) <= 0) this.anchored = false;
      if (sp.oars) {
        // sprinting spends the oarsmen fast, rowing slowly; resting brings them back. Spent, they stop until they have their breath
        const resting = held || this.oar === 0 || this.spent;
        this.stamina = clamp(this.stamina + dt * (resting ? 0.05 : this.oar === 2 ? -0.045 : -0.0015), 0, 1);
        if (!this.spent && this.stamina <= 0 && this.oar) this.spent = true;
        else if (this.spent && this.stamina >= 0.35) this.spent = false;
      }
      // carrying full sail in a gale tears it
      if ((world.wind.str ?? 1) > 1.3 && this.sailLevel === TOP && !held) { this.sails = Math.max(0, this.sails - 0.9 * dt); this.rigT = 0; }
      // leeway: the wind pushes her to leeward, hardest close-hauled (her canvas pulls more sideways than ahead) and
      // when she is slow (her keel has no grip without way on); head to wind with her sails aback it pushes her astern.
      // High sides and tall rigs catch more wind; a deep keel holds her. It grows with the wind as her speed does, so
      // her leeway angle is the same in light airs, a breeze or a gale.
      if (!held && str > 0) {
        const wf = windFor(str, m), off = wrap(this.heading - world.wind.dir), ref = 0.35 * sp.speed * Math.max(wf * SAILS[this.sailLevel].spd, 0.1), slow = 1 / (1 + this.speed / ref), wd = sp.windage ?? 1;
        const side = HANDLING.leeway * wf * (wd / (sp.grip ?? 1)) * Math.abs(Math.sin(off)) * (1 - Math.cos(off)) * slow * (0.5 + 0.5 * drive(this));
        const back = HANDLING.backing * wf * wd * ((1 - Math.cos(off)) / 2) ** 2 * clamp(1 - this.speed / ref, 0, 1) * (0.4 + 0.6 * drive(this));
        const lx = Math.sin(world.wind.dir), lz = Math.cos(world.wind.dir), px = this.fwdZ, pz = -this.fwdX, sgn = Math.sign(px * lx + pz * lz) || 1;
        this.drift = [px * sgn * side + lx * back, pz * sgn * side + lz * back];
        this.pos.x += this.drift[0] * dt; this.pos.z += this.drift[1] * dt;
      } else this.drift = null;
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
    this.float(world);
  }

  // how high she rides on the waves (and how low, sinking): shot meets her hull where it is
  float(world) {
    if (this.spec.fixed) { this.y = 0; return; }
    const L = this.spec.L, fx = this.fwdX, fz = this.fwdZ;
    const hb = world.height(this.pos.x + fx * L * 0.35, this.pos.z + fz * L * 0.35);
    const hs = world.height(this.pos.x - fx * L * 0.35, this.pos.z - fz * L * 0.35);
    let y = (hb + hs) * 0.5 * 0.85;
    if (this.aground > 0) y += 0.4;
    if (this.sinking > 0) { const k = this.sinking; y -= k * k * 0.22; }
    this.y = y;
  }
}
