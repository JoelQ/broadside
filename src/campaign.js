import { HULLS, OFFICERS, HANDS } from './fleet.js';
import { MISSIONS, ORDER, LEG_POOL } from './missions.js';
import { STORY, NAMES, PORTS, SIDE_NAME } from './story.js';
import { mulberry } from './geo.js';

// The campaign: saved progress, the stable, officers, and the flow from briefing to cruise to port.
// The engine (main.js) plays one leg at a time; this file decides which leg, and what happens between.
const KEY = 'broadside.campaign.v1';
let G, E;
const fresh = () => ({
  v: 1, side: null, stage: 0, gold: 0, seed: (Math.random() * 1e9) | 0, nextId: 2,
  stable: [{ id: 's1', hull: 'brig', name: NAMES.home, fit: {} }], ship: 's1',
  officers: [], stock: { chain: 6, grape: 6, fire: 3 }, stats: { taken: 0, sunk: 0, time: 0 }, done: false,
});
// what the fleet lends you as the war goes on, if you have not taken one already
const GRANTS = { m0: ['sloop'], m1: ['xebec'], m2: ['galley'], m3: ['merchantman'], m4: [] };
const JOINS = { m0: 'pilot', m1: 'carpenter', m2: 'gunner', m3: 'marines' };
const WATCHES = [
  ['hull', 'Patch the hull', '+15% hull, up to 70%'],
  ['sails', 'Splice the rigging', '+25% sails, up to 80%'],
  ['crew', 'Tend the wounded', 'A third of the men lost in the last fight return to duty'],
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const pct = (r) => Math.round(r * 100) + '%';

export const CAMP = {
  st: null, run: null, fresh: () => fresh(), pool: LEG_POOL, order: ORDER,
  init(g, e) { G = g; E = e; },
  entry: (id) => CAMP.st.stable.find((s) => s.id === id),
  stableIds: () => CAMP.st.stable.map((s) => s.id),
  livery: () => CAMP.st.side || 'island',
  has: (o) => !!CAMP.st && CAMP.st.officers.includes(o),
  portName: () => PORTS[CAMP.livery()],
  hands: () => HANDS[Math.min(CAMP.st.stage, HANDS.length - 1)],
  // how many of a ship's berths you can fill: your hands, her own oarsmen, and any marines fitted to her
  crewFor(spec) { return Math.min(spec.crew, CAMP.hands() + (spec.rowers || 0) + ((spec.mods && spec.mods.crew) || 0)); },
  man(p = G.player) { p.crew = Math.min(p.crew, CAMP.crewFor(p.spec)); },
  saved() {
    try { const s = JSON.parse(E.store.get(KEY) || 'null'); if (!s || s.v !== 1) return ''; return s.done ? `Campaign finished for ${SIDE_NAME[s.side]}` : `${s.side ? SIDE_NAME[s.side] + ' · ' : ''}next: ${MISSIONS[ORDER[s.stage]].title}`; } catch (e) { return ''; }
  },
  save() { const st = CAMP.st; st.gold = G.gold; st.ship = G.ship; st.fit = G.fit; st.stock = { ...G.player.stock }; E.store.set(KEY, JSON.stringify(st)); },
  nextLine() { const st = CAMP.st; return st.done ? 'The war is over' : `Next: <b>${MISSIONS[ORDER[st.stage]].title}</b><br>${CAMP.hands()} hands${st.officers.length ? ' · ' + st.officers.length + ' officer' + (st.officers.length > 1 ? 's' : '') : ''}`; },

  // ---------- starting and resuming ----------
  begin(isNew) {
    let st = null;
    if (!isNew) try { st = JSON.parse(E.store.get(KEY) || 'null'); } catch (e) { st = null; }
    CAMP.st = st = st && st.v === 1 ? st : fresh();
    G.mode = 'campaign'; G.gold = st.gold; G.fit = st.fit || {}; G.ship = st.ship; G.paused = false; G.stats.time = 0;
    CAMP.rebuild();
    G.player.stock = { chain: 0, grape: 0, fire: 0, ...st.stock };
    if (st.done) return CAMP.ending();
    if (st.stage === 0) return CAMP.tell(STORY.opening, 'camp:go');
    CAMP.port();
  },
  rebuild() { const stock = G.player.stock; if (G.player.arcs) E.dropArcs(G.player); E.scene.remove(G.player.group); G.player = null; E.buildPlayer(true); G.player.stock = { chain: 0, grape: 0, fire: 0, ...stock }; },
  port() { E.showPort(); CAMP.man(); E.renderPort(); E.snapCamera(); CAMP.save(); },

  // ---------- telling the story: a page of text over the scene ----------
  tell(page, next, extra = '') {
    G.state = 'story'; E.setMode(null);
    const paras = (page.text || []).map((t) => `<p>${t}</p>`).join('');
    E.showScreen(`<div class="story"><div class="eyebrow">${page.eyebrow || ''}</div><h2>${page.title || ''}</h2>${paras}${extra}
      <div class="rowc">${typeof next === 'string' ? `<button class="btn big" data-act="${next}">${page.go || 'Continue'}</button>` : next}</div></div>`, 'dim');
  },
  text(key) { const m = STORY[key]; return (m && (m[CAMP.st.side] || m.both)) || {}; },
  brief() {
    const st = CAMP.st, key = ORDER[st.stage];
    if (st.done) return;
    CAMP.save();
    const b = CAMP.text(key).brief || { title: MISSIONS[key].title, text: [] }, sp = G.player.spec;
    CAMP.tell({ eyebrow: `${CAMP.portName()} · orders`, ...b, go: 'Weigh anchor' }, 'camp:go', `<p class="note">You sail in the <b>${sp.name}</b> (${sp.cls.toLowerCase()}, draws ${sp.D.toFixed(1)}${G.player.crew < sp.crew ? `, short-handed: ${Math.round(G.player.crew)} of ${sp.crew}` : ''}). The choice is fixed once you sail.</p>`
      + `<div class="rowc" style="margin-top:0"><button class="btn sm" data-act="camp:port">Back to the quay</button></div>`);
  },

  // ---------- a mission is a cruise of legs ----------
  ctx() {
    const st = CAMP.st, run = CAMP.run, side = st.side, foe = side === 'venice' ? 'ottoman' : 'venice';
    return {
      side, foe, own: side || 'island', rnd: run.rnd, has: CAMP.has, carry: run.carry, names: NAMES[foe], S: null,
      card: (def) => CAMP.card(def), onOut: (s, how) => CAMP.onOut(s, how), onEnd: (o) => CAMP.legEnd(o),
    };
  },
  startMission() {
    const st = CAMP.st, key = ORDER[st.stage];
    const run = (CAMP.run = { key, i: 0, prizes: [], carry: {}, rnd: mulberry(st.seed + st.stage * 101), lost: 0, start: null, snap: null });
    const c = CAMP.ctx(); c.names = { ...NAMES[c.foe], friends: NAMES[c.own === 'island' ? 'venice' : c.own].friends, foes: NAMES[c.foe].foes };
    run.legs = MISSIONS[key].legs(c); run.c = c;
    run.start = CAMP.snapshot();
    CAMP.startLeg();
  },
  snapshot() { const p = G.player, st = CAMP.st; return clone({ stable: st.stable, ship: G.ship, nextId: st.nextId, fit: G.fit, hull: p.hull, sails: p.sails, crew: p.crew, stock: p.stock, prizes: CAMP.run.prizes, carry: CAMP.run.carry, gold: G.gold }); },
  restore(s) {
    const st = CAMP.st, run = CAMP.run; s = clone(s);
    st.stable = s.stable; st.nextId = s.nextId; G.fit = s.fit; G.gold = s.gold; run.prizes = s.prizes; run.carry = run.c.carry = s.carry;
    if (G.ship !== s.ship) { G.ship = s.ship; CAMP.rebuild(); }
    const p = G.player; p.hull = s.hull; p.sails = s.sails; p.crew = s.crew; p.stock = s.stock; p.fire = 0;
  },
  startLeg() {
    const run = CAMP.run, def = run.legs[run.i].build(run.c);
    def.title = run.legs[run.i].title;
    run.snap = CAMP.snapshot(); run.crew0 = G.player.crew;
    E.startScenario(def, run.c);
  },
  card(def) {
    const run = CAMP.run, t = CAMP.text(run.key), leg = (t.legs || [])[run.i] || {};
    const obj = typeof def.objective === 'function' ? def.objective() : def.objective;
    return { eyebrow: `${MISSIONS[run.key].title} · ${run.i + 1} of ${run.legs.length}`, title: def.title, line: obj, hook: (STORY.legs[def.title] || {})[CAMP.livery()] || (STORY.legs[def.title] || {}).both || leg.hook || '' };
  },
  onOut(s, how) {
    if (how !== 'captured' || s.side === G.player.side || s.spec.fixed || !HULLS[s.spec.hullId]) return;
    CAMP.run.prizes.push({ name: s.name, hull: s.spec.hullId, hullR: Math.max(0.2, s.hullR), sailR: Math.max(0.3, s.sailR), stock: { ...s.stock }, hands: Math.round(s.crew * 0.25), stripped: false });
  },
  legEnd(o) {
    const run = CAMP.run, p = G.player;
    if (o !== 'won') {
      G.state = 'over'; run.lost++;
      const why = o === 'lost' ? `${p.spec.name} is lost` : o === 'overrun' ? 'Your deck is taken' : (G.sc.failText || 'The day is lost');
      return E.showScreen(`<div class="banner bad"><div class="eyebrow">${MISSIONS[run.key].title} · ${run.legs[run.i].title}</div><h1>${why}</h1>
        <div class="loot">${run.i ? 'Try this fight again in the state you entered it, or begin the cruise afresh from port.' : 'The story waits for you.'}</div>
        <div class="rowc"><button class="btn big" data-act="camp:retry">Fight again</button>${run.i ? '<button class="btn" data-act="camp:remission">Restart the cruise</button>' : ''}<button class="btn sm" data-act="camp:abandon">${CAMP.st.stage ? 'Back to port' : 'Quit to title'}</button></div></div>`);
    }
    p.fire = 0; p.anchored = false; p.aground = 0;
    if (run.i + 1 >= run.legs.length) return CAMP.finishMission();
    CAMP.pause();
  },

  // ---------- the jury-rig pause ----------
  pause() {
    const run = CAMP.run;
    run.watches = CAMP.has('carpenter') ? 4 : 3;
    run.lostMen = Math.max(0, run.crew0 - G.player.crew); run.tended = false;
    G.state = 'story'; E.setMode(null);
    CAMP.renderPause();
  },
  renderPause() {
    const run = CAMP.run, p = G.player, t = CAMP.text(run.key), leg = (t.legs || [])[run.i] || {}, w = run.watches, free = CAMP.has('marines');
    const bar = (label, r, n) => `<div class="cmp"><span>${label}</span><div class="t"><i style="width:${r * 100}%"></i></div><b>${n}</b></div>`;
    const rows = WATCHES.map(([k, name, desc]) => {
      const full = k === 'hull' ? p.hullR >= 0.7 : k === 'sails' ? p.sailR >= 0.8 : run.tended || run.lostMen < 3;
      return `<div class="item"><div class="d">${name}<small>${desc}</small></div><button class="btn sm" data-act="camp:w:${k}" ${w < 1 || full ? 'disabled' : ''}>${full ? (k === 'crew' ? (run.tended ? 'Done' : 'None to tend') : 'Sea repairs can do no more') : 'One watch'}</button></div>`;
    });
    run.prizes.forEach((z, i) => {
      const h = HULLS[z.hull];
      rows.push(`<div class="item prize"><div class="d">${z.own ? 'Your ship' : 'Prize'}: <b>${z.name}</b> · ${h.cls.toLowerCase()}<small>hull ${pct(z.hullR)} · sails ${pct(z.sailR)} · draws ${h.D.toFixed(1)}</small></div>
        <button class="btn sm" data-act="camp:strip:${i}" ${w < 1 || z.stripped || z.own ? 'disabled' : ''}>${z.stripped ? 'Stripped' : 'Strip her'}</button>
        <button class="btn sm" data-act="camp:flag:${i}" ${!free && w < 1 ? 'disabled' : ''}>Shift your flag${free ? '' : ' · one watch'}</button></div>`);
    });
    const lines = (leg.pause || []).map((l) => `<p>${l}</p>`).join('');
    E.showScreen(`<div class="story wide"><div class="eyebrow">${MISSIONS[run.key].title} · between fights</div><h2>${w} watch${w === 1 ? '' : 'es'} to spend</h2>${lines}
      <div class="cols"><div class="shipstate"><h3>${p.spec.name}</h3>${bar('Hull', p.hullR, Math.ceil(p.hull))}${bar('Sails', p.sailR, Math.ceil(p.sails))}${bar('Crew', p.crewR, Math.round(p.crew))}
      <div class="role">Chain ×${p.stock.chain} · grape ×${p.stock.grape} · heated ×${p.stock.fire}</div></div><div class="watches">${rows.join('')}</div></div>
      <div class="rowc"><button class="btn big" data-act="camp:next">${w > 0 ? 'Carry on' : 'Carry on'}</button></div><p class="note">Next: ${run.legs[run.i + 1].title}</p></div>`, 'dim');
  },
  watch(k) {
    const run = CAMP.run, p = G.player;
    if (run.watches < 1) return;
    if (k === 'hull') p.hull = Math.max(p.hull, Math.min(p.hullMax * 0.7, p.hull + p.hullMax * 0.15));
    else if (k === 'sails') p.sails = Math.max(p.sails, Math.min(p.sailsMax * 0.8, p.sails + p.sailsMax * 0.25));
    else if (k === 'crew') { p.crew = Math.min(p.crewMax, p.crew + Math.round(run.lostMen / 3)); run.tended = true; }
    run.watches--; E.sfx.coin(); CAMP.renderPause();
  },
  strip(i) {
    const run = CAMP.run, p = G.player, z = run.prizes[i];
    if (!z || z.stripped || run.watches < 1) return;
    for (const k of ['chain', 'grape', 'fire']) p.stock[k] += z.stock[k] || 0;
    p.crew = Math.min(p.crewMax, p.crew + z.hands); z.stock = {}; z.stripped = true;
    run.watches--; E.sfx.coin(); CAMP.renderPause();
  },
  shiftFlag(i) {
    const run = CAMP.run, st = CAMP.st, z = run.prizes[i], free = CAMP.has('marines'), old = G.player;
    if (!z || (!free && run.watches < 1)) return;
    if (!free) run.watches--;
    const was = { name: old.spec.name, hull: CAMP.entry(G.ship).hull, hullR: old.hullR, sailR: old.sailR, stock: {}, hands: 0, stripped: true, own: G.ship };
    const crew = old.crew, stock = old.stock;
    let id = z.own;
    if (!id) { id = 'p' + st.nextId++; st.stable.push({ id, hull: z.hull, name: z.name, fit: {} }); }
    G.ship = id; CAMP.rebuild();
    const p = G.player;
    p.hull = p.hullMax * z.hullR; p.sails = p.sailsMax * z.sailR; p.stock = stock;
    p.crew = free ? p.crewMax : Math.min(p.crewMax, Math.round(crew) + (p.spec.rowers || 0)); // your people go across with you; the marines can man her in full
    run.prizes.splice(i, 1, was); run.crew0 = p.crew; run.lostMen = 0;
    E.sfx.horn(true); CAMP.renderPause();
  },

  // ---------- the end of a cruise ----------
  finishMission() {
    const st = CAMP.st, run = CAMP.run, key = run.key, M = MISSIONS[key], out = [];
    let gold = M.pay;
    for (const z of run.prizes) {
      if (z.own) continue;
      const h = HULLS[z.hull], worth = Math.round((h.value * (0.5 + 0.5 * z.hullR)) / 10) * 10;
      if (st.stable.some((s) => s.hull === z.hull)) { gold += worth; out.push(`<b>${z.name}</b> condemned as a prize and sold: +${worth} g`); }
      else { st.stable.push({ id: 'p' + st.nextId++, hull: z.hull, name: z.name, fit: {} }); gold += Math.round(worth / 40) * 10; out.push(`<b>${z.name}</b>, ${h.cls.toLowerCase()}, joins your ships in port`); }
    }
    for (const hull of GRANTS[key] || []) if (!st.stable.some((s) => s.hull === hull)) {
      const name = NAMES[st.side || 'venice'].lent[hull];
      st.stable.push({ id: 's' + st.nextId++, hull, name, fit: {} }); out.push(`The fleet lends you the <b>${name}</b>, ${HULLS[hull].cls.toLowerCase()}`);
    }
    const off = JOINS[key];
    if (off && !st.officers.includes(off)) { st.officers.push(off); run.joined = off; }
    G.gold += gold; st.stage++; st.stats.time += G.stats.time; G.stats.time = 0;
    const p = G.player; p.stock.chain += 2; p.stock.grape += 2; p.stock.fire += 1;
    if (st.stage >= ORDER.length) st.done = true;
    run.summary = (gold ? `<p class="note"><b>+${gold} g</b> in pay and prize money</p>` : '') + out.map((l) => `<p class="note">${l}</p>`).join('');
    E.sfx.coin();
    E.enterHarbor(); E.snapCamera();
    if (key === 'm0') { CAMP.save0(); return CAMP.choose(); }
    CAMP.save();
    if (st.done) return CAMP.ending();
    CAMP.debrief();
  },
  save0() { CAMP.save(); },
  debrief() {
    const run = CAMP.run, st = CAMP.st, d = CAMP.text(run.key).end || { title: MISSIONS[run.key].title, text: [] };
    let extra = run.summary || '';
    if (run.joined) { const o = OFFICERS[run.joined], who = (STORY.officers[run.joined] || {})[st.side] || {}; extra += `<div class="officer"><b>${who.name || o.name}</b> joins you. ${who.line || ''}<small>${o.does}</small></div>`; }
    CAMP.tell({ eyebrow: 'Afterwards', ...d, go: st.done ? 'The end of it' : 'Make port' }, st.done ? 'camp:ending' : 'camp:port', extra);
  },
  choose() {
    const c = STORY.choice;
    CAMP.tell({ eyebrow: 'Afterwards', title: c.title, text: c.text }, `<button class="btn big" data-act="camp:side:venice">${c.venice}</button><button class="btn big" data-act="camp:side:ottoman">${c.ottoman}</button>`, CAMP.run.summary || '');
  },
  takeSide(side) {
    const st = CAMP.st;
    st.side = side; CAMP.rebuild(); E.enterHarbor(); E.snapCamera(); CAMP.save();
    CAMP.debrief();
  },
  ending() {
    const st = CAMP.st, e = STORY.ending[st.side], mm = Math.floor(st.stats.time / 60);
    G.state = 'story'; E.setMode(null); E.enterHarbor(); E.snapCamera();
    CAMP.tell({ eyebrow: e.eyebrow, title: e.title, text: e.text, go: 'Back to the title' }, 'camp:title', `<p class="note">${mm} minutes in action. ${STORY.ending.note}</p>`);
  },

  act(a) {
    const [k, x] = a.split(':'), run = CAMP.run;
    if (k === 'new') CAMP.begin(true);
    else if (k === 'continue') CAMP.begin(false);
    else if (k === 'go') CAMP.startMission();
    else if (k === 'port') CAMP.port();
    else if (k === 'brief') CAMP.brief();
    else if (k === 'retry') { CAMP.restore(run.snap); CAMP.startLeg(); }
    else if (k === 'remission') { CAMP.restore(run.start); run.i = 0; CAMP.startLeg(); }
    else if (k === 'abandon') { G.paused = false; E.hideScreen(); if (run) CAMP.restore(run.start); if (CAMP.st.stage === 0) { E.enterHarbor(); E.showTitle(); E.snapCamera(); } else CAMP.port(); }
    else if (k === 'w') CAMP.watch(x);
    else if (k === 'strip') CAMP.strip(+x);
    else if (k === 'flag') CAMP.shiftFlag(+x);
    else if (k === 'next') { run.i++; CAMP.startLeg(); }
    else if (k === 'side') CAMP.takeSide(x);
    else if (k === 'ending') CAMP.ending();
    else if (k === 'title') { E.enterHarbor(); E.showTitle(); E.snapCamera(); }
  },
};
