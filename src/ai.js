import { AMMO, ARC, wrap, clamp } from './ship.js';

// Pirate captain: picks ammo, steers for a broadside (or a boarding), fires when the arc bears.
export function updateAI(ai, me, foe, world, dt, api) {
  const P = me.spec.ai;
  const dx = foe.pos.x - me.pos.x, dz = foe.pos.z - me.pos.z;
  const dist = Math.hypot(dx, dz), bearing = Math.atan2(dx, dz);
  const upwind = world.wind.dir + Math.PI;

  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 1.2 + Math.random();
    const adv = me.crew / Math.max(1, foe.crew);
    ai.wantBoard = ((P.boarder && adv > 1.05) || (adv > 2.2 && foe.crewR < 0.5 && dist < 150)) && me.crew > 12;
    // ammo doctrine
    let a = 'round';
    const st = me.stock;
    if (ai.wantBoard) {
      if (st.grape > 0 && dist < 125) a = 'grape';
      else if (st.chain > 0 && foe.sailR > 0.45 && dist < 190) a = 'chain';
    } else if (P.plan === 'chain' && st.chain > 0 && foe.sailR > 0.5) a = 'chain';
    else if (P.plan === 'fire' && st.fire > 0 && foe.fire < 2) a = 'fire';
    else if (P.plan === 'grape' && st.grape > 0 && dist < 110) a = 'grape';
    else if (P.plan === 'mixed') {
      if (st.fire > 0 && foe.fire < 1 && dist > 90) a = 'fire';
      else if (st.grape > 0 && dist < 85 && foe.crew > 25) a = 'grape';
      else if (st.chain > 0 && foe.sailR > 0.7 && foe.speed > me.speed + 1) a = 'chain';
    }
    if (a !== me.ammo && me.reload.port > 0.5 && me.reload.stbd > 0.5) me.setAmmo(a);
    else if (a !== me.ammo && Math.random() < 0.35) me.setAmmo(a);
    // side preference: present the loaded battery, with hysteresis
    const offP = Math.abs(wrap(bearing - Math.PI / 2 - me.heading)) + me.reload.port * 0.12;
    const offS = Math.abs(wrap(bearing + Math.PI / 2 - me.heading)) + me.reload.stbd * 0.12;
    const pick = offP < offS ? 1 : -1;
    if (pick !== ai.side && Math.abs(offP - offS) > 0.35) ai.side = pick;
  }

  let desired, sail = 2;
  const range = P.range;
  if (ai.wantBoard) {
    const lead = clamp(dist / Math.max(me.speed, 6), 0, 4) * 0.8;
    let tx = foe.pos.x + foe.fwdX * foe.speed * lead, tz = foe.pos.z + foe.fwdZ * foe.speed * lead;
    if (dist < 70) {
      // slide alongside rather than T-boning
      const sgn = wrap(Math.atan2(-dx, -dz) - foe.heading) > 0 ? 1 : -1;
      tx += Math.cos(foe.heading) * sgn * 11; tz -= Math.sin(foe.heading) * sgn * 11;
    }
    desired = Math.atan2(tx - me.pos.x, tz - me.pos.z);
    if (dist < 34) {
      const same = Math.abs(wrap(foe.heading - me.heading)) < Math.PI / 2 ? foe.heading : foe.heading + Math.PI;
      desired = me.heading + wrap(same - me.heading) * 0.7 + wrap(desired - me.heading) * 0.3;
      sail = me.speed > foe.speed + 1.5 ? 0 : 1;
    } else if (dist < 80) sail = me.speed > foe.speed + 6 ? 1 : 2;
  } else if (dist > range * 1.7) {
    const lead = clamp(dist / 14, 0, 12) * 0.5;
    desired = Math.atan2(dx + foe.fwdX * foe.speed * lead, dz + foe.fwdZ * foe.speed * lead);
  } else {
    // broadside geometry: put the foe on the chosen beam, spiralling in or out to hold range
    let off = Math.PI / 2;
    if (dist > range * 1.1) off -= 0.55; else if (dist < range * 0.65) off += 0.5;
    desired = bearing - ai.side * off;
    if (P.battleSail && dist < range * 1.25) sail = 1;
    if (dist < 34) desired = bearing + Math.PI + ai.side * 0.6; // too close: sheer off
  }

  // don't stall in irons: fall off to a close-hauled tack
  const up = wrap(desired - upwind);
  if (Math.abs(up) < 0.68) desired = upwind + (up >= 0 ? 1 : -1) * 0.78;

  // islands and the edge of the chart
  const look = 30 + me.speed * 4;
  for (const isl of world.islands) {
    const ix = isl.x - me.pos.x, iz = isl.z - me.pos.z, id = Math.hypot(ix, iz);
    if (id > isl.r + look + 20) continue;
    const rel = wrap(Math.atan2(ix, iz) - desired);
    const clear = Math.asin(clamp((isl.r + 24) / Math.max(id, isl.r + 24.01), 0, 1));
    if (Math.abs(rel) < clear) desired -= (rel >= 0 ? 1 : -1) * (clear - Math.abs(rel) + 0.15);
  }
  const edge = Math.hypot(me.pos.x, me.pos.z);
  if (edge > 900) desired = Math.atan2(-me.pos.x, -me.pos.z);

  me.input.turn = clamp(wrap(desired - me.heading) * 2.4, -1, 1);
  me.sailLevel = sail;

  // gunnery
  ai.fireDelay -= dt;
  if (ai.fireDelay <= 0 && !foe.dead && foe.sinking <= 0) {
    const lt = dist / AMMO[me.ammo].speed;
    const pb = Math.atan2(dx + foe.fwdX * foe.speed * lt, dz + foe.fwdZ * foe.speed * lt);
    for (const side of ['port', 'stbd']) {
      if (me.reload[side] > 0) continue;
      const off = wrap(pb - (me.heading + (side === 'port' ? 1 : -1) * Math.PI / 2));
      if (Math.abs(off) < ARC * 0.85 && dist < AMMO[me.ammo].range * 1.02 && api.clearShot(me, foe)) {
        api.fire(me, side);
        ai.fireDelay = 0.4 + Math.random() * 0.8;
      }
    }
  }
}

export const newAI = () => ({ think: 0, side: 1, wantBoard: false, fireDelay: 2, grapple: 0 });
