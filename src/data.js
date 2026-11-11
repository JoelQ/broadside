export const PLAYER_SPEC = {
  name: 'Sea Wren', cls: 'Brig-of-war', L: 30, B: 8, D: 3, masts: 2, sailsPerMast: 2, castle: false,
  hullCol: 0x2f4a6b, trimCol: 0xd9b25f, sailCol: '#efe6cf', emblem: 'cross', emblemCol: '#27558f', flagCol: 0x2b62b8,
  hull: 300, sails: 100, crew: 80, guns: 7, speed: 14, turn: 0.5, reload: 6, disp: 0.021, cal: 1, arc: 0.5, point: 0,
  crewCols: [0x2b5fa8, 0xe8e2d0, 0x1f3f70, 0xc9a24a],
  stock: { chain: 6, grape: 6, fire: 3 }, ai: { range: 120, plan: 'round', boarder: false, battleSail: true },
};

// ai.range: preferred gunnery distance. plan: opening ammo doctrine.
export const ENEMIES = [
  {
    name: 'Scavenger', cls: 'Sloop', captain: 'Cutthroat Mags', env: 'noon', islands: 4, bounty: 260,
    hook: 'Light guns that must get close. Quick, and she sails nearer the wind than you can.',
    tip: 'She is quick but weak. Keep her in your arc and hammer her.',
    L: 20, B: 5.8, D: 2.2, masts: 1, sailsPerMast: 2, castle: false, rigScale: 1.25,
    rig: 'gaff', hullCol: 0x4a3a2c, trimCol: 0x7c2f24, sailCol: '#b9ad94', emblem: null, flagCol: 0x111111,
    hull: 165, sails: 80, crew: 38, guns: 5, speed: 15.6, turn: 0.78, reload: 7.4, disp: 0.036, dmg: 0.9, melee: 0.85, cal: 0, arc: 0.7, point: 0.26,
    stock: { chain: 2, grape: 2, fire: 0 }, ai: { range: 110, plan: 'round', boarder: false, battleSail: false },
  },
  {
    name: 'Black Tide', cls: 'Brig', captain: 'Captain Varga', env: 'golden', islands: 6, bounty: 420,
    hook: 'Shreds your sails first, then pounds the hull.',
    tip: 'He opens with chain shot. Less sail means less to shred.',
    L: 30, B: 8, D: 3, masts: 2, sailsPerMast: 2, castle: false,
    hullCol: 0x1d1d22, trimCol: 0x8a8f96, sailCol: '#3a3d45', emblem: 'skull', emblemCol: '#d8d8d8', flagCol: 0x0a0a0a,
    hull: 270, sails: 100, crew: 72, guns: 6, speed: 13.6, turn: 0.48, reload: 7, disp: 0.03, dmg: 0.95, melee: 1, cal: 1, arc: 0.5, point: 0,
    stock: { chain: 6, grape: 3, fire: 0 }, ai: { range: 125, plan: 'chain', boarder: false, battleSail: true },
  },
  {
    name: 'Red Sirocco', cls: 'Corsair xebec', captain: 'Yusra the Red', env: 'overcast', islands: 5, bounty: 580,
    hook: '135 cutthroats behind light guns. She wants your deck.',
    tip: 'Never let her alongside. Her hull is thin: keep your distance and hammer it.',
    L: 36, B: 7.2, D: 2.5, masts: 3, sailsPerMast: 2, castle: false, rigScale: 0.72,
    rig: 'lateen', hullCol: 0x6b1f1a, trimCol: 0xd8a046, sailCol: '#b3372c', emblem: 'stripes', emblemCol: '#e6c069', flagCol: 0xb3221a,
    hull: 215, sails: 110, crew: 135, guns: 7, speed: 13.5, turn: 0.58, reload: 7.4, disp: 0.032, dmg: 0.9, melee: 1.1, cal: 0, arc: 0.6, point: 0.2,
    stock: { chain: 4, grape: 10, fire: 0 }, ai: { range: 90, plan: 'grape', boarder: true, battleSail: false },
  },
  {
    name: "Widow's Lament", cls: 'Frigate', captain: 'Silas Thorne', env: 'dusk', islands: 6, bounty: 780,
    hook: 'Heavy guns that outreach yours and a furnace to heat the shot. Barely enough hands to work them.',
    tip: 'His guns outreach yours and hit hard, but load slowly and only bear square off his sides. Get past them, or get aboard.',
    L: 46, B: 11.2, D: 4.3, masts: 3, sailsPerMast: 3, castle: 1,
    rigScale: 0.88, decks: 1, hullCol: 0x2c2a33, trimCol: 0x5d3f7a, sailCol: '#cfc8d6', emblem: 'skull', emblemCol: '#3b2a52', flagCol: 0x3b2a52,
    hull: 500, sails: 120, crew: 64, guns: 12, speed: 12.4, turn: 0.32, reload: 6.6, disp: 0.021, dmg: 1, melee: 1, cal: 2, arc: 0.42, point: 0,
    stock: { chain: 4, grape: 4, fire: 9 }, ai: { range: 180, plan: 'fire', boarder: false, battleSail: true },
  },
  {
    name: "Leviathan's Maw", cls: 'War galleon', captain: 'Dread Admiral Korrigan', env: 'storm', islands: 5, bounty: 1500,
    hook: 'Thirty-six heavy guns on two decks. She outreaches you, and she turns like an island.',
    tip: 'Her guns only bear square off her sides. Get past them, sit astern, and stay there.',
    L: 64, B: 16, D: 6.2, masts: 4, sailsPerMast: 4, castle: 2,
    fore: true, rigScale: 0.74, decks: 2, hullCol: 0x16110f, trimCol: 0x9a1c1c, sailCol: '#1b1b1e', emblem: 'skull', emblemCol: '#c22a2a', flagCol: 0x9a1c1c,
    hull: 820, sails: 170, crew: 210, guns: 18, speed: 11.2, turn: 0.21, reload: 7.2, disp: 0.024, dmg: 1, melee: 1.15, cal: 2, arc: 0.38, point: -0.1,
    stock: { chain: 2, grape: 8, fire: 6 }, ai: { range: 190, plan: 'mixed', boarder: false, battleSail: true },
  },
];

// Fittings belong to a ship and make her better at what she already is. Each has two levels.
// `at` is the building on the quay that sells it. Effects: numbers under `mul` multiply per
// level, numbers under `add` add per level.
const DRILL = { id: 'drill', at: 'guns', name: 'Gun drill', desc: 'Load 10% faster', mul: { reload: 0.9 } };
export const KITS = {
  runner: { name: 'Runner', items: [
    { id: 'canvas', at: 'sails', name: 'Racing canvas', desc: '+7% speed', mul: { speed: 1.07 } },
    { id: 'helm', at: 'wright', name: 'Balanced rudder', desc: '+12% faster helm', mul: { turn: 1.12 } },
    { id: 'pivots', at: 'guns', name: 'Pivot mounts', desc: 'Guns sweep wider and load 10% faster', mul: { arc: 1.1, reload: 0.9 } },
    { id: 'low', at: 'wright', name: 'Cut-down topsides', desc: 'A smaller target: shot aimed at you scatters 15% wider', mul: { evade: 1.15 } },
  ] },
  line: { name: 'All-rounder', items: [
    DRILL,
    { id: 'ports', at: 'guns', name: 'Extra gun ports', desc: '+1 gun per side', add: { guns: 1 } },
    { id: 'canvas', at: 'sails', name: 'Fine canvas', desc: '+5% speed', mul: { speed: 1.05 } },
    { id: 'oak', at: 'wright', name: 'Oak bracing', desc: '+45 hull', add: { hull: 45 } },
  ] },
  boarder: { name: 'Boarder', items: [
    { id: 'marines', at: 'tavern', name: 'Marines', desc: '+15 crew and +15% strength in a boarding', add: { crew: 15 }, mul: { melee: 1.15 } },
    { id: 'hooks', at: 'wright', name: 'Grappling crews', desc: 'Board from 30% further off, at a bigger speed gap', mul: { boardReach: 1.3, boardSpeed: 1.4 } },
    { id: 'rail', at: 'guns', name: 'Rail guns', desc: 'Point-blank volley and swivel gun kill 40% more', mul: { swivel: 1.4 } },
    { id: 'sweeps', at: 'sails', name: 'Sweeps', desc: 'Oars: +3 knots whatever the wind, even dead into it', add: { sweeps: 3.4 } },
  ] },
  gun: { name: 'Gun platform', items: [
    { id: 'charge', at: 'guns', name: 'Heavier charges', desc: '+8% reach', mul: { reach: 1.08 } },
    DRILL,
    { id: 'ports', at: 'guns', name: 'Extra gun ports', desc: '+1 gun per side', add: { guns: 1 } },
    { id: 'oak', at: 'wright', name: 'Oak bracing', desc: '+70 hull', add: { hull: 70 } },
  ] },
};
export const KIT_OF = { wren: 'line', 0: 'runner', 1: 'line', 2: 'boarder', 3: 'gun', 4: 'gun' };
export const kitCost = (lv) => [220, 380][lv];
export const SHOPS = { wright: { repair: 'hull' }, sails: { repair: 'sails' }, guns: {}, tavern: { repair: 'crew' }, stores: { ammo: [['chain', 3, 25], ['grape', 3, 40], ['fire', 2, 35]] } };
export const REPAIR = { hull: ['Repair hull', 0.6], sails: ['Mend sails', 0.5], crew: ['Sign on hands', 3] };
