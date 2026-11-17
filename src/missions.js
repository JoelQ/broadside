import { shipSpec } from './fleet.js';

// Every campaign mission, as data the engine can build. Most missions are one scene that changes as it
// goes (events on a clock, ships that wake, arrive or run); the pirate hunt and the finale are cruises of
// several fights with a pause between. A leg is one scene. `build(c)` returns a scenario:
//   env, wind { dir, str, steady }, islands [{ x, z, r }], seedIslands [seed, n], shoals [{ x, z, r, depth }],
//   current(x, z) -> [vx, vz], zones [{ name, x, z, r }], player { x, z, h, speed },
//   ships [{ id, spec, side, x, z, h, o }], objective, tip, check(S) -> 'won' | 'failed' | null, events [{ t, fn(S) }]
// Headings: 0 is +z ("north"), PI/2 is +x ("east"). wind.dir is where the wind blows to.
// c: { side, foe, own, rnd, has(officer), carry } — side is 'venice' | 'ottoman' | null (prologue).
const PI = Math.PI;
const allOut = (S, ids) => ids.every((id) => S.by[id].out);
const pirate = (hull, name, grade, over) => shipSpec(hull, 'pirate', name, grade, over);

// ---------- 0. Home waters ----------
const home = {
  title: 'Home waters',
  build(c) {
    const w = c.rnd() * PI * 2;
    return {
      env: 'noon', wind: { dir: w, str: 1 }, seedIslands: [4242 + ((c.rnd() * 900) | 0), 4], coach: true,
      player: { x: 0, z: 0, h: w + PI / 2, speed: 7 },
      ships: [{ id: 'pirate', spec: pirate('sloop', 'Scavenger', 'poor', { captain: 'Cutthroat Mags', stock: { chain: 2, grape: 2, fire: 0 } }), side: 1, x: Math.sin(w + PI / 2 + 0.4) * 480, z: Math.cos(w + PI / 2 + 0.4) * 480, h: w - PI / 2 }],
      objective: 'Keep the pirate off the harbour: sink her, wreck her or take her',
      tip: 'She is quick but weak. Keep her in your arc and hammer her.',
      check: (S) => (S.by.pirate.out ? 'won' : null),
    };
  },
};

// ---------- 1. Powder for Candia ----------
const candiaCoast = (z) => [-30, 190, 410, 630].map((x, i) => ({ x, z: z + (i % 2) * 30, r: 135 }));
// Venice: one run from the open sea to the harbour. A galliot keeps the picket; the patrol lies off the harbour
// and does not stir until it hears guns or sees you. Shoal banks inshore, and reefs among them that ground anything.
const theRun = {
  title: 'The run',
  build(c) {
    const heard = (S) => { const k = S.by.picket; return k.out || k.hull < k.hullMax || k.sides.some((x) => k.reload[x] > 0); };
    const near = (S, id) => Math.hypot(S.p.pos.x - S.by[id].pos.x, S.p.pos.z - S.by[id].pos.z) < 380;
    return {
      env: 'golden', wind: { dir: PI / 2 - 0.5, str: 1 }, islands: candiaCoast(800),
      shoals: [
        { x: 500, z: 50, r: 160, depth: 2.8 }, { x: 610, z: 300, r: 215, depth: 2.8 }, { x: 520, z: 540, r: 150, depth: 2.8 }, { x: -340, z: 300, r: 115, depth: 3.5 },
        { x: 585, z: 175, r: 34, depth: 1.4 }, { x: 470, z: 420, r: 30, depth: 1.4 }, { x: 150, z: 560, r: 30, depth: 1.4 },
      ],
      player: { x: 0, z: -720, h: 0, speed: 8 },
      zones: [{ name: 'harbour', x: 300, z: 640, r: 75 }],
      ships: [
        { id: 'picket', spec: shipSpec('galliot', c.foe, c.names.picket, 'line'), side: 1, x: 60, z: -260, h: PI },
        { id: 'heavy', spec: shipSpec('merchantman', c.foe, c.names.heavy, 'line', { ai: { reckless: 0.8, range: 130 } }), side: 1, x: -60, z: 240, h: PI / 2, o: { idle: true } },
        { id: 'brig', spec: shipSpec('brig', c.foe, c.names.brig, 'line', { ai: { reckless: 0.8, range: 90 } }), side: 1, x: 190, z: 330, h: -PI / 2, o: { idle: true } },
      ],
      objective: () => (c.S && c.S.flag.alarm ? 'The patrol is under way. Reach the harbour, beat the patrol, or take one of them and sail in under her colours' : 'Bring the powder into Candia. The patrol off the harbour has not seen you yet'),
      tip: 'The pale water is shoal: a ship that draws less than you floats over it, one that draws more sticks. Rocks in the water are reef, and nothing floats over those.',
      events: [
        { t: 5, fn: (S) => S.say('Manolis: “The galliot is their picket. If she fires, the patrol off the harbour will hear it: a hired ship with heavy guns, and a brig. Both draw more water than a sloop.”', '') },
      ],
      check: (S) => {
        if (!S.flag.alarm && (heard(S) || near(S, 'heavy') || near(S, 'brig') || S.t > 90)) { S.flag.alarm = true; S.wake('heavy', 'The patrol has heard the guns: they are getting under way'); S.wake('brig'); }
        return S.inZone('harbour') || allOut(S, ['heavy', 'brig']) || S.by.heavy.out === 'captured' || S.by.brig.out === 'captured' ? 'won' : null;
      },
    };
  },
};
const cove = (c) => ({ islands: [{ x: -180, z: 300, r: 150 }, { x: 215, z: 340, r: 125 }, { x: 0, z: 560, r: 200 }] });
// Ottomans: one approach. A guard ship outside the cove, the powder ship at anchor inside under her battery.
// At dark she weighs and runs for the open sea; if she gets clear, the powder reaches Candia.
const theCove = {
  title: 'The anchorage',
  build(c) {
    const exit = [840, -60];
    return {
      env: 'dusk', wind: { dir: 0.5, str: 0.8 }, ...cove(c),
      player: { x: -200, z: -620, h: 0.3, speed: 7 },
      ships: [
        { id: 'guard', spec: shipSpec('brig', c.foe, c.names.brig, 'line'), side: 1, x: -30, z: -60, h: PI, o: { idle: true } },
        { id: 'powder', spec: shipSpec('merchantman', c.foe, c.names.powder, 'poor', { magazine: 0.12, ai: { cuts: 0.4, plan: 'round' } }), side: 1, x: 25, z: 250, h: PI / 2, o: { crew: 0.6, anchored: true } },
        { id: 'battery', spec: shipSpec('battery', c.foe, 'The battery', 'line', { magazine: 0.05 }), side: 1, x: -95, z: 205, h: 3.6 },
      ],
      focus: 'powder',
      objective: () => { const S = c.S; if (!S) return ''; return S.flag.dark ? 'She is under way for the open sea: stop her before she is clear' : 'Deal with the powder ship before dark: take her, burn her or sink her'; },
      tip: 'The red arc is the battery. It cannot bear east of the anchorage. Powder and fire do not mix.',
      events: [
        { t: 5, fn: (S) => S.say('Manolis: “The battery is on the western point and looks south-west. It was built to stop ships coming the obvious way.”', '') },
        { t: 100, fn: (S) => S.say('The light is going. She will sail when it is gone.', '') },
        { t: 150, fn: (S) => { const w = S.by.powder; S.flag.dark = true; if (w.out || !w.anchored) return; w.weighT = 4; w.ai.goTo = exit; w.keepSail = true; S.addZone({ name: 'sea', x: exit[0], z: exit[1], r: 70, color: 0xff6a5a }); S.say('Dark: the powder ship is weighing anchor'); } },
      ],
      check: (S) => {
        const w = S.by.powder, g = S.by.guard;
        if (g.ai && g.ai.idle && (Math.hypot(S.p.pos.x - g.pos.x, S.p.pos.z - g.pos.z) < 360 || g.hull < g.hullMax || S.t > 60)) S.wake('guard', 'The guard ship has seen you');
        if (!w.out && w.ai && w.ai.goTo && Math.hypot(w.pos.x - exit[0], w.pos.z - exit[1]) < 70) S.escape(w);
        return w.out === 'escaped' ? 'failed' : w.out ? 'won' : null;
      },
      failText: 'The powder ship is away into the dark',
    };
  },
};

// ---------- 2. Independent command: a pool of pirate fights ----------
const POOL = {
  brothers: {
    title: 'The brothers',
    build: (c) => ({
      env: 'noon', wind: { dir: c.rnd() * 6, str: 0.5 }, seedIslands: [913, 3],
      player: { x: 0, z: -300, h: 0, speed: 5 },
      ships: [
        { id: 'a', spec: pirate('galliot', 'Kastor', 'poor'), side: 1, x: -160, z: 260, h: PI },
        { id: 'b', spec: pirate('galliot', 'Polydeukes', 'poor'), side: 1, x: 170, z: 300, h: PI },
      ],
      objective: 'Two galliots hunting as a pair in light airs: finish both',
      tip: 'In light airs they are quicker than you. Grape thins the men at their oars.',
      check: (S) => (allOut(S, ['a', 'b']) ? 'won' : null),
    }),
  },
  leeShore: {
    title: 'A lee shore',
    build: (c) => ({
      env: 'storm', wind: { dir: PI / 2, str: 1.6, steady: true }, islands: [-380, -130, 130, 380].map((z) => ({ x: 430, z, r: 140 })),
      shoals: [{ x: 270, z: -250, r: 60, depth: 3.2 }, { x: 280, z: 0, r: 60, depth: 3.2 }, { x: 270, z: 250, r: 60, depth: 3.2 }],
      player: { x: -60, z: -300, h: 0, speed: 8 },
      ships: [{ id: 'a', spec: pirate('brig', 'Black Tide', 'line', { captain: 'Captain Varga', ai: { plan: 'chain', reckless: 0.5 } }), side: 1, x: -260, z: 250, h: PI }],
      objective: 'A gale, and rocks under your lee: finish the Black Tide without going ashore',
      tip: 'A gale spoils everyone’s gunnery and tears full sail. Shorten sail, and keep off the shore to the east.',
      check: (S) => (S.by.a.out ? 'won' : null),
    }),
  },
  coveRaid: {
    title: 'The careenage',
    build: (c) => ({
      env: 'golden', wind: { dir: 0.5, str: 0.9 }, ...cove(c),
      player: { x: 150, z: -470, h: -0.2, speed: 7 },
      ships: [
        { id: 'a', spec: pirate('xebec', 'Red Sirocco', 'line', { captain: 'Yusra the Red', ai: { cuts: 0.6 } }), side: 1, x: 25, z: 250, h: PI / 2, o: { crew: 0.6, anchored: true } },
        { id: 'b', spec: pirate('sloop', 'Sandfly', 'poor'), side: 1, x: -60, z: 30, h: PI },
      ],
      focus: 'a',
      objective: 'The Red Sirocco lies at anchor with half her crew ashore: finish her before she can get under way',
      tip: 'At anchor she can only haul herself round slowly. Her lookout sloop will try to keep you busy.',
      check: (S) => (S.by.a.out ? 'won' : null),
    }),
  },
  landing: {
    title: 'The landing',
    build: (c) => ({
      env: 'dusk', wind: { dir: -0.6, str: 1 }, islands: [{ x: 60, z: 430, r: 190 }],
      player: { x: -120, z: -480, h: 0.2, speed: 7 },
      ships: [{ id: 'a', spec: pirate('merchantman', 'Widow’s Lament', 'line', { captain: 'Silas Thorne', ai: { cuts: 0.75 } }), side: 1, x: 10, z: 215, h: PI / 2, o: { crew: 0.45, anchored: true } }],
      objective: () => (c.S && c.S.flag.back ? 'Her boats are back aboard: finish the Widow’s Lament' : 'Thorne’s men are ashore in the village: strike before the boats come back'),
      tip: 'She is at anchor with fewer than half her men aboard. That will not last.',
      events: [{ t: 110, fn: (S) => { const a = S.by.a; if (a.out) return; S.flag.back = true; a.crew = Math.max(a.crew, a.crewMax * 0.9); if (a.anchored) a.weighT = 3; S.say('Her boats are back: she is manned again, and weighing'); } }],
      check: (S) => (S.by.a.out ? 'won' : null),
    }),
  },
  islets: {
    title: 'Among the islets',
    build: (c) => ({
      env: 'overcast', wind: { dir: c.rnd() * 6, str: 1 }, seedIslands: [5150, 9],
      shoals: [{ x: -150, z: 200, r: 80, depth: 2.6 }, { x: 180, z: 330, r: 90, depth: 2.6 }, { x: 20, z: 480, r: 70, depth: 2.6 }, { x: -260, z: 420, r: 70, depth: 2.6 }],
      player: { x: 0, z: -350, h: 0, speed: 7 },
      ships: [{ id: 'a', spec: pirate('sloop', 'Scavenger II', 'line', { captain: 'Mags’s daughter', ai: { range: 130 } }), side: 1, x: 40, z: 330, h: PI }],
      objective: 'A sloop that knows every rock here: run her down among the islets',
      tip: 'She floats over the shoals; a deeper ship does not. Chain shot will slow her.',
      check: (S) => (S.by.a.out ? 'won' : null),
    }),
  },
  falseColours: {
    title: 'False colours',
    build: (c) => ({
      env: 'golden', wind: { dir: PI / 2, str: 1 }, seedIslands: [8086, 3],
      player: { x: 0, z: -420, h: 0, speed: 6 },
      ships: [{ id: 'a', spec: pirate('flagship', 'Leviathan’s Maw', 'line', { captain: 'Korrigan' }), side: 1, x: -40, z: 220, h: PI / 2, o: { crew: 0.6, hold: true, sail: 1 } }],
      objective: () => (c.S && c.S.by.a.ai.hold ? 'She takes you for a friend. Choose your moment: she will know you when you fire or come within a ship’s length' : 'Finish the Leviathan’s Maw'),
      tip: 'Under a borrowed flag you may come as close as you dare. Your first broadside is free; make it a rake.',
      check: (S) => (S.by.a.out ? 'won' : null),
    }),
  },
};
const independent = {
  title: 'Independent command',
  legs(c) {
    const keys = Object.keys(POOL), pick = [];
    while (pick.length < 3) { const k = keys.splice((c.rnd() * keys.length) | 0, 1)[0]; pick.push(POOL[k]); }
    return pick;
  },
};

// ---------- 3. The calm ----------
// One scene. A dead calm with galleys coming out; at about two minutes the wind fills in from the north-east
// and brings a sailing ship with it. A sailing ship holds on until it can move; a galley tries to finish first.
const calm = {
  title: 'Dead calm',
  build(c) {
    const W = 1.2 + PI, up = [Math.sin(1.2) * 560, Math.cos(1.2) * 560];
    return {
      env: 'golden', wind: { dir: W, str: 0.05, steady: true }, seedIslands: [1654, 2],
      player: { x: 0, z: 0, h: 0, speed: 0 },
      ships: [
        { id: 'g1', spec: shipSpec('galley', c.foe, c.names.galley1, 'line'), side: 1, x: -260, z: 430, h: PI - 0.5 },
        { id: 'g2', spec: shipSpec('galliot', c.foe, c.names.galley2, 'line'), side: 1, x: 280, z: 400, h: PI + 0.5 },
      ],
      objective: () => { const S = c.S; if (!S) return ''; return S.flag.breeze ? 'The breeze has brought one of their sailing ships: finish her, and any galley that stays to fight' : S.t > 95 ? 'Wind is coming from the north-east. Hold on' : 'No wind, and two galleys coming out under oars: live through the calm'; },
      tip: 'Without wind a sailing ship barely steers. G drops anchor: she holds still, her guns steady, and a spring on the cable lets A and D haul her broadside round.',
      events: [
        { t: 6, fn: (S) => { if (!S.p.spec.oars) S.say('Manolis: “No steerage way. Anchor, and we can still swing her on the spring.”', ''); } },
        { t: 95, fn: (S) => S.say(c.has('pilot') ? 'Pilot: “Wind on the water to the north-east. A little longer.”' : 'Dark water to the north-east: wind is coming') },
        { t: 110, fn: (S) => S.wind(W, 0.5) },
        { t: 130, fn: (S) => { S.wind(W, 1); S.flag.breeze = true; S.say('The breeze is here. Manolis points north-east: a tall ship, coming down with the wind behind her. “They sent a friend.”'); S.add({ id: 'sail', spec: shipSpec('merchantman', c.foe, c.names.heavy, 'line'), side: 1, x: up[0], z: up[1], h: Math.atan2(-up[0], -up[1]), o: { speed: 8 } }); } },
      ],
      check: (S) => {
        if (!S.flag.breeze) return null;
        // once a sailing ship can move again, a beaten galley has no reason to stay
        for (const id of ['g1', 'g2']) { const g = S.by[id], d = Math.hypot(g.pos.x - S.p.pos.x, g.pos.z - S.p.pos.z) || 1; if (!g.out && (g.hullR < 0.6 || g.crewR < 0.55)) S.flee(g, [g.pos.x + ((g.pos.x - S.p.pos.x) / d) * 900, g.pos.z + ((g.pos.z - S.p.pos.z) / d) * 900]); }
        return allOut(S, ['g1', 'g2', 'sail']) ? 'won' : null;
      },
    };
  },
};

// ---------- 4. The straits ----------
// The channel runs north-south. The current sets south, out to sea, strongest in the middle; inshore
// there is slack water, a back-eddy and shoals. The wind blows down the channel too.
const straitShores = () => [-920, -690, -460, -230, 0, 230, 460, 690, 920].flatMap((z) => [{ x: -400, z, r: 150 }, { x: 400, z, r: 150 }]);
const straitCurrent = (x) => { const a = Math.abs(x); return [0, a < 190 ? -3 * (1 - (a / 190) ** 2) - 0.3 : a < 270 ? 1.1 : 0]; };
const straitShoals = (zs) => zs.flatMap((z) => [{ x: -232, z, r: 42, depth: 2.8 }, { x: 232, z: z + 60, r: 42, depth: 2.8 }]);
const strait = () => ({ islands: straitShores(), current: straitCurrent, wind: { dir: PI - 1.1, str: 1, steady: true } });
// Venice: one scene. Up the strait past the castles, destroy the flagship fitting out above them, and get out
// again on the current.
const upStrait = {
  title: 'Up the strait',
  build(c) {
    return {
      env: 'golden', ...strait(), shoals: straitShoals([-520, -330, -150, 30, 210, 390]),
      player: { x: 0, z: -800, h: 0.5, speed: 6 },
      ships: [
        { id: 'west', spec: shipSpec('castle', c.foe, c.names.castleW, 'line'), side: 1, x: -262, z: -160, h: PI / 2 },
        { id: 'east', spec: shipSpec('castle', c.foe, c.names.castleE, 'line'), side: 1, x: 262, z: -130, h: -PI / 2 },
        { id: 'flag', spec: shipSpec('flagship', c.foe, c.names.flag, 'poor', { guns: 9, magazine: 0.04, ai: { cuts: 0.3 } }), side: 1, x: 110, z: 470, h: 0, o: { crew: 0.4, sails: 0.3, anchored: true } },
        { id: 'guard', spec: shipSpec('brig', c.foe, c.names.brig, 'poor'), side: 1, x: -40, z: 290, h: PI, o: { idle: true } },
      ],
      focus: 'flag',
      objective: () => { const S = c.S; if (!S) return ''; return S.by.flag.out ? 'She is finished. Now get out: ride the current south, past the castles' : 'Go up past the castles, against wind and current, and destroy or take the flagship fitting out above them'; },
      tip: 'The current is strongest in mid-channel. Inshore there is slack water and an eddy that sets north, among the shoals and under the castle guns.',
      check: (S) => {
        const f = S.by.flag, g = S.by.guard;
        if (!S.flag.above && S.p.pos.z > 0) { S.flag.above = true; S.say('Barbaro, at the glass: “There. Yards down on deck, lighters alongside. And one guard ship.” Whatever is done to her, the way home is the way you came.', ''); }
        if (g.ai && g.ai.idle && (S.p.pos.z > 60 || g.hull < g.hullMax)) S.wake('guard', 'The guard ship is coming down on you');
        if (f.out === 'captured') return 'won';
        if (f.out && !S.flag.exit) { S.flag.exit = true; S.addZone({ name: 'out', x: 0, z: -800, r: 120 }); S.say('Now get out: ride the current south'); }
        return f.out && S.inZone('out') ? 'won' : null;
      },
    };
  },
};
// Ottomans: one scene. Down the strait on the current, past the watch galley, to break the blockade at the mouth.
const downStrait = {
  title: 'Down the strait',
  build(c) {
    return {
      env: 'golden', ...strait(), shoals: straitShoals([-560, -200, 100, 400]),
      player: { x: 0, z: 800, h: PI, speed: 8 },
      ships: [
        { id: 'picket', spec: shipSpec('galley', c.foe, c.names.galley1, 'line'), side: 1, x: 40, z: 320, h: 0 },
        { id: 'heavy', spec: shipSpec('merchantman', c.foe, c.names.heavy, 'line', { ai: { cuts: 0.5 } }), side: 1, x: -85, z: -400, h: PI / 2, o: { anchored: true } },
        { id: 'brig', spec: shipSpec('brig', c.foe, c.names.brig, 'crack', { ai: { cuts: 0.5 } }), side: 1, x: 95, z: -390, h: -PI / 2, o: { anchored: true } },
      ],
      focus: 'heavy',
      objective: 'Break the blockade at the mouth: take, sink or burn one of the two anchored ships, or make her cut her cable',
      tip: 'Coming down is fast and hard to undo; the eddies inshore are the only way back up. The blockade cannot dodge. Neither can you, once the current has you.',
      check: (S) => {
        if (!S.flag.seen && S.p.pos.z < -60) { S.flag.seen = true; S.say('İbrahim Reis: “They cannot run. Remember that neither can we.”', ''); }
        return S.by.heavy.out || S.by.brig.out || S.flag.cut ? 'won' : null;
      },
    };
  },
};

// ---------- 5. Candia ----------
const harbourCoast = () => [-450, -150, 150, 450].map((x) => ({ x, z: 470, r: 190 }));
const assaultMouth = {
  title: 'The mole',
  build(c) {
    return {
      env: 'dusk', wind: { dir: 0.4, str: 1 }, islands: harbourCoast(),
      player: { x: -60, z: -560, h: 0.1, speed: 7 },
      ships: [
        { id: 'koules', spec: shipSpec('koules', c.foe, c.names.koules, 'line'), side: 1, x: 40, z: 250, h: PI },
        { id: 'battery', spec: shipSpec('battery', c.foe, 'The mole battery', 'line', { magazine: 0.07, crew: 75 }), side: 1, x: -205, z: 262, h: PI + 0.75 },
        { id: 'guard', spec: shipSpec('galliot', c.foe, c.names.picket, 'line'), side: 1, x: -120, z: 60, h: PI },
      ],
      focus: 'battery',
      objective: 'Open the harbour mouth: silence the mole battery or fire its magazine, by any means',
      tip: 'The fortress covers the open water to the south. The mole battery cannot bear along the shore to the west of it.',
      check: (S) => (S.by.battery.out ? 'won' : null),
    };
  },
};
const melee = {
  title: 'The harbour',
  build(c) {
    const f = [['brig', -220, 80], ['xebec', 0, 140], ['merchantman', 230, 100]], e = [['brig', -220, 330], ['galley', 10, 380], ['merchantman', 240, 350]];
    return {
      env: 'dusk', wind: { dir: PI / 2 + 0.2, str: 1 }, seedIslands: [1669, 2],
      player: { x: 0, z: -260, h: 0, speed: 6 },
      ships: [
        ...f.map(([h, x, z], i) => ({ id: 'f' + i, spec: shipSpec(h, c.own, c.names.friends[i], 'poor'), side: 0, x, z, h: 0 })),
        ...e.map(([h, x, z], i) => ({ id: 'e' + i, spec: shipSpec(h, c.foe, c.names.foes[i], 'line'), side: 1, x, z, h: PI })),
      ],
      objective: () => { const S = c.S; if (!S) return ''; const n = ['e0', 'e1', 'e2'].filter((id) => !S.by[id].out).length, m = ['f0', 'f1', 'f2'].filter((id) => !S.by[id].out).length; return `Both fleets are paired off around you. Choose where to weigh in — theirs still fighting: ${n} · ours: ${m}`; },
      tip: 'T picks your target. A ship already fighting one of ours has her attention elsewhere.',
      check: (S) => (allOut(S, ['e0', 'e1', 'e2']) ? 'won' : null),
    };
  },
};
const flagDuel = (attacker) => ({
  title: 'The flagship',
  build(c) {
    const fortSide = attacker ? 1 : 0;
    return {
      env: 'storm', wind: { dir: PI / 2, str: 1 }, islands: harbourCoast(),
      shoals: [{ x: -260, z: 60, r: 70, depth: 3.5 }, { x: 300, z: 20, r: 80, depth: 3.5 }],
      player: { x: -40, z: -420, h: 0, speed: 6 },
      ships: [
        { id: 'flag', spec: shipSpec('flagship', c.foe, c.names.flag, 'line'), side: 1, x: 60, z: 40, h: PI, o: { crew: 0.7, hull: 0.65 } },
        { id: 'koules', spec: shipSpec('koules', attacker ? c.foe : c.own, c.names.koules, 'line'), side: fortSide, x: 40, z: 250, h: PI, o: attacker ? { hull: 0.6, crew: 0.6 } : { hull: 0.35, crew: 0.4 } },
      ],
      objective: attacker ? 'Their flagship stands between you and the city. Finish her, and mind the fortress' : 'Their commander is coming in. Finish his flagship under what is left of your own guns',
      tip: attacker ? 'The fortress arcs are drawn on the water. Fight her outside them if you can.' : 'The fortress still has a few guns. Draw him under them.',
      check: (S) => (S.by.flag.out ? 'won' : null),
    };
  },
});
const sortie = {
  title: 'The sortie',
  build(c) {
    const mole = [0, 230];
    const fs = [[-200, -720], [0, -800], [210, -700]];
    return {
      env: 'dusk', wind: { dir: 1.2, str: 1, steady: true }, islands: harbourCoast(),
      player: { x: 0, z: 80, h: PI, speed: 7 },
      zones: [{ name: 'mole', x: mole[0], z: mole[1], r: 55, color: 0xff6a5a }],
      ships: [
        ...fs.map(([x, z], i) => ({ id: 'fs' + i, spec: shipSpec('sloop', c.foe, 'Fireship', 'poor', { guns: 0, bow: { n: 1, cal: 0, arc: 0.2 }, magazine: 0.3, fuse: 2, speed: 8, stock: {} }), side: 1, x, z, h: 0, o: { crew: 0.3, goTo: mole, sail: 3 } })),
        { id: 'escort', spec: shipSpec('galliot', c.foe, c.names.galley1, 'line'), side: 1, x: 60, z: -520, h: 0 },
      ],
      focus: 'fs1',
      objective: () => { const S = c.S; if (!S) return ''; return `Fireships are coming in on the wind for the mole. Stop at least two of the three — stopped: ${S.flag.stopped || 0} · got through: ${S.flag.through || 0}`; },
      tip: 'They are packed with powder: fire is quickest. Do not be alongside when one goes up.',
      check: (S) => {
        let stopped = 0, through = 0;
        for (let i = 0; i < 3; i++) {
          const f = S.by['fs' + i];
          if (!f.out && Math.hypot(f.pos.x - mole[0], f.pos.z - mole[1]) < 55) { S.blow(f); f.reached = true; }
          if (f.reached) through++; else if (f.out) stopped++;
        }
        S.flag.stopped = stopped; S.flag.through = through;
        return through >= 2 ? 'failed' : stopped >= 2 ? 'won' : null;
      },
      failText: 'The mole is burning',
    };
  },
};

export const MISSIONS = {
  m0: { title: 'Home waters', pay: 150, legs: () => [home] },
  m1: { title: 'Powder for Candia', pay: 350, legs: (c) => (c.side === 'venice' ? [theRun] : [theCove]) },
  m2: { title: 'Independent command', pay: 450, legs: (c) => independent.legs(c) },
  m3: { title: 'The calm', pay: 500, legs: () => [calm] },
  m4: { title: 'The straits', pay: 600, legs: (c) => (c.side === 'venice' ? [upStrait] : [downStrait]) },
  m5: { title: 'Candia', pay: 0, legs: (c) => (c.side === 'venice' ? [sortie, melee, flagDuel(false)] : [assaultMouth, melee, flagDuel(true)]) },
};
export const ORDER = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];
export const LEG_POOL = POOL;
