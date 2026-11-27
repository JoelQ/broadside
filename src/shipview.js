import * as THREE from 'three';
import { wrap, clamp } from './geo.js';
import { buildShipModel } from './model.js';
import { buildFortModel } from './fort.js';
import { CrewFigures } from './crew.js';
import { SAILS, polar } from './ship.js';

// A ship drawn: her model, her crew on deck, her rig braced to the wind and her flag, following a Ship (ship.js),
// which holds the rules. sync() is called after every tick of the rules.
export class ShipView {
  constructor(ship) {
    this.ship = ship;
    this.model = ship.spec.fixed ? buildFortModel(ship.spec) : buildShipModel(ship.spec);
    this.group = this.model.group;
    this.roll = 0; this.sailTier = 0;
    this.figs = ship.spec.fixed ? null : new CrewFigures(ship, this.model);
  }
  sync(dt, world) {
    const s = this.ship;
    const g = this.group, L = s.spec.L, fx = s.fwdX, fz = s.fwdZ;
    const hb = world.height(s.pos.x + fx * L * 0.35, s.pos.z + fz * L * 0.35);
    const hs = world.height(s.pos.x - fx * L * 0.35, s.pos.z - fz * L * 0.35);
    const hp = world.height(s.pos.x + fz * 4, s.pos.z - fx * 4), hq = world.height(s.pos.x - fz * 4, s.pos.z + fx * 4);
    const relWind = wrap(world.wind.dir - s.heading);
    const set = SAILS[s.sailLevel].spd;
    let roll = (hp - hq) / 8 * 0.6 - s.rudder * clamp(s.speed / 12, 0, 1) * 0.07 + Math.sin(relWind) * 0.05 * set;
    let y = (hb + hs) * 0.5 * 0.85, pitch = -Math.atan2(hb - hs, L * 0.7) * 0.8;
    if (s.aground > 0 && !s.spec.fixed) { roll += 0.13 * (s.spec.seedSign || 1); pitch -= 0.05; y += 0.4; }
    if (s.sinking > 0) {
      const k = s.sinking;
      y -= k * k * 0.22; roll += Math.min(0.6, k * 0.09) * (s.spec.seedSign || 1); pitch += Math.min(0.35, k * 0.04);
    }
    if (s.spec.fixed) { g.position.set(s.pos.x, 0, s.pos.z); g.rotation.set(0, s.heading, 0); this.model.flag.visible = !s.struck; return; }
    this.roll += (roll - this.roll) * Math.min(1, dt * 3);
    g.position.set(s.pos.x, s.y, s.pos.z); // the sim works out how she rides (Ship.float)
    g.rotation.set(pitch, s.heading, this.roll, 'YXZ');

    // rig: brace yards to the wind, furl by sail level, tatter by damage
    const brace = clamp(Math.sin(relWind) * 0.85, -0.8, 0.8) * (Math.cos(relWind) > -0.5 ? 1 : 0.5);
    for (const yd of this.model.yards) yd.rotation.y += (brace - yd.rotation.y) * Math.min(1, dt * 1.5);
    const swing = clamp(-Math.sin(relWind) * 0.5, -0.45, 0.45) * (0.4 + 0.6 * set);
    for (const bm of this.model.booms) bm.rotation.y += (swing - bm.rotation.y) * Math.min(1, dt * 1.5);
    const fill = 0.35 + 0.65 * polar(wrap(s.heading - world.wind.dir)) + Math.sin(world.time * 3 + s.pos.x) * 0.04;
    const tier = s.sailR > 0.66 ? 0 : s.sailR > 0.3 ? 1 : 2;
    const gone = s.sailR <= 0.02;
    const lee = clamp(Math.sin(relWind) * 5, -1, 1), draw = 0.3 + 0.7 * fill;
    const lv = s.sailLevel;
    this.model.sails.forEach((m, i) => {
      const u = m.userData;
      const want = u.fa ? (lv >= 2 ? 1 : lv === 1 ? 0.5 : 0.08) : lv === 3 ? 1 : lv === 2 ? (u.course ? 0.1 : 1) : lv === 1 ? (u.course ? 0.1 : 0.5) : 0.1;
      u.furl += (want - u.furl) * Math.min(1, dt * 1.6);
      u.lee = (u.lee || 0) + (lee - (u.lee || 0)) * Math.min(1, dt * 2); // fore-and-aft canvas bellies to leeward
      if (u.jib) { m.scale.x = u.lee * draw; m.visible = lv > 1 && !gone; }
      else if (u.fa) { m.scale.set(u.lee * draw, u.furl, 1); m.visible = !gone; }
      else { m.scale.set(1, u.furl, (0.25 + 0.75 * fill) * (0.12 + 0.88 * u.furl)); m.visible = !(gone && i % 2 === 0); }
      if (tier !== this.sailTier) m.material = this.model.mats[tier][u.emblem];
    });
    this.sailTier = tier;
    const fl = this.model.flag;
    fl.visible = !s.struck;
    fl.rotation.y = relWind - Math.PI / 2;
    const fp = fl.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin(x * 2.2 - world.time * 9) * 0.12 * x); }
    fp.needsUpdate = true;
    this.figs.update(dt, world.time, s.boardView || null);
    // at anchor: the cable runs from the bow down into the water, with the spring led aft
    if (s.anchored && !this.cable) {
      const L = s.spec.L, g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.5, L * 0.48), new THREE.Vector3(0, -4, L * 0.48 + 16), new THREE.Vector3(s.spec.B * 0.4, 2.2, -L * 0.3)]);
      this.cable = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x2a1e12 })); this.group.add(this.cable);
    }
    if (this.cable) this.cable.visible = s.anchored;
    if (this.model.oars) {
      // the oars: a long pull and a quick recovery when rowing, shipped level when resting
      const on = s.oar && !s.spent && !s.anchored && s.aground <= 0 && s.sinking <= 0 && !s.struck;
      this.oarPh = (this.oarPh || 0) + dt * (on ? (s.oar === 2 ? 5.2 : 3.2) * (0.6 + 0.4 * clamp(s.stamina / 0.4, 0, 1)) : 0);
      const sw = on ? Math.sin(this.oarPh) * 0.42 : 0, lift = on ? Math.max(0, Math.cos(this.oarPh)) * 0.16 : 0.2;
      for (const o of this.model.oars) { const e = o.matrix.elements, sx = o.userData.sx; e[2] = sw * sx; e[1] = lift * sx; }
    }
  }
}
