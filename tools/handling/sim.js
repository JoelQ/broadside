// Page-side half of the handling tool. Injected into the built game (after tools/balance/harness.js, which
// sets up a scene) by run.mjs; never shipped. Every test is one ship in open water: no land, no shoals,
// no current, a steady wind from the north (it blows toward -z, so upwind is up the page).
//   HS.manoeuvre(hull, str, name) -> { track: [[x, z, heading, speed], ...] every 0.25 s, metrics }
//   HS.polar(hull, str)           -> [{ off, v, leeway }] for every 10 degrees off the wind
//   HS.chase(a, b, str, how)      -> { caught, t, gap } with a chasing b, guns silent
(() => {
  const PI = Math.PI, dt = 0.05, wrap = (a) => { a = (a + PI) % (PI * 2); if (a < 0) a += PI * 2; return a - PI; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (x) => Math.round(x * 10) / 10;
  const WIND = PI; // blows toward -z: from the north
  const SAIL = (str) => (str > 1.3 ? 2 : 3); // full sail, battle sails in a gale (full sail tears there)

  // a scene with just your ship in it, of the hull asked for
  function open(hull, str) {
    H.setupLeg({ mission: 'm0', leg: 0, side: null, hull, seed: 1 });
    const W = G.api.world, P = G.player;
    G.api.clearShips(); W.islands = []; W.pieces = []; W.shoals = []; W.currentAt = null;
    W.setWind(WIND, str, true); W.wind.steady = true; W.wind.timer = 1e9; W.wind.next = null;
    P.oar = 0; P.fire = 0;
    return { W, P };
  }
  const offOf = (s) => wrap(s.heading - WIND); // 0 running before the wind, +-PI head to wind
  const noGo = (s) => Math.max(0.2, 0.6 - (s.spec.point || 0));
  const closeHauled = (s) => PI - noGo(s) - 0.3; // the off-wind angle she beats at
  const headingFor = (off) => wrap(WIND + off);
  const steer = (s, h) => clamp(wrap(h - s.heading) * 2.4, -1, 1);
  function place(s, h, v) { s.pos.set(0, 0, 0); s.heading = wrap(h); s.speed = v; s.yaw = 0; s.rudder = 0; s.anchored = false; s.aground = 0; s.input.turn = 0; }

  // drive the player with a function of time; returns the track
  function fly(P, secs, ctl, sail) {
    const track = [];
    let t = 0, done = null; const o = [0, 0]; // the sea has edges: past 400 yd she is moved back to the middle, and the track carries the offset
    G.bot = (me) => { const r = ctl(me, t); me.input.turn = r.turn; me.sailLevel = r.sail ?? sail; if (r.done && done == null) done = t; };
    for (let i = 0; t < secs; i++, t += dt) {
      if (Math.hypot(P.pos.x, P.pos.z) > 400) { o[0] += P.pos.x; o[1] += P.pos.z; P.pos.x = 0; P.pos.z = 0; }
      if (i % 5 === 0) track.push([r1(P.pos.x + o[0]), r1(P.pos.z + o[1]), Math.round(P.heading * 100) / 100, r1(P.speed)]);
      G.tick(dt, 1);
      if (P.stop) break;
    }
    G.bot = null;
    return { track, done };
  }
  // settle on a heading so she has her full way on, then put her back at the origin keeping it
  function settle(P, h, sail, secs = 40) { place(P, h, 0); fly(P, secs, (me) => ({ turn: steer(me, h) }), sail); const v = P.speed, y = P.yaw, rd = P.rudder; place(P, h, v); P.yaw = y; P.rudder = rd; }

  // turn one way until she is on the target off-wind angle, then hold it
  const turnTo = (dir, target, crossed = false) => {
    let last = null;
    return (me) => {
      const off = offOf(me);
      if (last != null && Math.sign(off) !== Math.sign(last) && Math.abs(off) > 0.01) crossed = true;
      last = off;
      const h = headingFor(target);
      if (crossed && Math.abs(wrap(off - target)) < 0.25) return { turn: steer(me, h), done: Math.abs(wrap(me.heading - h)) < 0.05 };
      return { turn: dir };
    };
  };

  const MANOEUVRES = {
    // come about: close-hauled on one tack, helm hard over through the wind's eye, close-hauled on the other
    tack: { secs: 40, run(P, sail) { const c = closeHauled(P); settle(P, headingFor(c), sail); return fly(P, this.secs, turnTo(1, -c), sail); } },
    // wear: the same change of tack, but turning away from the wind, through dead downwind
    wear: { secs: 40, run(P, sail) { const c = closeHauled(P); settle(P, headingFor(c), sail); return fly(P, this.secs, turnTo(-1, -c), sail); } },
    // a full turn, helm hard over, from a beam reach at full way
    circle: { secs: 90, run(P, sail) {
      settle(P, headingFor(PI / 2), sail); let turned = 0, last = P.heading, end = null;
      const r = fly(P, this.secs, (me, t) => { turned += Math.abs(wrap(me.heading - last)); last = me.heading; if (turned >= 2 * PI && end == null) end = t; if (end != null && t > end + 4) me.stop = true; return { turn: 1, done: turned >= 2 * PI }; }, sail);
      P.stop = false; return r;
    } },
    // caught in irons: head to wind, no way on, helm hard over until her sails draw, then close-hauled
    irons: { secs: 40, run(P, sail) { place(P, headingFor(PI), 0); return fly(P, this.secs, turnTo(1, -closeHauled(P), true), sail); } },
    // beat to windward for 90 s, tacking every 30 s
    beat: { secs: 90, run(P, sail) {
      const c = closeHauled(P); settle(P, headingFor(c), sail);
      let side = 1, tacking = null;
      return fly(P, this.secs, (me, t) => {
        const k = Math.floor(t / 30), want = k % 2 ? -1 : 1;
        if (want !== side && !tacking) { tacking = turnTo(side, want * c); side = want; } // tack: turn up through the wind's eye
        if (tacking) { const r = tacking(me); if (r.done) tacking = null; return r; }
        return { turn: steer(me, headingFor(side * c)) };
      }, sail);
    } },
    // gather way from rest on a beam reach
    gather: { secs: 30, run(P, sail) { place(P, headingFor(PI / 2), 0); return fly(P, this.secs, (me) => ({ turn: steer(me, headingFor(PI / 2)), done: me.speed >= 0.9 * me.maxSpeedNow(G.api.world) }), sail); } },
    // a tack with her canvas cut to 40%, as chain shot leaves it
    chainTack: { secs: 40, torn: 0.4, run(P, sail) { const c = closeHauled(P); P.sails = P.sailsMax * this.torn; settle(P, headingFor(c), sail); return fly(P, this.secs, turnTo(1, -c), sail); } },
    // clawing off a lee shore: lying beam-on to the wind with no way on, 40 yd from rocks to leeward, she makes sail and comes up close-hauled
    leeShore: { secs: 45, shore: -40, run(P, sail) { const h = headingFor(-PI / 2); place(P, h, 0); const c = closeHauled(P); return fly(P, this.secs, (me) => ({ turn: steer(me, headingFor(-c)) }), sail); } },
  };

  function metrics(name, P, r) {
    const tr = r.track, z = tr.map((p) => p[1]), x = tr.map((p) => p[0]), last = tr[tr.length - 1];
    const vmin = Math.min(...tr.map((p) => p[3])), m = { done: r.done == null ? null : r1(r.done), vmin: r1(vmin) };
    if (name === 'tack' || name === 'wear' || name === 'chainTack') m.upwind = r1(last[1]); // ground made to windward in the whole window
    if (name === 'circle') m.width = Math.round(Math.max(Math.max(...x) - Math.min(...x), Math.max(...z) - Math.min(...z)));
    if (name === 'irons') m.drift = r1(Math.min(...z)); // how far she fell back downwind before she drew
    if (name === 'beat') m.upwind = r1(last[1]), m.vmg = r1(last[1] / MANOEUVRES.beat.secs);
    if (name === 'leeShore') { m.closest = r1(Math.min(...z) - MANOEUVRES.leeShore.shore); m.ashore = Math.min(...z) < MANOEUVRES.leeShore.shore; }
    if (name === 'gather') m.dist = r1(Math.hypot(last[0], last[1]));
    return m;
  }

  window.HS = {
    names: Object.keys(MANOEUVRES),
    shore: MANOEUVRES.leeShore.shore,
    manoeuvre(hull, str, name) {
      const { P } = open(hull, str), M = MANOEUVRES[name], r = M.run(P, SAIL(str));
      const out = { hull, str, name, track: r.track, metrics: metrics(name, P, r), mass: r1(P.mass) };
      G.state = 'story'; return out;
    },
    polar(hull, str) {
      const { P } = open(hull, str), out = [], sail = SAIL(str);
      for (let d = 0; d <= 180; d += 10) {
        const off = (d * PI) / 180, h = headingFor(off);
        settle(P, h, sail, 25);
        fly(P, 5, (me) => ({ turn: steer(me, h) }), sail);
        const dx = P.pos.x, dz = P.pos.z, v = Math.hypot(dx, dz) / 5, cog = Math.atan2(dx, dz);
        out.push({ off: d, v: r1(v), leeway: v > 0.05 ? r1((Math.abs(wrap(cog - P.heading)) * 180) / PI) : null, irons: d > 180 - (noGo(P) * 180) / PI });
      }
      G.state = 'story'; return { hull, str, polar: out };
    },
    // a chases b from 300 yd. how: 'upwind' (b to windward, beating away), 'downwind' (b to leeward, running on
    // a broad reach) or 'abeam' (b on a beam reach across the wind). Caught means within 100 yd in 240 s.
    chase(a, b, str, how) {
      open(b, str); const specB = JSON.parse(JSON.stringify(G.player.spec));
      const { W, P } = open(a, str), sail = SAIL(str);
      const start = { upwind: [0, 300], downwind: [0, -300], abeam: [300, 0] }[how];
      const B = G.api.addShip(specB, 1, start[0], start[1], 0, { noAI: true });
      B.oar = specB.oars ? 1 : 0; P.oar = P.spec.oars ? 1 : 0;
      const cB = closeHauled(B), runB = { upwind: null, downwind: headingFor(PI / 4), abeam: headingFor(-PI / 2) }[how];
      B.heading = runB ?? headingFor(cB); B.speed = 0; P.heading = Math.atan2(start[0], start[1]); P.speed = 0;
      let side = 1, t = 0, caught = null;
      const steerFor = (s, desired) => { // like an AI captain: never into the no-go wedge unless rowing
        const up = wrap(desired - (WIND + PI)), lim = noGo(s) + 0.3;
        if (Math.abs(up) < lim && !(s.spec.oars && s.oar)) desired = WIND + PI + (up >= 0 ? 1 : -1) * lim;
        return steer(s, desired);
      };
      G.bot = (me) => {
        const k = Math.floor(t / 40), want = k % 2 ? -1 : 1;
        if (how === 'upwind') { if (want !== side) side = want; B.input.turn = steer(B, headingFor(side * cB)); } else B.input.turn = steer(B, runB);
        B.sailLevel = sail;
        const d = Math.hypot(B.pos.x - me.pos.x, B.pos.z - me.pos.z), lead = clamp(d / Math.max(me.speed, 4), 0, 20) * 0.6;
        me.input.turn = steerFor(me, Math.atan2(B.pos.x + B.fwdX * B.speed * lead - me.pos.x, B.pos.z + B.fwdZ * B.speed * lead - me.pos.z));
        me.sailLevel = sail;
      };
      let gap = 300;
      for (; t < 240; t += dt) {
        if (Math.hypot(P.pos.x, P.pos.z) > 400) { const mx = (P.pos.x + B.pos.x) / 2, mz = (P.pos.z + B.pos.z) / 2; for (const s of [P, B]) { s.pos.x -= mx; s.pos.z -= mz; } } // keep clear of the sea's edges
        G.tick(dt, 1); gap = Math.hypot(B.pos.x - P.pos.x, B.pos.z - P.pos.z); if (gap < 100) { caught = t; break; } }
      G.bot = null; G.state = 'story';
      return { a, b, str, how, caught: caught != null, t: caught == null ? null : Math.round(caught), gap: Math.round(gap) };
    },
  };
})();
