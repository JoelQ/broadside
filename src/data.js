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
    L: 23, B: 6.4, D: 2.5, masts: 1, sailsPerMast: 2, castle: false, rigScale: 1.05,
    hullCol: 0x4a3a2c, trimCol: 0x7c2f24, sailCol: '#b9ad94', emblem: null, flagCol: 0x111111,
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
    L: 31, B: 7.4, D: 2.7, masts: 3, sailsPerMast: 2, castle: false, rigScale: 0.92,
    hullCol: 0x6b1f1a, trimCol: 0xd8a046, sailCol: '#b3372c', emblem: 'stripes', emblemCol: '#e6c069', flagCol: 0xb3221a,
    hull: 215, sails: 110, crew: 135, guns: 7, speed: 13.5, turn: 0.58, reload: 7.4, disp: 0.032, dmg: 0.9, melee: 1.1, cal: 0, arc: 0.6, point: 0.2,
    stock: { chain: 4, grape: 10, fire: 0 }, ai: { range: 90, plan: 'grape', boarder: true, battleSail: false },
  },
  {
    name: "Widow's Lament", cls: 'Frigate', captain: 'Silas Thorne', env: 'dusk', islands: 6, bounty: 780,
    hook: 'Heavy guns that outreach yours and a furnace to heat the shot. Barely enough hands to work them.',
    tip: 'His guns outreach yours and hit hard, but load slowly and only bear square off his sides. Get past them, or get aboard.',
    L: 36, B: 9, D: 3.3, masts: 3, sailsPerMast: 3, castle: true,
    hullCol: 0x2c2a33, trimCol: 0x5d3f7a, sailCol: '#cfc8d6', emblem: 'skull', emblemCol: '#3b2a52', flagCol: 0x3b2a52,
    hull: 460, sails: 120, crew: 64, guns: 10, speed: 12.4, turn: 0.32, reload: 7, disp: 0.024, dmg: 1, melee: 1, cal: 2, arc: 0.42, point: 0,
    stock: { chain: 4, grape: 4, fire: 9 }, ai: { range: 215, plan: 'fire', boarder: false, battleSail: true },
  },
  {
    name: "Leviathan's Maw", cls: 'War galleon', captain: 'Dread Admiral Korrigan', env: 'storm', islands: 5, bounty: 1500,
    hook: 'Twenty-six heavy guns. She outreaches you, and she turns like an island.',
    tip: 'Her guns only bear square off her sides. Get past them, sit astern, and stay there.',
    L: 44, B: 11.5, D: 4, masts: 3, sailsPerMast: 3, castle: true,
    hullCol: 0x16110f, trimCol: 0x9a1c1c, sailCol: '#1b1b1e', emblem: 'skull', emblemCol: '#c22a2a', flagCol: 0x9a1c1c,
    hull: 640, sails: 150, crew: 210, guns: 13, speed: 11.2, turn: 0.21, reload: 7.4, disp: 0.026, dmg: 1, melee: 1.15, cal: 2, arc: 0.38, point: -0.1,
    stock: { chain: 2, grape: 8, fire: 6 }, ai: { range: 190, plan: 'mixed', boarder: false, battleSail: true },
  },
];

// Port Halcyon: what each building on the quay sells.
export const UPGRADES = {
  hull: { name: 'Oak bracing', desc: '+60 hull. The weight costs 3% speed' },
  rudder: { name: 'Copper sheathing', desc: '+10% turn' },
  sail: { name: 'Fine canvas', desc: '+7% speed, +20 sails' },
  guns: { name: 'Extra gun ports', desc: '+1 gun per side. The weight costs 3% speed' },
  cal: { name: 'Heavier guns', desc: 'Longer reach, harder hits, slower to load, 5% slower ship', max: 1, cost: 380 },
  drill: { name: 'Gun drill', desc: '−10% reload' },
  marines: { name: 'Marines', desc: '+18% in a boarding, +10 crew' },
};
export const SHOPS = {
  wright: { repair: 'hull', ups: ['hull', 'rudder'] },
  sails: { repair: 'sails', ups: ['sail'] },
  guns: { ups: ['guns', 'cal', 'drill'] },
  tavern: { repair: 'crew', ups: ['marines'] },
  stores: { ammo: [['chain', 3, 25], ['grape', 3, 40], ['fire', 2, 35]] },
};
export const REPAIR = { hull: ['Repair hull', 0.6], sails: ['Mend sails', 0.5], crew: ['Sign on hands', 3] };
export const upgradeCost = (lvl) => [160, 290, 440][lvl];
