// Page-side balance harness. Injected into the built game by run.mjs; never shipped.
// H.fight(cfg) plays one whole battle with a scripted captain at the player's helm against the
// game's own pirate AI, with nothing drawn, and returns what happened.
(() => {
  const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FULL = { runner: { canvas: 2, helm: 2, pivots: 2, low: 2 }, line: { drill: 2, ports: 2, canvas: 2, oak: 2 }, boarder: { marines: 2, hooks: 2, rail: 2, sweeps: 2 }, gun: { charge: 2, drill: 2, ports: 2, oak: 2 } };
  const KIT = { wren: 'line', 0: 'runner', 1: 'line', 2: 'boarder', 3: 'gun' };

  // A captain is a way of moving, a shot policy and a boarding policy.
  //   move:  duel (broadsides at half range) | kite (broadsides at long range) | hug (sit astern) | close (run alongside)
  //   ammo:  round | chain (until her sails are under 45%) | fire | grape (when close) | combo (chain, then fire, grape when close)
  //   board: never | rush | odds (once strength ratio reaches cfg.odds, default 1.25)
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
        const dx = me.pos.x - foe.pos.x, dz = me.pos.z - foe.pos.z, cd = Math.hypot(dx, dz);
        const off = wrap(Math.atan2(dx, dz) - (foe.heading + Math.PI)), blind = Math.PI / 2 - foe.arc - 0.12;
        const back = foe.spec.L * 0.5 + 45, tx = foe.pos.x - Math.sin(foe.heading) * back, tz = foe.pos.z - Math.cos(foe.heading) * back;
        let hd;
        if (Math.abs(off) > blind || d > me.range() * 0.9) { hd = Math.atan2(tx - me.pos.x, tz - me.pos.z); me.sailLevel = 3; }
        else {
          const brg = Math.atan2(-dx, -dz), o1 = brg - Math.PI / 2, o2 = brg + Math.PI / 2;
          hd = Math.abs(wrap(o1 - me.heading)) < Math.abs(wrap(o2 - me.heading)) ? o1 : o2;
          if (cd < foe.spec.L * 0.5 + 25) hd = foe.heading;
          me.sailLevel = me.speed > foe.speed + 3 ? 1 : 2;
        }
        me.input.turn = clamp(wrap(hd - me.heading) * 2.5, -1, 1);
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
  // move: duel | kite | hug | close | bow.  anchor: true drops an anchor on a spring once in range.
  const fake = (x, z) => ({ pos: { x, z }, fwdX: 0, fwdZ: 0, speed: 0, crewR: 1, sailR: 1, fire: 0, exposed: 0, crew: 1, melee: 1, hullR: 1, active: false, isPlayer: false, spec: { L: 1, B: 1 }, stock: {} });
  function routeBot(steps) {
    const ai = G.newAI(), st = { i: 0, swap: 0 };
    return (me, _e, dt) => {
      const S = G.sc.S, foes = G.api.foesOf(me);
      let step = steps[Math.min(st.i, steps.length - 1)];
      const done = () => { st.i++; step = steps[Math.min(st.i, steps.length - 1)]; };
      // advance past finished steps
      for (let guard = 0; guard < 6 && st.i < steps.length; guard++) {
        if (step.go) {
          const z = typeof step.go === 'string' ? (G.sc.zones || []).find((q) => q.name === step.go.slice(5)) : { x: step.go[0], z: step.go[1] };
          if (!z) { if (step.wait) break; done(); continue; }
          if (Math.hypot(me.pos.x - z.x, me.pos.z - z.z) < (step.r || 45)) { done(); continue; }
        } else if (step.kill) {
          const t = step.kill === 'all' ? foes.find((o) => !o.spec.fixed) || foes[0] : S.by[step.kill];
          if (!t || t.out) { done(); continue; }
        }
        break;
      }
      if (st.i >= steps.length) step = { kill: 'all', move: 'duel', ammo: 'round', board: 'never' };
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
      G.api.setTarget(foe);
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
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8) && me.speed < 6) { me.anchored = true; me.weighT = 0; }
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8)) me.sailLevel = 0;
      me.spec.ai = { range: step.range || (move === 'kite' ? r * 0.85 : move === 'close' ? 20 : move === 'bow' ? r * 0.7 : r * 0.5), plan: 'none', manualAmmo: true, boarder: move === 'close', battleSail: true, bowOn: move === 'bow' };
      const sail = me.sailLevel;
      G.api.updateAI(ai, me, foe, G.world, dt, G.api.aiApi);
      if (step.anchor && !me.anchored && d < r * (step.anchorAt || 0.8)) me.sailLevel = Math.min(sail, 1);
      if (move === 'close') ai.wantBoard = true;
      for (const s of me.sides) if (foes.some((o) => o !== foe && G.api.inArc(me, s, o, 1))) G.api.fire(me, s);
      if (boardMode && G.canBoard) G.api.startBoarding('player', foe);
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
    // a whole mission, leg after leg, with damage carried and the watches spent where they are needed most:
    // { side, mission, hull, fit, routes: { [leg title]: steps }, maxT }
    cruise(cfg) {
      const C = G.CAMP;
      G.paused = true; G.fast = true; G.mode = 'campaign';
      const st = (C.st = C.fresh());
      st.side = cfg.side || null; st.stage = C.order.indexOf(cfg.mission); st.officers = ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, Math.max(0, st.stage));
      st.stable = [{ id: 'h1', hull: cfg.hull, name: 'Test', fit: {} }]; st.seed = (Math.random() * 1e9) | 0;
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
      G.state = 'story'; G.outcome = null; G.player.sinking = 0; G.fast = false;
      return { o, win: o === 'won', t: legs.reduce((a, l) => a + l.t, 0), hull: legs[legs.length - 1].hull, crew: legs[legs.length - 1].crew, legs, aground: 0, boarded: 0, foes: legs.map((l) => `${l.title}:${l.o}@${l.hull}`).join(' > '), pos: '' };
    },
    // one campaign leg: { side, mission: 'm1', leg: 0 | pool key, hull, fit, officers, route: [steps], state: { hull, sails, crew }, stock, maxT }
    leg(cfg) {
      const C = G.CAMP;
      G.paused = true; G.fast = true; G.mode = 'campaign';
      const st = (C.st = C.fresh());
      st.side = cfg.side || null; st.stage = C.order.indexOf(cfg.mission); st.officers = cfg.officers || ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, Math.max(0, st.stage));
      st.stable = [{ id: 'h1', hull: cfg.hull, name: 'Test', fit: {} }]; st.seed = (Math.random() * 1e9) | 0;
      const kit = { runner: FULL.runner, line: FULL.line, boarder: FULL.boarder, gun: FULL.gun, galley: { marines: 2, hooks: 2, stroke: 2, oak: 2 } };
      G.ship = 'h1'; G.fit = cfg.fit ? { h1: kit[{ sloop: 'runner', brig: 'line', xebec: 'boarder', merchantman: 'gun', flagship: 'gun', galley: 'galley', galliot: 'galley' }[cfg.hull]] } : {};
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
      const P = G.player, steps = typeof cfg.route === 'function' ? cfg.route(G.sc.S) : cfg.route;
      G.bot = routeBot(steps);
      const dt = 0.05, maxT = cfg.maxT || 600;
      let t = 0, aground = 0, boarded = 0; const trace = [];
      while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'boarding') { boarded = 1; G.api.boardSwivel(); }
        if (P.aground > 0) aground += dt;
        if (cfg.trace && Math.round(t / dt) % Math.round(cfg.trace / dt) === 0) trace.push(`${String(Math.round(t)).padStart(3)}s me ${Math.round(P.pos.x)},${Math.round(P.pos.z)} h${Math.round(P.hullR * 100)} c${Math.round(P.crew)} v${P.speed.toFixed(0)}${P.anchored ? ' anch' : ''}${P.aground > 0 ? ' AGROUND' : ''} ${P.ammo} | ` + G.ships.filter((x) => x !== P).map((x) => `${x.id}:${Math.round(x.pos.x)},${Math.round(x.pos.z)} h${Math.round(x.hullR * 100)} c${Math.round(x.crew)} v${x.speed.toFixed(0)}${x.out ? ' ' + x.out : ''}${x.aground > 0 ? ' AGROUND' : ''}${x.anchored ? ' anch' : ''}${x.fire ? ' fire' + x.fire : ''}`).join(' | ') + (G.state === 'boarding' ? ' BOARDING' : ''));
        G.tick(dt, 1); t += dt;
      }
      const o = G.state === 'battle' || G.state === 'boarding' ? 'timeout' : G.outcome;
      const res = { o, win: o === 'won', t: Math.round(t), hull: +(Math.max(0, P.hull) / P.hullMax).toFixed(2), crew: +(P.crew / P.crewMax).toFixed(2), aground: Math.round(aground), boarded,
        foes: G.ships.filter((s) => s.side === 1).map((s) => s.out || (s.aground > 0 ? 'aground' : 'up')).join(','), prizes: run.prizes.length, trace, pos: [Math.round(P.pos.x), Math.round(P.pos.z)] };
      if (G.state === 'boarding') G.api.cutGrapples();
      G.bot = null; G.state = 'story'; G.outcome = null; P.sinking = 0; G.fast = false;
      return res;
    },

    fight(cfg) {
      G.paused = true; G.fast = true;
      G.trophies = cfg.ship === 'wren' ? [] : [cfg.ship]; G.ship = cfg.ship;
      G.fit = cfg.fit ? { [cfg.ship]: cfg.fit === 'full' ? FULL[KIT[cfg.ship]] : cfg.fit } : {};
      G.level = cfg.level;
      G.api.rebuild(); G.api.act('sail'); G.api.act('engage'); G.coach = null;
      const P = G.player, E = G.sc.foe;
      P.stock = { chain: 8, grape: 8, fire: 5, ...(cfg.stock || {}) };
      G.bot = captain(cfg.plan);
      const dt = 0.05, maxT = cfg.maxT || 420;
      let t = 0, boardedBy = null, exposed = 0, minOdds = 1e9;
      while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'boarding') { if (!boardedBy) boardedBy = G.bd.by; G.api.boardSwivel(); }
        else {
          if (E.sides.some((s) => G.api.inArc(E, s, P, 1))) exposed += dt;
        }
        G.tick(dt, 1); t += dt;
      }
      const o = G.outcome || 'timeout';
      const res = {
        o, win: o === 'struck' || o === 'sunk' || o === 'captured', how: o === 'captured' ? 'board' : o === 'struck' || o === 'sunk' ? 'guns' : o,
        t: Math.round(t), hull: +(Math.max(0, P.hull) / P.hullMax).toFixed(2), crew: Math.round(P.crew), eHull: +(Math.max(0, E.hull) / E.hullMax).toFixed(2), eCrew: Math.round(E.crew),
        eSails: +E.sailR.toFixed(2), boardedBy, exposed: +(exposed / (t || 1)).toFixed(2), shots: G.stats.shots, hits: G.stats.hits,
      };
      G.stats.shots = G.stats.hits = 0;
      // leave the game in a state the next fight can start from
      if (G.state === 'boarding') G.api.cutGrapples();
      G.state = 'battle'; G.outcome = null; G.api.endBattle('sunk'); P.sinking = 0; G.bot = null; G.fast = false;
      return res;
    },
  };
})();
