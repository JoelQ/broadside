import { wrap, clamp } from './ship.js';

// Pirate captain: picks ammo, steers for a broadside (or a boarding), fires when the arc bears.
export function updateAI(ai, me, foe, world, dt, api) {
  const P = me.spec.ai || DEFAULT;
  const dx = foe.pos.x - me.pos.x, dz = foe.pos.z - me.pos.z;
  // a heavy ship answers her helm late, so she steers for where a nimbler foe is about to be
  const ahead = clamp((me.mass - 0.8) * 2.2, 0, 3.2);
  const dist = Math.hypot(dx, dz), bearing = Math.atan2(dx + foe.fwdX * foe.speed * ahead, dz + foe.fwdZ * foe.speed * ahead);
  const upwind = world.wind.dir + Math.PI;

  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 1.2 + Math.random();
    const adv = api.strength(me) / Math.max(1, api.strength(foe)); // fighting strength, not headcount
    // only your deck is ever fought over: ships under AI on both sides settle it with guns
    ai.wantBoard = ((P.boarder && adv > 1.05) || (adv > 2.2 && foe.crewR < 0.5 && dist < 150)) && me.crew > 12 && foe.isPlayer && !me.spec.fixed && !me.anchored;
    // ammo doctrine
    let a = 'round';
    const st = me.stock;
    if (ai.wantBoard) {
      if (st.chain > 0 && foe.speed > 6.8 && dist < me.range('chain') * 1.08) a = 'chain'; // grapples will not hold a fast ship
      else if (st.grape > 0 && dist < me.range('grape') * 1.25) a = 'grape';
      else if (st.chain > 0 && foe.sailR > 0.45 && dist < me.range('chain') * 1.08) a = 'chain';
    } else if (P.plan === 'chain' && st.chain > 0 && foe.sailR > 0.5) a = 'chain';
    else if (P.plan === 'fire' && st.fire > 0 && foe.fire < 2) a = 'fire';
    else if (P.plan === 'grape' && st.grape > 0 && dist < me.range('grape') * 1.1) a = 'grape';
    else if (P.plan === 'mixed') {
      if (st.fire > 0 && foe.fire < 1 && dist > 90) a = 'fire';
      else if (st.grape > 0 && dist < me.range('grape') * 0.85 && foe.exposed > 10) a = 'grape';
      else if (st.chain > 0 && foe.sailR > 0.7 && foe.speed > me.speed + 1) a = 'chain';
    }
    if (P.manualAmmo) a = me.ammo; // a scripted captain is choosing the shot
    if (a !== 'round' && me.spec.fixed && dist > me.range(a) * 1.05) a = 'round';
    if (a !== me.ammo && me.sides.every((k) => me.reload[k] > 0.5)) me.setAmmo(a);
    else if (a !== me.ammo && Math.random() < 0.35) me.setAmmo(a);
    // side preference: present the loaded battery, with hysteresis
    const offP = Math.abs(wrap(bearing - Math.PI / 2 - me.heading)) + (me.reload.port || 0) * 0.12;
    const offS = Math.abs(wrap(bearing + Math.PI / 2 - me.heading)) + (me.reload.stbd || 0) * 0.12;
    const pick = offP < offS ? 1 : -1;
    if (pick !== ai.side && Math.abs(offP - offS) > 0.35) ai.side = pick;
  }

  if (me.spec.fixed) return gunnery(ai, me, foe, dist, dx, dz, dt, api);
  let desired, sail = 3;
  const bowOn = P.bowOn && me.bat.bow;
  // A boarder cannot grapple a ship at speed. Until her prey is slow she stands off on the beam
  // and cuts up its rigging with chain; only then does she run alongside.
  const closing = ai.wantBoard && (foe.speed < 7.5 || me.stock.chain <= 0);
  const range = ai.wantBoard && !closing ? Math.min(P.range, me.range('chain') * 0.7) : P.range;
  if (me.anchored) {
    // at anchor: haul round on the spring until a broadside bears
    desired = bearing - ai.side * Math.PI / 2;
    if (P.cuts && (me.hullR < P.cuts || me.fire > 1) && me.weighT <= 0) { me.weighT = 0.5; if (api.onCut) api.onCut(me); } // too hot to stay: cut the cable
  } else if (closing) {
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
      sail = me.speed > foe.speed + 1.5 ? 0 : 2;
    } else if (dist < 80) sail = me.speed > foe.speed + 6 ? 2 : 3;
  } else if (dist > range * 1.7) {
    const lead = clamp(dist / 14, 0, 12) * 0.5;
    desired = Math.atan2(dx + foe.fwdX * foe.speed * lead, dz + foe.fwdZ * foe.speed * lead);
  } else if (bowOn) {
    // a galley fights with her head to the enemy: come straight on, and haul off to come again if it gets too close
    if (dist < 50) ai.away = 6;
    ai.away = (ai.away || 0) - dt;
    desired = ai.away > 0 && dist < 150 ? bearing + Math.PI - ai.side * 0.9 : bearing;
  } else {
    // broadside geometry: put the foe on the chosen beam, spiralling in or out to hold range
    let off = Math.PI / 2;
    if (dist > range * 1.1) off -= 0.55; else if (dist < range * 0.65) off += 0.5;
    desired = bearing - ai.side * off;
    if (P.battleSail && dist < range * 1.25) sail = 2;
    if (dist < 34) desired = bearing + Math.PI + ai.side * 0.6; // too close: sheer off
  }

  // don't stall in irons: fall off to a close-hauled tack
  const str = world.wind.str ?? 1;
  if (me.spec.oars) me.oar = me.stamina < 0.08 ? 0 : (closing || bowOn || dist > range * 1.4) && me.stamina > (me.oar === 2 ? 0.05 : 0.3) ? 2 : 1;
  const up = wrap(desired - upwind);
  if (Math.abs(up) < 0.68 && str > 0.3 && !me.anchored && !(me.spec.oars && me.oar)) desired = upwind + (up >= 0 ? 1 : -1) * 0.78;
  if (str > 1.3) sail = Math.min(sail, 2);

  // islands and the edge of the chart
  const look = 30 + me.speed * 4;
  for (const isl of world.islands) {
    const ix = isl.x - me.pos.x, iz = isl.z - me.pos.z, id = Math.hypot(ix, iz);
    if (id > isl.r + look + 20) continue;
    const rel = wrap(Math.atan2(ix, iz) - desired);
    const clear = Math.asin(clamp((isl.r + 24) / Math.max(id, isl.r + 24.01), 0, 1));
    if (Math.abs(rel) < clear) desired -= (rel >= 0 ? 1 : -1) * (clear - Math.abs(rel) + 0.15);
  }
  // shoal water she cannot float in: steer round it, unless her blood is up in a chase and she looks too late
  const hot = P.reckless && dist > range * 1.1 ? 1 - P.reckless : 1;
  for (const sh of world.shoals) {
    if (me.spec.D <= sh.depth || me.anchored) continue;
    const ix = sh.x - me.pos.x, iz = sh.z - me.pos.z, id = Math.hypot(ix, iz);
    if (id > sh.r + (look + 20) * hot) continue;
    const rel = wrap(Math.atan2(ix, iz) - desired);
    const clear = Math.asin(clamp((sh.r + 18) / Math.max(id, sh.r + 18.01), 0, 1));
    if (Math.abs(rel) < clear) desired -= (rel >= 0 ? 1 : -1) * (clear - Math.abs(rel) + 0.15);
  }
  if (me.backOff) desired = Math.atan2(me.backOff[0] - me.pos.x, me.backOff[1] - me.pos.z);
  const edge = Math.hypot(me.pos.x, me.pos.z);
  if (edge > 900) desired = Math.atan2(-me.pos.x, -me.pos.z);

  me.input.turn = clamp(wrap(desired - me.heading) * 2.4, -1, 1);
  me.sailLevel = sail;

  gunnery(ai, me, foe, dist, dx, dz, dt, api);
}

const DEFAULT = { range: 120, plan: 'round', boarder: false, battleSail: true };
function gunnery(ai, me, foe, dist, dx, dz, dt, api) {
  ai.fireDelay -= dt;
  if (ai.fireDelay > 0 || !foe.active) return;
  const lt = dist / api.shotSpeed(me);
  const pb = Math.atan2(dx + foe.fwdX * foe.speed * lt, dz + foe.fwdZ * foe.speed * lt);
  for (const side of me.sides) {
    if (me.reload[side] > 0) continue;
    const off = wrap(pb - me.normal(side));
    if (Math.abs(off) < me.bat[side].arc * 0.85 && api.reach(me, foe) < me.range(me.ammo, side) * 1.02 && api.clearShot(me, foe)) {
      api.fire(me, side);
      ai.fireDelay = 0.4 + Math.random() * 0.8;
    }
  }
}

// Hold a course for a point and nothing else: fireships, prizes, anything with somewhere to be.
export function steerTo(me, x, z, world) {
  let desired = Math.atan2(x - me.pos.x, z - me.pos.z);
  const up = wrap(desired - (world.wind.dir + Math.PI));
  if (Math.abs(up) < 0.68 && !(me.spec.oars && me.oar)) desired = world.wind.dir + Math.PI + (up >= 0 ? 1 : -1) * 0.78;
  me.input.turn = clamp(wrap(desired - me.heading) * 2.4, -1, 1);
  me.sailLevel = 3;
}

export const newAI = () => ({ think: 0, side: 1, wantBoard: false, fireDelay: 2, grapple: 0 });
