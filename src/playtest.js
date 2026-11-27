import { HULLS, OFFICERS, GALLEY_KIT, HANDS } from './fleet.js';
import { KITS } from './data.js';
import { MISSIONS, ORDER, LEG_POOL } from './missions.js';
import { NAMES, SIDE_NAME } from './story.js';

// Playtest tools. Only in the playtest build (`npm run build:playtest` -> dist/playtest.html): the public
// build defines __PLAYTEST__ as false, so esbuild drops every call into this file and the file with them.
// Set up any campaign state (side, mission, leg, ships in harbour, officers, gold, shot) and go straight to
// port, the briefing, or the fight. In a fight the pause menu (P) can win, lose, take a prize, heal, or speed time.
let G, E, CAMP;
const OFF = ['pilot', 'carpenter', 'gunner', 'marines']; // in the order the campaign hands them out
const KIT = { ...KITS, galley: GALLEY_KIT };
const full = (hull) => Object.fromEntries(KIT[HULLS[hull].kit].items.map((it) => [it.id, 2]));
const cls = (h) => HULLS[h].cls;
const $ = (id) => document.getElementById(id);

// every leg you can jump to, for a side: [value, label]
function legChoices(side) {
  const out = [];
  ORDER.forEach((m, i) => {
    const M = MISSIONS[m];
    if (m === 'm2') for (const k of Object.keys(LEG_POOL)) out.push([`${m}:${k}`, `${i}. ${M.title} · ${LEG_POOL[k].title}`]);
    else {
      const legs = M.legs({ side: m === 'm0' ? null : side, rnd: Math.random });
      legs.forEach((l, j) => out.push([`${m}:${j}`, `${i}. ${M.title}${legs.length > 1 ? ` · ${j + 1} of ${legs.length}: ` : ' · '}${l.title}`]));
    }
  });
  return out;
}

const atFor = (stage) => { const m = ORDER[Math.min(stage, ORDER.length - 1)]; return m === 'm2' ? `m2:${Object.keys(LEG_POOL)[0]}` : `${m}:0`; };
// the form starts from the campaign in progress, if any, so you can add a ship without losing your place
function defaults() {
  const st = CAMP.st;
  if (st && G.mode === 'campaign') {
    const hulls = [...new Set(st.stable.map((s) => s.hull))], cur = CAMP.entry(G.ship || st.ship);
    return { side: st.side || 'venice', at: atFor(st.stage), hulls, sail: cur ? cur.hull : hulls[0], fit: false, officers: [...st.officers], gold: G.gold, stock: G.player ? { ...G.player.stock } : { ...st.stock } };
  }
  return { side: 'venice', at: 'm1:0', hulls: ['brig'], sail: 'brig', fit: false, officers: [], gold: 2000, stock: { chain: 8, grape: 8, fire: 5 } };
}
let form = null;

function render() {
  const f = form, legs = legChoices(f.side);
  if (!legs.some(([v]) => v === f.at)) f.at = legs[0][0];
  const stage = ORDER.indexOf(f.at.split(':')[0]);
  const hulls = Object.keys(HULLS).map((h) => `<label class="pt-chk"><input type="checkbox" data-pt="hull" value="${h}" ${f.hulls.includes(h) ? 'checked' : ''}> ${cls(h)}</label>`).join('');
  const sail = f.hulls.map((h) => `<option value="${h}" ${f.sail === h ? 'selected' : ''}>${cls(h)}</option>`).join('');
  const offs = OFF.map((o) => `<label class="pt-chk" title="${OFFICERS[o].does}"><input type="checkbox" data-pt="off" value="${o}" ${f.officers.includes(o) ? 'checked' : ''}> ${OFFICERS[o].name.replace(/^The /, '')}</label>`).join('');
  const num = (k, v) => `<input type="number" min="0" data-pt="${k}" value="${v}">`;
  E.showScreen(`<div class="story wide pt"><div class="eyebrow">Playtest</div><h2>Set the board</h2>
    <div class="pt-grid">
      <span>Side</span><div>${['venice', 'ottoman'].map((s) => `<label class="pt-chk"><input type="radio" name="ptside" data-pt="side" value="${s}" ${f.side === s ? 'checked' : ''}> ${SIDE_NAME[s]}</label>`).join('')}<small>The prologue is always sailed before you choose.</small></div>
      <span>Start at</span><div><select data-pt="at">${legs.map(([v, l]) => `<option value="${v}" ${v === f.at ? 'selected' : ''}>${l}</option>`).join('')}</select><small>${HANDS[Math.min(stage, HANDS.length - 1)]} hands at this stage. Jumping to a later fight of a cruise skips the earlier ones; in Independent command your pick comes first.</small></div>
      <span>In harbour</span><div>${hulls}</div>
      <span>Sail in</span><div><select data-pt="sail">${sail}</select> <label class="pt-chk"><input type="checkbox" data-pt="fit" ${f.fit ? 'checked' : ''}> every ship fully fitted</label></div>
      <span>Officers</span><div>${offs} <button class="btn sm" data-act="pt:offstage">As earned by then</button></div>
      <span>Gold</span><div>${num('gold', f.gold)}</div>
      <span>Shot</span><div>chain ${num('chain', f.stock.chain)} grape ${num('grape', f.stock.grape)} heated ${num('fire', f.stock.fire)}</div>
    </div>
    <div class="rowc"><button class="btn big" data-act="pt:fight">Jump into the fight</button><button class="btn" data-act="pt:brief">To the briefing</button><button class="btn" data-act="pt:port">To port</button></div>
    <p class="note">Playtest progress saves apart from a real campaign. In a fight, pause (P) for win, lose, heal and time controls.</p>
    <div class="pt-grid"><span>Recorded fights</span><div>${recRows()}<small>Copy one and hand it over: the balance tools can play it again exactly.</small></div></div>
    <div class="rowc" style="margin-top:0"><button class="btn sm" data-act="pt:close">Back</button></div></div>`, 'dim');
}

// read the form back whenever anything in it changes
function onChange(e) {
  const el = e.target, k = el.dataset && el.dataset.pt;
  if (!k || !form) return;
  if (k === 'side') form.side = el.value;
  else if (k === 'at') form.at = el.value;
  else if (k === 'sail') form.sail = el.value;
  else if (k === 'fit') form.fit = el.checked;
  else if (k === 'gold') form.gold = Math.max(0, +el.value || 0);
  else if (k === 'chain' || k === 'grape' || k === 'fire') form.stock[k] = Math.max(0, +el.value || 0);
  else if (k === 'hull') {
    form.hulls = el.checked ? [...new Set([...form.hulls, el.value])] : form.hulls.filter((h) => h !== el.value);
    if (!form.hulls.length) form.hulls = [el.value];
    if (!form.hulls.includes(form.sail)) form.sail = form.hulls.includes(el.value) ? el.value : form.hulls[0];
    if (el.checked) form.sail = el.value;
  } else if (k === 'off') form.officers = el.checked ? [...new Set([...form.officers, el.value])] : form.officers.filter((o) => o !== el.value);
  else return;
  if (k === 'side' || k === 'hull') render();
}

// build a campaign state from the form, and go
function start(to) {
  const f = form, [m, leg] = f.at.split(':'), stage = ORDER.indexOf(m), side = m === 'm0' ? null : f.side;
  const st = CAMP.fresh();
  st.side = side; st.stage = stage; st.gold = f.gold; st.officers = OFF.filter((o) => f.officers.includes(o)); st.stock = { ...f.stock };
  st.stable = f.hulls.map((hull, i) => ({ id: 's' + (i + 1), hull, name: (NAMES[side || 'venice'].lent[hull]) || (hull === 'brig' ? NAMES.home : cls(hull)), fit: {} }));
  st.nextId = st.stable.length + 1;
  st.ship = st.stable.find((s) => s.hull === f.sail).id;
  st.fit = f.fit ? Object.fromEntries(st.stable.map((s) => [s.id, full(s.hull)])) : {};
  CAMP.st = st; G.mode = 'campaign'; G.gold = st.gold; G.fit = st.fit; G.ship = st.ship; G.paused = false; G.stats.time = 0; G.ptSpeed = 1;
  form = null;
  CAMP.rebuild();
  G.player.stock = { ...st.stock };
  CAMP.man();
  if (to === 'port') return CAMP.port();
  E.enterHarbor(); E.snapCamera(); CAMP.save();
  if (to === 'brief') return CAMP.brief();
  CAMP.startMission();
  const run = CAMP.run;
  if (m === 'm2') { const pick = LEG_POOL[leg]; run.legs = [pick, ...run.legs.filter((l) => l !== pick)].slice(0, 3); run.i = 0; CAMP.startLeg(); }
  else if (+leg > 0) { run.i = +leg; CAMP.startLeg(); }
}

// ---------- fight recorder ----------
// Every campaign fight in the playtest build is recorded: the seed the rules run on from the moment you engage, the
// state of every ship then, and then every frame's time step, your rudder, and every key you pressed (clicks on the
// HUD's buttons are recorded as their keys). tools/balance/replay-play.mjs plays a recording again with nothing
// drawn, exactly, so a fight a person played can be measured like the harness's own (fight story, dials, a
// different build). Copy one from the pause menu or the playtest panel.
let rec = null;
const SKIP = new Set(['spec', 'model', 'group', 'figs', 'arcs', 'pip', 'target', 'bat', 'main', 'cal', 'sides', 'isPlayer', 'name']);
const flat = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v === null || ['number', 'boolean', 'string'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x === 'number'))));
function shipState(s) {
  const o = { id: s.id || null, cls: s.spec.cls, seedSign: s.spec.seedSign ?? null };
  for (const [k, v] of Object.entries(s)) {
    if (SKIP.has(k) || typeof v === 'function') continue;
    if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) o[k] = v;
    else if (v && typeof v.x === 'number' && typeof v.z === 'number') o[k] = { x: v.x, y: v.y, z: v.z };
    else if (k === 'ai' || k === 'input' || k === 'reload' || k === 'reloadMax' || k === 'stock') o[k] = flat(v);
  }
  o.target = s.target ? G.ships.indexOf(s.target) : -1;
  return o;
}
function recStart() {
  rec = null;
  if (G.mode !== 'campaign' || !CAMP.run) return;
  const st = CAMP.st, run = CAMP.run, legDef = run.legs[run.i], pool = Object.keys(LEG_POOL).find((k) => LEG_POOL[k] === legDef);
  const seed = (Math.random() * 2 ** 31) >>> 0;
  G.seedRng(seed); // from here on the rules' dice come from this seed (the waves' clock starts again too)
  const entry = CAMP.entry(G.ship);
  rec = {
    v: 1, when: new Date().toISOString(), seed, side: st.side, mission: run.key, leg: pool || run.i, title: legDef.title,
    hull: entry ? entry.hull : null, fit: (G.fit && G.fit[G.ship]) || {}, officers: [...st.officers], carry: JSON.parse(JSON.stringify(run.carry || {})),
    start: { ships: G.ships.map(shipState), wind: flat(E.world.wind), g: { battleT: G.battleT, boardCd: G.boardCd, aiGrapple: G.aiGrapple, volley: G.volley } },
    dt: [], turn: [], keys: [], checks: [], tampered: false,
  };
}
function recEnd(outcome) {
  if (!rec) return;
  const p = G.player;
  Object.assign(rec, { outcome, frames: rec.dt.length, t: Math.round(G.battleT), hullLeft: +(p.hull / p.hullMax).toFixed(3), crew: Math.round(p.crew) });
  const all = [rec, ...recordings()].slice(0, 6);
  try { localStorage.setItem('broadside.recordings', JSON.stringify(all)); } catch { /* full, or no storage: it stays in memory */ }
  G.recordings = all; rec = null;
}
const recordings = () => { if (G.recordings) return G.recordings; try { return (G.recordings = JSON.parse(localStorage.getItem('broadside.recordings') || '[]')); } catch { return (G.recordings = []); } };
function copyRecording(i) {
  const r = i === 'now' ? rec : recordings()[+i];
  if (!r) return E.toast('No fight recorded yet', 'bad', 1500);
  navigator.clipboard.writeText(JSON.stringify(r)).then(() => E.toast(`Copied: ${r.title}, ${r.frames ?? r.dt.length} frames`, 'good', 2000), () => E.toast('The browser would not copy', 'bad', 2000));
}
const recRows = () => recordings().map((r, i) => `<div>${r.title} · ${r.hull} · ${r.outcome} at ${r.t}s${r.tampered ? ' (playtest controls used)' : ''} <button class="btn sm" data-act="pt:copy:${i}">Copy</button></div>`).join('') || '<small>None yet: every campaign fight is recorded from the moment you engage.</small>';

const inFight = () => G.state === 'battle' || G.state === 'boarding';
function heal() { const p = G.player; p.hull = p.hullMax; p.sails = p.sailsMax; p.crew = p.crewMax; p.fire = 0; p.stamina = 1; for (const k of ['chain', 'grape', 'fire']) p.stock[k] = Math.max(p.stock[k], 8); }
function resumeThen(fn) { G.paused = false; E.hideScreen(); fn(); }

export const PT = {
  install(g, e, camp) {
    G = g; E = e; CAMP = camp;
    G.ptSpeed = 1; G.ptGod = false;
    document.addEventListener('change', onChange);
    // typing a number into the form must not steer the ship or pause the game
    window.addEventListener('keydown', (ev) => { if (ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) ev.stopImmediatePropagation(); }, true);
    const st = document.createElement('style');
    st.textContent = `.pt-grid{display:grid;grid-template-columns:110px 1fr;gap:10px 14px;align-items:start;font-size:15px;margin:6px 0 14px}
      .pt-grid>span{color:var(--brass);padding-top:3px} .pt-grid small{display:block;opacity:.7;font-size:12.5px;margin-top:3px}
      .pt-chk{display:inline-block;margin:0 14px 4px 0;white-space:nowrap;cursor:pointer} .pt select,.pt input[type=number]{font:15px var(--body);background:rgba(9,18,30,.85);color:var(--cream);border:1px solid var(--line);border-radius:4px;padding:3px 6px}
      .pt input[type=number]{width:70px;margin-right:10px} .pt select{max-width:100%}
      #ptBadge{position:fixed;left:272px;top:10px;z-index:50;font:12px var(--body);letter-spacing:1px;padding:3px 8px;border-radius:4px;background:rgba(184,55,43,.85);color:#fff;pointer-events:auto;cursor:pointer;border:0}
      @media (max-width:700px){.pt-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
    // a badge in the corner so no one mistakes this build for the real one; in port it opens the panel
    const b = document.createElement('button');
    b.id = 'ptBadge'; b.dataset.act = 'pt:badge'; b.textContent = 'PLAYTEST'; b.title = 'Playtest panel (from the title, port or a story page; in a fight, pause with P)';
    document.body.appendChild(b);
    window.PT = PT;
  },
  titleButton: () => '<button class="btn" data-act="pt:open">Playtest</button>',
  pauseRow() {
    const sp = G.ptSpeed || 1;
    return `<div class="eyebrow" style="margin-top:14px">Playtest</div><div class="rowc" style="margin-top:4px;flex-wrap:wrap">
      <button class="btn sm" data-act="pt:win">Win this fight</button><button class="btn sm" data-act="pt:lose">Lose this fight</button>
      <button class="btn sm" data-act="pt:take" ${G.enemy && !G.enemy.out && !G.enemy.spec.fixed ? '' : 'disabled'}>Take ${G.enemy ? G.enemy.name : 'target'} as a prize</button>
      <button class="btn sm" data-act="pt:heal">Repair, man and re-arm</button><button class="btn sm" data-act="pt:god">Unsinkable: ${G.ptGod ? 'on' : 'off'}</button>
      <button class="btn sm" data-act="pt:speed">Time ×${sp} → ×${sp >= 8 ? 1 : sp * 2}</button><button class="btn sm" data-act="pt:open">Playtest panel</button><button class="btn sm" data-act="pt:copy:now">Copy this fight so far</button></div>`;
  },
  // recorder hooks, called by the game: when a fight begins and ends, every frame's time step, every key
  battleStart: () => recStart(),
  current: () => rec, // the fight being recorded, if any (tests read it)
  battleEnd: (o) => recEnd(o),
  frame(dt) {
    dt = Math.round(dt * 10000) / 10000; // recorded steps are tenths of a millisecond, so a replay steps exactly the same
    if (rec && (G.state === 'battle' || G.state === 'boarding')) {
      const k = E.keys, turn = (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0), T = rec.turn, last = T[T.length - 1];
      rec.dt.push(Math.round(dt * 10000));
      if (last && last[0] === turn) last[1]++; else T.push([turn, 1]);
      if (rec.dt.length % 60 === 1) { const p = G.player; rec.checks.push([rec.dt.length - 1, Math.round(p.pos.x * 100), Math.round(p.pos.z * 100), Math.round(p.hull * 100)]); }
    }
    return dt;
  },
  input(k) { if (rec && !G.paused && (G.state === 'battle' || G.state === 'boarding')) rec.keys.push([rec.dt.length, k]); },
  // called every frame by the game loop
  tick() { if (G.ptGod && G.player && inFight()) { const p = G.player; p.hull = Math.max(p.hull, p.hullMax * 0.5); p.sails = Math.max(p.sails, p.sailsMax * 0.5); p.crew = Math.max(p.crew, p.crewMax * 0.5); p.sinking = 0; } },
  act(a) {
    if (a === 'open' || (a === 'badge' && (G.state === 'title' || G.state === 'port' || G.state === 'story'))) { G.paused = false; form = form || defaults(); return render(); }
    if (a === 'badge') return;
    if (a === 'close') { form = null; if (G.state === 'port') return E.hideScreen(); return E.showTitle(); }
    if (a === 'offstage') { form.officers = OFF.slice(0, Math.max(0, ORDER.indexOf(form.at.split(':')[0]))); return render(); }
    if (a === 'fight' || a === 'brief' || a === 'port') return start(a);
    if (a === 'speed') { G.ptSpeed = (G.ptSpeed || 1) >= 8 ? 1 : (G.ptSpeed || 1) * 2; return E.act('resume'); }
    if (a === 'god') { G.ptGod = !G.ptGod; if (rec) rec.tampered = true; return E.act('resume'); }
    if (a === 'heal') { if (rec) rec.tampered = true; return resumeThen(heal); }
    if (a.startsWith('copy:')) return copyRecording(a.slice(5));
    if (!inFight()) return;
    if (rec) rec.tampered = true;
    if (a === 'win') resumeThen(() => { if (G.state === 'boarding') E.cutGrapples(); E.endBattle('won'); });
    else if (a === 'lose') resumeThen(() => { if (G.state === 'boarding') E.cutGrapples(); E.endBattle('failed'); });
    else if (a === 'take') resumeThen(() => { const t = G.enemy; if (G.state === 'boarding') E.cutGrapples(); if (t && !t.out) E.shipOut(t, 'captured'); });
  },
};
