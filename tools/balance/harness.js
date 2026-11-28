// Page-side balance harness. Injected into the built game by run.mjs; never shipped.
// H.fight(cfg) plays one whole battle with a scripted captain at the player's helm against the
// game's own pirate AI, with nothing drawn, and returns what happened.
(() => {
  // Fights tick the rules themselves (G.tick, with G.fast set, draws nothing). Between calls the game's own frame loop
  // would keep drawing the scene in software and stepping the world on the wall clock: stop it.
  window.requestAnimationFrame = () => 0;
  const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FULL = { runner: { canvas: 2, helm: 2, pivots: 2, low: 2 }, line: { drill: 2, ports: 2, canvas: 2, oak: 2 }, boarder: { marines: 2, hooks: 2, rail: 2, sweeps: 2 }, gun: { charge: 2, drill: 2, ports: 2, oak: 2 } };
  const KIT = { wren: 'line', 0: 'runner', 1: 'line', 2: 'boarder', 3: 'gun' };

  // ---------- dials ----------
  // Any tuning number the game exposes on G.dials can be changed for one fight: cfg.dials maps a path to a value.
  //   { 'AMMO.grape.hull': 0.8, 'HULLS.sloop.crew': 44, 'AMMO.grape.kills.1': 5 }
  // A '*' step matches every key there ('HULLS.*.crew'), and a value { mul: 1.2 } or { add: -3 } scales or shifts
  // what was there. Everything is put back when the fight ends, so the next fight starts from the shipped numbers.
  let undo = [];
  function restoreDials() { for (let i = undo.length - 1; i >= 0; i--) { const [o, k, v] = undo[i]; o[k] = v; } undo = []; }
  function applyDials(dials) {
    restoreDials();
    if (!dials) return;
    if (!G.dials) throw new Error('this build exposes no G.dials: rebuild it to use cfg.dials');
    for (const [path, val] of Object.entries(dials)) {
      const keys = path.split('.');
      let objs = [G.dials];
      for (const k of keys.slice(0, -1)) objs = objs.flatMap((o) => (k === '*' ? Object.values(o) : [o[k]])).filter((o) => o && typeof o === 'object');
      const last = keys[keys.length - 1];
      let hit = 0;
      for (const o of objs) for (const k of last === '*' ? Object.keys(o) : [last]) {
        if (!(k in o)) continue;
        const was = o[k];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const f = (x) => (val.mul != null ? x * val.mul : x + (val.add || 0));
          if (typeof was === 'number') o[k] = f(was);
          else if (Array.isArray(was) && was.every((x) => typeof x === 'number')) o[k] = was.map(f); // e.g. grape's kills [lo, hi]
          else continue;
        } else o[k] = val;
        undo.push([o, k, was]); hit++;
      }
      if (!hit) { restoreDials(); throw new Error(`dial ${path} matches nothing in G.dials`); }
    }
  }

  // ---------- fight record ----------
  // With cfg.story the result carries a record of how the fight went: both sides sampled every second, every hit
  // by the shot that made it, the time each side spent with the other under its guns, and a one-line cause.
  // tools/balance/story.mjs turns a run's records into tables and pictures.
  const SHOTS = ['round', 'chain', 'grape', 'fire'];
  function recorder(P) {
    const zero = () => ({ hull: 0, sails: 0, crew: 0 });
    const dealt = {}, taken = {}; // by cause: a shot type, or burning, boarding, other
    for (const k of [...SHOTS, 'burning', 'boarding', 'other']) { dealt[k] = zero(); taken[k] = zero(); }
    const foes = () => G.ships.filter((x) => x.side !== P.side);
    const start = new Map(G.ships.map((x) => [x, { hull: x.hull, sails: x.sails, crew: x.crew }]));
    let last = new Map(G.ships.map((x) => [x, { hull: x.hull, sails: x.sails, crew: x.crew }]));
    let hits = new Map(); // what this tick's hits explain of each ship's losses
    const style = { rake: 0, hull: 0, range: 0, w: 0 };
    const arcs = { mine: 0, hers: 0, both: 0, neither: 0, boarding: 0 }, samples = [];
    // after the first moment either side's guns bore: how long neither did (the approach is not dead time), and who held the weather gauge
    let contact = null, idle = 0; const gauge = { mine: 0, hers: 0 };
    let lull = 0, longestLull = 0, t = 0, next = 0, was0 = G.state; // the state this tick began in
    G.onHit = (b, ship, hd, sd, kills) => {
      const h = hits.get(ship) || zero(); h.hull += hd; h.sails += sd; h.crew += kills; hits.set(ship, h);
      const book = b.owner === P ? dealt : ship === P ? taken : null;
      if (book) { const e = book[b.ammo]; e.hull += hd; e.sails += sd; e.crew += kills; }
      if (book === dealt && !ship.spec.fixed) {
        // how she fought: the share of hull damage done raking (end-on, as in hullHit), and the range her hits came from
        const hv = Math.hypot(b.vel.x, b.vel.z) || 1, w = hd + sd + kills * 3;
        if (Math.abs((b.vel.x * ship.fwdX + b.vel.z * ship.fwdZ) / hv) > 0.78) style.rake += hd;
        style.hull += hd; style.w += w; style.range += w * Math.hypot(b.owner.pos.x - ship.pos.x, b.owner.pos.z - ship.pos.z);
      }
    };
    return {
      tick(dt) {
        // whatever a ship lost this tick that no hit explains: the fire, the deck fight, or the rocks
        for (const x of G.ships) {
          const was = last.get(x); if (!was) { last.set(x, { hull: x.hull, sails: x.sails, crew: x.crew }); continue; }
          const h = hits.get(x) || zero(), book = x === P ? taken : x.side !== P.side ? dealt : null;
          if (book) {
            const why = G.state === 'boarding' || was0 === 'boarding' ? 'boarding' : x.fire > 0 ? 'burning' : 'other';
            for (const k of ['hull', 'sails', 'crew']) { const rest = Math.max(0, was[k] - x[k] - h[k]); if (rest > 1e-6) book[why][k] += rest; }
          }
          last.set(x, { hull: x.hull, sails: x.sails, crew: x.crew });
        }
        hits = new Map();
        was0 = G.state;
        const fs = foes().filter((x) => !x.out), live = fs.filter((x) => x.active !== false);
        const mine = live.some((f) => P.sides.some((sd) => G.api.inArc(P, sd, f, 1)));
        const hers = live.some((f) => f.sides && f.sides.some((sd) => G.api.inArc(f, sd, P, 1)));
        const k = G.state === 'boarding' ? 'boarding' : mine && hers ? 'both' : mine ? 'mine' : hers ? 'hers' : 'neither';
        arcs[k] += dt;
        if (contact == null && k !== 'neither') contact = t;
        if (contact != null && k === 'neither') idle += dt;
        const g = G.api.nearest(P, live);
        if (g && G.api.hasGauge) { if (G.api.hasGauge(P, g)) gauge.mine += dt; else if (G.api.hasGauge(g, P)) gauge.hers += dt; }
        lull = k === 'neither' ? lull + dt : 0; longestLull = Math.max(longestLull, lull);
        t += dt;
        if (t >= next) {
          next += 1;
          const f = G.api.nearest(P, fs.length ? fs : foes()) || fs[0];
          const r = (x) => [+x.hullR.toFixed(3), +x.sailR.toFixed(3), Math.round(x.crew)];
          samples.push({ t: Math.round(t), me: r(P), foe: f ? r(f) : null, foeId: f ? f.id || f.spec.cls : null, d: f ? Math.round(G.api.reach(P, f)) : null, ammo: P.ammo, fAmmo: f ? f.ammo : null, v: +P.speed.toFixed(1), fv: f ? +f.speed.toFixed(1) : null, arc: k, fire: [P.fire, f ? f.fire : 0] });
        }
      },
      finish(o, viaBoard) {
        G.onHit = null;
        const total = (book, k) => Object.values(book).reduce((a, e) => a + e[k], 0);
        const share = (book, k) => { const n = total(book, k); return n > 0 ? Object.fromEntries(Object.entries(book).filter(([, e]) => e[k] / n >= 0.005).map(([c, e]) => [c, +(e[k] / n).toFixed(2)])) : {}; };
        const round = (book) => Object.fromEntries(Object.entries(book).filter(([, e]) => e.hull >= 0.5 || e.sails >= 0.5 || e.crew >= 0.5).map(([c, e]) => [c, { hull: Math.round(e.hull), sails: Math.round(e.sails), crew: Math.round(e.crew) }]));
        // what decided it: a capture is won on her crew, a sinking or a striking on her hull, a loss on yours
        const won = o === 'won' || o === 'struck' || o === 'sunk' || o === 'captured';
        const lostOn = o === 'overrun' || o === 'captured' || (o === 'won' && viaBoard) ? 'crew' : 'hull';
        const book = won ? dealt : taken, res = won ? lostOn : o === 'overrun' ? 'crew' : 'hull';
        const sh = share(book, res), top = Object.entries(sh).sort((a, b) => b[1] - a[1]);
        const cause = o === 'timeout' || o === 'unfinished' ? `${o === 'timeout' ? 'timed out' : 'still going'}${longestLull > 30 ? `, ${Math.round(longestLull)}s with neither side's guns bearing` : ''}`
          : `${o}: ${won ? 'her' : 'our'} ${res} ${top.map(([c, v]) => `${c} ${Math.round(v * 100)}%`).join(', ') || '(no damage recorded)'}`;
        const T = t || 1;
        return { cause, decisive: res, dealt: round(dealt), taken: round(taken), share: { dealt: { hull: share(dealt, 'hull'), sails: share(dealt, 'sails'), crew: share(dealt, 'crew') }, taken: { hull: share(taken, 'hull'), sails: share(taken, 'sails'), crew: share(taken, 'crew') } },
          arcs: Object.fromEntries(Object.entries(arcs).map(([k, v]) => [k, +(v / T).toFixed(2)])), longestLull: Math.round(longestLull), contact: contact == null ? null : Math.round(contact), idle: +(idle / T).toFixed(2), gauge: { mine: +(gauge.mine / T).toFixed(2), hers: +(gauge.hers / T).toFixed(2) }, rake: style.hull > 0 ? +(style.rake / style.hull).toFixed(2) : null, hitRange: style.w > 0 ? Math.round(style.range / style.w) : null, samples,
          start: { me: start.get(P), foes: [...start].filter(([x]) => x.side !== P.side).map(([x, v]) => ({ id: x.id || x.spec.cls, ...v })) } };
      },
    };
  }

  // A captain is a way of moving, a shot policy and a boarding policy.
  //   move:  duel (broadsides at half range) | kite (broadsides at long range) | hug (sit astern) | close (run alongside)
  //   ammo:  round | chain (until her sails are under 45%) | fire | grape (when close) | combo (chain, then fire, grape when close)
  //   board: never | rush | odds (once strength ratio reaches cfg.odds, default 1.25)
  // Every fight is seeded, so any result can be played again exactly: pass cfg.seed to replay one.
  // Without one, a fresh seed is drawn and reported in the result.
  function seedFor(cfg) {
    G.canBoard = false; // older builds kept the last fight's until the first tick of the next
    const seed = cfg.seed != null ? cfg.seed >>> 0 : (Math.random() * 2 ** 31) >>> 0;
    if (G.seedRng) G.seedRng(seed); // an older build has no seeded source: the fight is not replayable
    return seed;
  }

  // sit on her quarter, out of her arcs, firing into her stern: how a small, handy ship fights a big one
  function hug(me, foe, d, shot = 'round') { // sits close enough astern for the shot she means to fire next
    const dx = me.pos.x - foe.pos.x, dz = me.pos.z - foe.pos.z, cd = Math.hypot(dx, dz);
    const off = wrap(Math.atan2(dx, dz) - (foe.heading + Math.PI)), blind = Math.PI / 2 - foe.arc - 0.12;
    const stand = Math.min(45, me.range(shot) * 0.6), back = foe.spec.L * 0.5 + stand, tx = foe.pos.x - Math.sin(foe.heading) * back, tz = foe.pos.z - Math.cos(foe.heading) * back;
    let hd;
    if (Math.abs(off) > blind || d > me.range(shot) * 0.9) { hd = Math.atan2(tx - me.pos.x, tz - me.pos.z); me.sailLevel = 3; }
    else {
      const brg = Math.atan2(-dx, -dz), o1 = brg - Math.PI / 2, o2 = brg + Math.PI / 2;
      hd = Math.abs(wrap(o1 - me.heading)) < Math.abs(wrap(o2 - me.heading)) ? o1 : o2;
      if (cd < foe.spec.L * 0.5 + 25) hd = foe.heading;
      me.sailLevel = me.speed > foe.speed + 3 ? 1 : 2;
    }
    me.input.turn = clamp(wrap(hd - me.heading) * 2.5, -1, 1);
  }

  // stay out of her arcs: how a person sails a small ship against a big one. Every tick she tries 32 headings, looks a few
  // seconds ahead (both ships held on course, her arcs widened for the turn she may make), and takes the one that
  // brings her nearest a station off her stern without sailing into a loaded broadside in reach. A battery still
  // reloading is no threat for as long as it has to go, so she can dart across it.
  function shadow(me, foe, shot = 'round', dt = 0.05, mem = {}) {
    const look = 3.5, v = Math.max(me.speed, 7), stand = Math.min(55, me.range(shot) * 0.7), back = foe.spec.L * 0.5 + stand;
    const fx = foe.pos.x + foe.fwdX * foe.speed * look, fz = foe.pos.z + foe.fwdZ * foe.speed * look;
    const tx = fx - foe.fwdX * back, tz = fz - foe.fwdZ * back, upwind = G.world.wind.dir + Math.PI, nogo = Math.max(0.2, 0.6 - (me.spec.point || 0)) + 0.12;
    const swing = Math.min(0.6, (foe.spec.turn || 0.3) * look * 0.5);
    const threat = (x, z) => {
      let t = 0;
      for (const side of foe.sides) {
        if (!foe.bat[side]) continue;
        const dx = x - fx, dz = z - fz, d = Math.hypot(dx, dz), off = Math.abs(wrap(Math.atan2(dx, dz) - (foe.heading + foe.bat[side].dir)));
        const loaded = Math.max(0, 1 - (foe.reload[side] || 0) / (look + 1.5));
        if (d < foe.range('round', side) * 1.15 && off < foe.bat[side].arc + swing) t += loaded * (1.2 - d / (foe.range('round', side) * 1.15));
      }
      return t;
    };
    let best = me.heading, bestS = Infinity;
    for (let k = 0; k < 32; k++) {
      const h = (k / 32) * Math.PI * 2;
      if (Math.abs(wrap(h - upwind)) < nogo && !(me.spec.oars && me.oar)) continue;
      const x = me.pos.x + Math.sin(h) * v * look, z = me.pos.z + Math.cos(h) * v * look;
      const sc = Math.hypot(tx - x, tz - z) + threat(x, z) * 400 + threat((me.pos.x + x) / 2, (me.pos.z + z) / 2) * 250 + Math.abs(wrap(h - me.heading)) * 8 + (mem.h != null ? Math.abs(wrap(h - mem.h)) * 6 : 0);
      if (sc < bestS) { bestS = sc; best = h; }
    }
    mem.h = best;
    const near = Math.hypot(tx - me.pos.x, tz - me.pos.z) < 25 && threat(me.pos.x, me.pos.z) === 0;
    me.sailLevel = near ? (me.speed > foe.speed + 2 ? 1 : 2) : 3;
    me.input.turn = clamp(wrap(best - me.heading) * 2.5, -1, 1);
  }

  function captain(plan) {
    const ai = G.newAI(), st = { swap: 0, boardMode: plan.board === 'rush' };
    const oddsNow = (me, foe) => G.api.strength(me) / (G.api.strength(foe) || 1);
    return (me, foe, dt) => {
      const d = G.api.reach(me, foe);
      if (plan.board === 'odds') st.boardMode = oddsNow(me, foe) >= (plan.odds || 1.25);
      // shot
      let want = 'round';
      const sk = me.stock, a = plan.ammo;
      if ((a === 'chain' || a === 'combo') && sk.chain > 0 && foe.sailR > 0.45 && d < me.range('chain') * 1.1) want = 'chain';
      else if ((a === 'fire' || a === 'combo') && sk.fire > 0 && d < me.range('fire') * 1.1) want = 'fire'; // stay on heated shot while it lasts
      else if ((a === 'grape' || a === 'combo') && sk.grape > 0 && foe.exposed > 2 && d < me.range('grape') * 1.05) want = 'grape';
      if (st.boardMode) {
        // grapples only hold a slowed ship: chain until she is slow, then arrive with grape in the guns
        if (foe.speed > 6.5 && sk.chain > 0 && d < me.range('chain') * 1.1) want = 'chain';
        else if (sk.grape > 0 && d < me.range('grape') * 1.2) want = 'grape';
      }
      st.swap -= dt;
      if (want !== me.ammo && st.swap <= 0) { me.setAmmo(want); st.swap = 2.5; }
      // helm
      // a boarder stands off and chains until her prey is slow, then closes
      const move = st.boardMode ? (foe.speed > 6.5 && sk.chain > 0 ? 'duel' : 'close') : plan.move;
      if (move === 'hug') {
        const sk2 = me.stock, next = (a === 'chain' || a === 'combo') && sk2.chain > 0 && foe.sailR > 0.45 ? 'chain' : (a === 'grape' || a === 'combo' || st.boardMode) && sk2.grape > 0 && foe.exposed > 2 ? 'grape' : 'round';
        hug(me, foe, d, next);
        for (const s of me.sides) if (G.api.inArc(me, s, foe, 1)) G.api.fire(me, s);
      } else {
        const r = me.range('round');
        me.spec.ai = { range: move === 'kite' ? r * 0.85 : move === 'close' ? 20 : r * 0.5, plan: 'none', manualAmmo: true, boarder: move === 'close', battleSail: true };
        G.api.updateAI(ai, me, foe, G.world, dt, G.api.aiApi);
        if (move === 'close') ai.wantBoard = true;
        if (want !== me.ammo && st.swap <= 0) { me.setAmmo(want); st.swap = 2.5; }
      }
      if (st.boardMode && G.canBoard) G.api.startBoarding('player');
    };
  }

  // ---------- campaign legs ----------
  // A route is a list of steps, done in order:
  //   { go: [x, z] | 'zone:name', r }                 sail there (firing at whatever bears on the way)
  //   { kill: id | 'all', move, ammo, board, anchor }  fight that ship until she is out
  // move: duel | kite | hug | shadow | close | bow.  anchor: true drops an anchor on a spring once in range.
  // keepOff: true (or a distance) bears away from a stronger boarder inside 75 yd. windward: true beats up to a station
  // upwind of her before fighting, whenever she holds the weather gauge.
  // range: the distance she keeps (yd), or rangeK: that as a share of her round-shot range.
  const fake = (x, z) => ({ pos: { x, z }, fwdX: 0, fwdZ: 0, speed: 0, crewR: 1, sailR: 1, fire: 0, exposed: 0, crew: 1, melee: 1, hullR: 1, active: false, isPlayer: false, spec: { L: 1, B: 1 }, stock: {} });
  // until: { t, foeSails, foeCrew, foeHull, hull, crew } ends a fight step early, as soon as any of them is met (seconds
  // on this step; her sails, crew or hull as a share at or under; yours likewise), and the next step takes over: an
  // opener such as chain until her sails are down to 60%, then round shot.
  const met = (u, me, foe, t) => (u.t != null && t >= u.t) || (foe && ((u.foeSails != null && foe.sailR <= u.foeSails) || (u.foeCrew != null && foe.crewR <= u.foeCrew) || (u.foeHull != null && foe.hullR <= u.foeHull))) || (u.hull != null && me.hullR <= u.hull) || (u.crew != null && me.crewR <= u.crew);
  // own: she is the player's ship. Otherwise she is an enemy driven through the game's bot hook (ship.bot), and boards
  // the way the game's AI does, by wanting to (her grapples catch only a slow player).
  function routeBot(steps, own = true) {
    let ai = own ? G.newAI() : null;
    const st = { i: 0, swap: 0, t: 0 };
    return (me, _e, dt) => {
      if (!ai) ai = me.ai;
      const S = G.sc.S, foes = G.api.foesOf(me);
      let step = steps[Math.min(st.i, steps.length - 1)];
      const done = () => { st.i++; st.t = 0; step = steps[Math.min(st.i, steps.length - 1)]; };
      st.t += dt;
      // advance past finished steps
      for (let guard = 0; guard < 6 && st.i < steps.length; guard++) {
        if (step.go) {
          const z = typeof step.go === 'string' ? (G.sc.zones || []).find((q) => q.name === step.go.slice(5)) : { x: step.go[0], z: step.go[1] };
          if (!z) { if (step.wait) break; done(); continue; }
          if (Math.hypot(me.pos.x - z.x, me.pos.z - z.z) < (step.r || 45)) { done(); continue; }
        } else if (step.kill) {
          const t = step.kill === 'all' ? foes.find((o) => !o.spec.fixed) || foes[0] : S.by[step.kill];
          if (!t || t.out) { done(); continue; }
          if (step.until && st.i < steps.length - 1 && met(step.until, me, t, st.t)) { done(); continue; }
        }
        break;
      }
      if (st.i >= steps.length) step = { kill: 'all', move: 'duel', ammo: 'round', board: 'never' };
      if (step.go && typeof step.go === 'string' && !(G.sc.zones || []).some((q) => q.name === step.go.slice(5))) step = { kill: 'all', move: 'duel', ammo: 'round', board: 'never' }; // waiting for the zone: fight on
      st.swap -= dt;
      if (me.spec.oars && step.oar != null) me.oar = step.oar;
      if (step.go) {
        const z = typeof step.go === 'string' ? (G.sc.zones || []).find((q) => q.name === step.go.slice(5)) : { x: step.go[0], z: step.go[1] };
        if (me.anchored && me.weighT <= 0) me.weighT = 0.1;
        me.spec.ai = { range: 1, plan: 'none', manualAmmo: true, boarder: false, battleSail: false };
        G.api.updateAI(ai, me, fake(z.x, z.z), G.world, dt, G.api.aiApi);
        if (step.sail != null) me.sailLevel = step.sail;
        for (const s of me.sides) if (foes.some((o) => G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
        return;
      }
      const foe = step.kill === 'all' ? G.api.nearest(me, foes.filter((o) => !o.spec.fixed)) || G.api.nearest(me, foes) : S.by[step.kill];
      if (!foe) return;
      if (own) G.api.setTarget(foe); else me.target = foe;
      const d = G.api.reach(me, foe), sk = me.stock, a = step.ammo || 'round';
      let boardMode = step.board === 'rush' || (step.board === 'odds' && G.api.strength(me) / (G.api.strength(foe) || 1) >= (step.odds || 1.25));
      if (foe.spec.fixed && step.board !== 'rush') boardMode = step.board === 'odds' && G.api.strength(me) / (G.api.strength(foe) || 1) >= (step.odds || 1.25);
      let want = 'round';
      if ((a === 'chain' || a === 'combo') && sk.chain > 0 && foe.sailR > 0.45 && !foe.anchored && !foe.spec.fixed && d < me.range('chain') * 1.1) want = 'chain';
      else if ((a === 'fire' || a === 'combo') && sk.fire > 0 && d < me.range('fire') * 1.1) want = 'fire';
      else if ((a === 'grape' || a === 'combo') && sk.grape > 0 && foe.exposed > 2 && d < me.range('grape') * 1.05) want = 'grape';
      if (boardMode) {
        if (foe.speed > 6.5 && sk.chain > 0 && d < me.range('chain') * 1.1) want = 'chain';
        else if (sk.grape > 0 && d < me.range('grape') * 1.2) want = 'grape';
      }
      if (want !== me.ammo && st.swap <= 0) { me.setAmmo(want); st.swap = 2.5; }
      const r = me.range('round');
      let move = boardMode ? (foe.speed > 6.5 && sk.chain > 0 ? 'duel' : 'close') : step.move || 'duel';
      const keep = step.range || (step.rangeK ? r * step.rangeK : move === 'kite' ? r * 0.85 : move === 'close' ? 20 : move === 'bow' ? r * 0.7 : r * 0.5);
      // keepOff: a ship that would lose a deck fight does not let a boarder come alongside: she bears away from her
      if (step.keepOff && !boardMode && d < (step.keepOff === true ? 75 : step.keepOff) && G.api.strength(foe) > G.api.strength(me) * 0.9) {
        const ax = me.pos.x - foe.pos.x, az = me.pos.z - foe.pos.z, al = Math.hypot(ax, az) || 1;
        me.spec.ai = { range: 1, plan: 'none', manualAmmo: true, boarder: false, battleSail: false };
        G.api.updateAI(ai, me, fake(me.pos.x + (ax / al) * 250, me.pos.z + (az / al) * 250), G.world, dt, G.api.aiApi);
        for (const s of me.sides) if (foes.some((o) => G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
        return;
      }
      // windward: win the weather gauge first, beating up to a station upwind of her at the range she means to fight
      if (step.windward && !boardMode && G.world.wind.str > 0.3 && !me.anchored && !G.api.hasGauge(me, foe) && d > Math.min(keep, 60)) {
        const wx = Math.sin(G.world.wind.dir), wz = Math.cos(G.world.wind.dir), R = Math.max(keep, 70);
        me.spec.ai = { range: 1, plan: 'none', manualAmmo: true, boarder: false, battleSail: false };
        G.api.updateAI(ai, me, fake(foe.pos.x - wx * R, foe.pos.z - wz * R), G.world, dt, G.api.aiApi);
        for (const s of me.sides) if (foes.some((o) => G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
        return;
      }
      if (move === 'shadow') { // keep out of her loaded arcs, work round to her stern, fire whatever bears
        const sk2 = me.stock, next = (a === 'chain' || a === 'combo') && sk2.chain > 0 && foe.sailR > 0.45 ? 'chain' : (a === 'grape' || a === 'combo' || boardMode) && sk2.grape > 0 && foe.exposed > 2 ? 'grape' : a === 'fire' && sk2.fire > 0 ? 'fire' : 'round';
        shadow(me, foe, next, dt, st);
        for (const s of me.sides) if (G.api.inArc(me, s, foe, 1) || foes.some((o) => o !== foe && G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
        if (!own) ai.wantBoard = boardMode;
        return;
      }
      if (move === 'hug') { // sit astern out of her arcs; board when the odds come
        const sk2 = me.stock, next = (a === 'chain' || a === 'combo') && sk2.chain > 0 && foe.sailR > 0.45 ? 'chain' : (a === 'grape' || a === 'combo' || boardMode) && sk2.grape > 0 && foe.exposed > 2 ? 'grape' : 'round';
        hug(me, foe, d, next);
        for (const s of me.sides) if (G.api.inArc(me, s, foe, 1) || foes.some((o) => o !== foe && G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
        if (!own) ai.wantBoard = boardMode;
        return;
      }
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8) && me.speed < 6) { me.anchored = true; me.weighT = 0; }
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8)) me.sailLevel = 0;
      me.spec.ai = { range: keep, plan: 'none', manualAmmo: true, boarder: move === 'close', battleSail: true, bowOn: move === 'bow' };
      const sail = me.sailLevel;
      G.api.updateAI(ai, me, foe, G.world, dt, G.api.aiApi);
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8)) me.sailLevel = Math.min(sail, 1);
      if (move === 'close') ai.wantBoard = true;
      for (const s of me.sides) if (foes.some((o) => o !== foe && G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
      if (!own) ai.wantBoard = boardMode;
      else if (boardMode && G.canBoard) G.api.startBoarding('player', foe);
    };
  }

  // play the leg that is on its card now, with these steps at the helm
  function playLeg(steps, maxT) {
    G.api.act('engage'); G.coach = null;
    const P = G.player;
    G.bot = routeBot(typeof steps === 'function' ? steps(G.sc.S) : steps);
    let t = 0;
    while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) { if (G.state === 'boarding') G.api.boardSwivel(); G.tick(0.05, 1); t += 0.05; }
    const o = G.state === 'battle' || G.state === 'boarding' ? 'timeout' : G.outcome;
    if (G.state === 'boarding') G.api.cutGrapples();
    G.bot = null;
    return { o, t: Math.round(t), hull: +P.hullR.toFixed(2), crew: +P.crewR.toFixed(2) };
  }
  window.H = {
    applyDials, restoreDials,
    // a whole mission, leg after leg, with damage carried and the watches spent where they are needed most:
    // { side, mission, hull, fit, routes: { [leg title]: steps }, maxT }
    cruise(cfg) {
      applyDials(cfg.dials);
      const C = G.CAMP;
      G.paused = true; G.fast = true; G.mode = 'campaign';
      const st = (C.st = C.fresh());
      st.side = cfg.side || null; st.stage = C.order.indexOf(cfg.mission); st.officers = ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, Math.max(0, st.stage));
      st.stable = [{ id: 'h1', hull: cfg.hull, name: 'Test', fit: {} }]; st.seed = seedFor(cfg);
      G.ship = 'h1'; G.fit = {}; C.rebuild(); C.man();
      G.player.stock = { chain: 8, grape: 8, fire: 5 };
      C.startMission();
      const run = C.run, legs = [];
      let o = 'won';
      for (;;) {
        const title = run.legs[run.i].title, r = playLeg(cfg.routes[title] || [{ kill: 'all', move: 'duel', ammo: 'round' }], cfg.maxT || 600);
        legs.push({ title, ...r }); o = r.o;
        if (o !== 'won' || run.i + 1 >= run.legs.length) break;
        G.tick(0.05, 140); // the ending beat, then the pause
        if (G.state !== 'story') { o = 'stuck:' + G.state; break; }
        for (let w = 0; w < 4; w++) { const p = G.player; C.watch(p.hullR < 0.7 && p.hullR <= p.sailR ? 'hull' : p.sailR < 0.8 ? 'sails' : p.hullR < 0.7 ? 'hull' : 'crew'); }
        C.act('next');
      }
      G.state = 'story'; G.outcome = null; G.player.sinking = 0; G.fast = false; restoreDials();
      return { seed: st.seed, o, win: o === 'won', t: legs.reduce((a, l) => a + l.t, 0), hull: legs[legs.length - 1].hull, crew: legs[legs.length - 1].crew, legs, aground: 0, boarded: 0, foes: legs.map((l) => `${l.title}:${l.o}@${l.hull}`).join(' > '), pos: '' };
    },
    // one campaign leg: { side, mission: 'm1', leg: 0 | pool key, hull, fit, officers, route: [steps], state: { hull, sails, crew }, stock, maxT }
    // Sets up one leg of a mission and beats to quarters, without playing it (screenshots use this).
    setupLeg(cfg) {
      applyDials(cfg.dials);
      const C = G.CAMP;
      G.paused = true; G.fast = true; G.mode = 'campaign';
      const st = (C.st = C.fresh());
      st.side = cfg.side || null; st.stage = C.order.indexOf(cfg.mission); st.officers = cfg.officers || ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, Math.max(0, st.stage));
      st.stable = [{ id: 'h1', hull: cfg.hull, name: 'Test', fit: {} }]; st.seed = seedFor(cfg);
      const kit = { runner: FULL.runner, line: FULL.line, boarder: FULL.boarder, gun: FULL.gun, galley: { marines: 2, hooks: 2, stroke: 2, oak: 2 } };
      G.ship = 'h1'; G.fit = cfg.fitSet ? { h1: cfg.fitSet } : cfg.fit ? { h1: kit[{ sloop: 'runner', brig: 'line', xebec: 'boarder', merchantman: 'gun', flagship: 'gun', galley: 'galley', galliot: 'galley' }[cfg.hull]] } : {};
      C.rebuild(); C.man();
      const P0 = G.player; P0.stock = { chain: 8, grape: 8, fire: 5, ...(cfg.stock || {}) };
      C.startMission();
      const run = C.run;
      if (typeof cfg.leg === 'string') { run.legs = [C.pool[cfg.leg]]; run.i = 0; }
      else run.i = cfg.leg || 0;
      if (cfg.carry) run.carry = run.c.carry = cfg.carry;
      if (cfg.state) { const p = G.player; if (cfg.state.hull) p.hull = p.hullMax * cfg.state.hull; if (cfg.state.sails) p.sails = p.sailsMax * cfg.state.sails; if (cfg.state.crew) p.crew = Math.round(p.crewMax * cfg.state.crew); }
      if (typeof cfg.leg === 'string' || run.i) C.startLeg();
      G.api.act('engage'); G.coach = null;
      return C.run;
    },
    leg(cfg) {
      const C = G.CAMP, run = H.setupLeg(cfg), st = C.st;
      const P = G.player, steps = typeof cfg.route === 'function' ? cfg.route(G.sc.S) : cfg.route;
      G.bot = routeBot(steps);
      const dt = 0.05, maxT = cfg.maxT || 600;
      let t = 0, aground = 0, boarded = 0; const trace = [];
      const rec = cfg.story ? recorder(P) : null;
      while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'boarding') { boarded = 1; G.api.boardSwivel(); }
        if (P.aground > 0) aground += dt;
        if (cfg.trace && Math.round(t / dt) % Math.round(cfg.trace / dt) === 0) trace.push(`${String(Math.round(t)).padStart(3)}s me ${Math.round(P.pos.x)},${Math.round(P.pos.z)} h${Math.round(P.hullR * 100)} c${Math.round(P.crew)} v${P.speed.toFixed(0)}${P.anchored ? ' anch' : ''}${P.aground > 0 ? ' AGROUND' : ''} ${P.ammo} | ` + G.ships.filter((x) => x !== P).map((x) => `${x.id}:${Math.round(x.pos.x)},${Math.round(x.pos.z)} h${Math.round(x.hullR * 100)} c${Math.round(x.crew)} v${x.speed.toFixed(0)}${x.out ? ' ' + x.out : ''}${x.aground > 0 ? ' AGROUND' : ''}${x.anchored ? ' anch' : ''}${x.fire ? ' fire' + x.fire : ''}`).join(' | ') + (G.state === 'boarding' ? ' BOARDING' : ''));
        G.tick(dt, 1); t += dt;
        if (rec) rec.tick(dt);
      }
      const o = G.state === 'battle' || G.state === 'boarding' ? 'timeout' : G.outcome;
      const res = { seed: st.seed, o, win: o === 'won', t: Math.round(t), hull: +(Math.max(0, P.hull) / P.hullMax).toFixed(2), crew: +(P.crew / P.crewMax).toFixed(2), aground: Math.round(aground), boarded,
        foes: G.ships.filter((s) => s.side === 1).map((s) => s.out || (s.aground > 0 ? 'aground' : 'up')).join(','), prizes: run.prizes.length, trace, pos: [Math.round(P.pos.x), Math.round(P.pos.z)] };
      if (rec) res.story = rec.finish(o, boarded);
      if (G.state === 'boarding') G.api.cutGrapples();
      G.bot = null; G.state = 'story'; G.outcome = null; P.sinking = 0; G.fast = false; restoreDials();
      return res;
    },

    // one hull against another in open water, one on one: Home waters with her pirate swapped for hull b in good
    // hands (your gunnery and drill), fighting back with the game's own AI. Hull a has the route at her helm.
    // { a, b, route, seed, maxT, foeStock, dials, story }
    duel(cfg) {
      H.setupLeg({ mission: 'm0', leg: 0, hull: cfg.b, seed: cfg.seed, dials: cfg.dials });
      const specB = JSON.parse(JSON.stringify(G.player.spec));
      specB.stock = cfg.foeStock || { chain: 3, grape: 3, fire: 0 };
      specB.noStrike = !cfg.strike; // she fights to the last, as you do: an enemy strikes her colours at 15% hull, which handed you a free 15%
      const steps = cfg.route;
      const r = H.leg({ ...cfg, mission: 'm0', leg: 0, hull: cfg.a, maxT: cfg.maxT || 480, route: (S) => {
        const old = S.by.pirate, [x, z, h] = [old.pos.x, old.pos.z, old.heading];
        G.api.clearShips();
        // both in good hands: a full crew. (Home waters is the first mission, where your standing gives you 80 hands,
        // which left a great ship or a xebec fighting short-handed on your side and fully manned on hers.)
        if (!cfg.hands) G.player.crew = G.player.crewMax;
        if (cfg.flip) { // trade places: she starts where you would have, you where she would have
          const P = G.player, [px, pz, ph] = [P.pos.x, P.pos.z, P.heading];
          P.pos.x = x; P.pos.z = z; P.heading = h;
          S.by.pirate = G.api.addShip(specB, 1, px, pz, ph, { id: 'pirate', speed: 6 });
        } else
        S.by.pirate = G.api.addShip(specB, 1, x, z, h, { id: 'pirate', speed: 6 });
        if (cfg.foeRoute) S.by.pirate.bot = routeBot(cfg.foeRoute, false); // a scripted captain on her side too
        return steps;
      } });
      r.how = r.foes.includes('captured') ? 'board' : r.o === 'won' ? 'guns' : r.o;
      return r;
    },
    // play a fight a person recorded in the playtest build (src/playtest.js), exactly: the same leg, ship and
    // fittings, every ship as it was when they engaged, the same dice, then their rudder and keys frame by frame.
    // { rec, dials, story } -> the usual leg result, plus how far the replay kept to the recording.
    replay(cfg) {
      const r = cfg.rec, P0 = () => G.player;
      H.setupLeg({ side: r.side, mission: r.mission, leg: r.leg, hull: r.hull, fitSet: r.fit, officers: r.officers, carry: r.carry, seed: r.seed, dials: cfg.dials });
      if (G.ships.length !== r.start.ships.length) return { o: 'mismatch', why: `${G.ships.length} ships here, ${r.start.ships.length} in the recording` };
      G.ships.forEach((s, i) => {
        const o = r.start.ships[i];
        if (o.seedSign != null) s.spec.seedSign = o.seedSign;
        for (const [k, v] of Object.entries(o)) {
          if (k === 'id' || k === 'cls' || k === 'seedSign' || k === 'target') continue;
          if (v && typeof v === 'object' && 'x' in v && 'z' in v && s[k] && typeof s[k].set === 'function') s[k].set(v.x, v.y, v.z);
          else if (v && typeof v === 'object' && !Array.isArray(v)) s[k] = Object.assign(s[k] || {}, v);
          else s[k] = v;
        }
        s.target = o.target >= 0 ? G.ships[o.target] : null;
      });
      Object.assign(G.world.wind, r.start.wind); Object.assign(G, r.start.g);
      G.seedRng(r.seed);
      const turns = r.turn.flatMap(([v, n]) => Array(n).fill(v)), keys = new Map();
      for (const [f, k] of r.keys) { if (!keys.has(f)) keys.set(f, []); keys.get(f).push(k); }
      const SKIP = new Set(['p', 'escape', 'm', 'v', 'h']), checks = new Map(r.checks.map((c) => [c[0], c]));
      let turn = 0, drift = null, i = 0, boarded = 0, aground = 0;
      G.bot = (me) => { me.input.turn = turn; };
      const P = P0(), rec = cfg.story ? recorder(P) : null;
      for (; i < r.dt.length && (G.state === 'battle' || G.state === 'boarding'); i++) {
        const c = checks.get(i);
        if (c && !drift) { const d = Math.hypot(P.pos.x - c[1] / 100, P.pos.z - c[2] / 100); const dh = P.hull - c[3] / 100; if (d > 1 || Math.abs(dh) > 0.5) drift = { frame: i, t: +r.dt.slice(0, i).reduce((a, b) => a + b / 10000, 0).toFixed(1), yards: +d.toFixed(1), hull: +dh.toFixed(1) }; }
        G.paused = false;
        for (const k of keys.get(i) || []) if (!SKIP.has(k)) G.api.tap(k);
        turn = turns[i] || 0;
        const dt = r.dt[i] / 10000;
        if (G.state === 'boarding') boarded = 1;
        if (P.aground > 0) aground += dt;
        G.tick(dt, 1);
        if (rec) rec.tick(dt);
      }
      G.paused = true;
      const o = G.state === 'battle' || G.state === 'boarding' ? 'unfinished' : G.outcome;
      const res = { seed: r.seed, o, win: o === 'won', recorded: r.outcome, same: o === r.outcome, drift, frames: i, t: Math.round(G.battleT), hull: +(Math.max(0, P.hull) / P.hullMax).toFixed(3), recHull: r.hullLeft, crew: +(P.crew / P.crewMax).toFixed(2), boarded, aground: Math.round(aground),
        foes: G.ships.filter((s) => s.side !== P.side).map((s) => s.out || 'up').join(','), pos: [Math.round(P.pos.x), Math.round(P.pos.z)] };
      if (rec) res.story = rec.finish(o, boarded);
      if (G.state === 'boarding') G.api.cutGrapples();
      G.bot = null; G.state = 'story'; G.outcome = null; P.sinking = 0; G.fast = false; restoreDials();
      return res;
    },
    fight(cfg) {
      applyDials(cfg.dials);
      G.paused = true; G.fast = true; const seed = seedFor(cfg);
      G.trophies = cfg.ship === 'wren' ? [] : [cfg.ship]; G.ship = cfg.ship;
      G.fit = cfg.fit ? { [cfg.ship]: cfg.fit === 'full' ? FULL[KIT[cfg.ship]] : cfg.fit } : {};
      G.level = cfg.level;
      G.api.rebuild(); G.api.act('sail'); G.api.act('engage'); G.coach = null;
      const P = G.player, E = G.sc.foe;
      P.stock = { chain: 8, grape: 8, fire: 5, ...(cfg.stock || {}) };
      G.bot = captain(cfg.plan);
      const dt = 0.05, maxT = cfg.maxT || 420;
      let t = 0, boardedBy = null, exposed = 0, minOdds = 1e9;
      const rec = cfg.story ? recorder(P) : null;
      while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'boarding') { if (!boardedBy) boardedBy = G.bd.by; G.api.boardSwivel(); }
        else {
          if (E.sides.some((s) => G.api.inArc(E, s, P, 1))) exposed += dt;
        }
        G.tick(dt, 1); t += dt;
        if (rec) rec.tick(dt);
      }
      const o = G.outcome || 'timeout';
      const res = {
        seed, o, win: o === 'struck' || o === 'sunk' || o === 'captured', how: o === 'captured' ? 'board' : o === 'struck' || o === 'sunk' ? 'guns' : o,
        t: Math.round(t), hull: +(Math.max(0, P.hull) / P.hullMax).toFixed(2), crew: Math.round(P.crew), eHull: +(Math.max(0, E.hull) / E.hullMax).toFixed(2), eCrew: Math.round(E.crew),
        eSails: +E.sailR.toFixed(2), boardedBy, exposed: +(exposed / (t || 1)).toFixed(2), shots: G.stats.shots, hits: G.stats.hits,
      };
      if (rec) res.story = rec.finish(o);
      G.stats.shots = G.stats.hits = 0;
      // leave the game in a state the next fight can start from
      if (G.state === 'boarding') G.api.cutGrapples();
      G.state = 'battle'; G.outcome = null; G.api.endBattle('sunk'); P.sinking = 0; G.bot = null; G.fast = false; restoreDials();
      return res;
    },
  };
})();
