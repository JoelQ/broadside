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
        for (const s of ['port', 'stbd']) if (G.api.inArc(me, s, foe, 1)) G.api.fire(me, s);
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

  window.H = {
    fight(cfg) {
      G.paused = true; G.fast = true;
      G.trophies = cfg.ship === 'wren' ? [] : [cfg.ship]; G.ship = cfg.ship;
      G.fit = cfg.fit ? { [cfg.ship]: cfg.fit === 'full' ? FULL[KIT[cfg.ship]] : cfg.fit } : {};
      G.level = cfg.level;
      G.api.rebuild(); G.api.act('sail'); G.api.act('engage'); G.coach = null;
      const P = G.player, E = G.enemy;
      P.stock = { chain: 8, grape: 8, fire: 5, ...(cfg.stock || {}) };
      G.bot = captain(cfg.plan);
      const dt = 0.05, maxT = cfg.maxT || 420;
      let t = 0, boardedBy = null, exposed = 0, minOdds = 1e9;
      while (t < maxT && (G.state === 'battle' || G.state === 'boarding')) {
        if (G.state === 'boarding') { if (!boardedBy) boardedBy = G.bd.by; G.api.boardSwivel(); }
        else {
          if (['port', 'stbd'].some((s) => G.api.inArc(E, s, P, 1))) exposed += dt;
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
