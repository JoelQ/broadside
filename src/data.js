export const PLAYER_SPEC = {
  name: 'Sea Wren', cls: 'Brig-of-war', L: 30, B: 8, D: 3, masts: 2, sailsPerMast: 2, castle: false,
  hullCol: 0x2f4a6b, trimCol: 0xd9b25f, sailCol: '#efe6cf', emblem: 'cross', emblemCol: '#27558f', flagCol: 0x2b62b8,
  hull: 300, sails: 100, crew: 80, guns: 7, speed: 14, turn: 0.62, reload: 6, disp: 0.02,
  stock: { chain: 6, grape: 6, fire: 3 }, ai: { range: 120, plan: 'round', boarder: false, battleSail: true },
};

// ai.range: preferred gunnery distance. plan: opening ammo doctrine.
export const ENEMIES = [
  {
    name: 'Scavenger', cls: 'Sloop', captain: 'Cutthroat Mags', env: 'noon', islands: 4, bounty: 260,
    blurb: 'A wrecker and a coward with a fast little sloop. She darts in, fires, and runs.',
    tip: 'She is nimble but fragile. Keep her on your beam and trade broadsides — you outgun her.',
    L: 23, B: 6.4, D: 2.5, masts: 1, sailsPerMast: 2, castle: false, rigScale: 1.05,
    hullCol: 0x4a3a2c, trimCol: 0x7c2f24, sailCol: '#b9ad94', emblem: null, flagCol: 0x111111,
    hull: 150, sails: 80, crew: 38, guns: 4, speed: 15.2, turn: 0.78, reload: 7.6, disp: 0.036, dmg: 0.85, melee: 0.85,
    stock: { chain: 2, grape: 2, fire: 0 }, ai: { range: 120, plan: 'round', boarder: false, battleSail: false },
  },
  {
    name: 'Black Tide', cls: 'Brig', captain: 'Captain Varga', env: 'golden', islands: 6, bounty: 420,
    blurb: 'A deserter from the royal fleet. Fights by the book: dismast first, then pound the hull.',
    tip: 'He opens with chain shot. Guard your sails — furl to battle sails when he has you in his arc.',
    L: 30, B: 8, D: 3, masts: 2, sailsPerMast: 2, castle: false,
    hullCol: 0x1d1d22, trimCol: 0x8a8f96, sailCol: '#3a3d45', emblem: 'skull', emblemCol: '#d8d8d8', flagCol: 0x0a0a0a,
    hull: 270, sails: 100, crew: 72, guns: 6, speed: 13.6, turn: 0.6, reload: 7, disp: 0.03, dmg: 0.95, melee: 1,
    stock: { chain: 6, grape: 3, fire: 0 }, ai: { range: 125, plan: 'chain', boarder: false, battleSail: true },
  },
  {
    name: 'Red Sirocco', cls: 'Corsair xebec', captain: 'Yusra the Red', env: 'overcast', islands: 5, bounty: 580,
    blurb: 'Packed to the gunwales with cutthroats. She wants your deck, not your wreck.',
    tip: 'Do NOT let her alongside while her crew outnumbers yours. Grapeshot thins a boarding party fast.',
    L: 31, B: 7.4, D: 2.7, masts: 3, sailsPerMast: 2, castle: false, rigScale: 0.92,
    hullCol: 0x6b1f1a, trimCol: 0xd8a046, sailCol: '#b3372c', emblem: 'stripes', emblemCol: '#e6c069', flagCol: 0xb3221a,
    hull: 250, sails: 110, crew: 135, guns: 6, speed: 14.4, turn: 0.68, reload: 7.4, disp: 0.03, dmg: 0.95, melee: 1.1,
    stock: { chain: 4, grape: 10, fire: 0 }, ai: { range: 90, plan: 'grape', boarder: true, battleSail: false },
  },
  {
    name: "Widow's Lament", cls: 'Frigate', captain: 'Silas Thorne', env: 'dusk', islands: 6, bounty: 780,
    blurb: 'A patient gunner with a furnace below decks. He burns ships from a distance and watches.',
    tip: 'Heated shot starts fires that slow your gun crews. Close the range or use the islands as cover.',
    L: 36, B: 9, D: 3.3, masts: 3, sailsPerMast: 3, castle: true,
    hullCol: 0x2c2a33, trimCol: 0x5d3f7a, sailCol: '#cfc8d6', emblem: 'skull', emblemCol: '#3b2a52', flagCol: 0x3b2a52,
    hull: 390, sails: 120, crew: 115, guns: 9, speed: 14, turn: 0.54, reload: 7.2, disp: 0.025, dmg: 0.95, melee: 1.05,
    stock: { chain: 4, grape: 4, fire: 9 }, ai: { range: 165, plan: 'fire', boarder: false, battleSail: true },
  },
  {
    name: "Leviathan's Maw", cls: 'War galleon', captain: 'Dread Admiral Korrigan', env: 'storm', islands: 5, bounty: 1500,
    blurb: 'The terror of the southern sea: a floating fortress with a broadside that can end you in minutes.',
    tip: 'Never sit on her beam. She turns like an island — stay across her bow or stern and rake her.',
    L: 44, B: 11.5, D: 4, masts: 3, sailsPerMast: 3, castle: true,
    hullCol: 0x16110f, trimCol: 0x9a1c1c, sailCol: '#1b1b1e', emblem: 'skull', emblemCol: '#c22a2a', flagCol: 0x9a1c1c,
    hull: 640, sails: 150, crew: 210, guns: 13, speed: 11.2, turn: 0.4, reload: 8.2, disp: 0.026, dmg: 1.05, melee: 1.15,
    stock: { chain: 2, grape: 8, fire: 6 }, ai: { range: 130, plan: 'mixed', boarder: false, battleSail: true },
  },
];

export const UPGRADES = [
  { id: 'hull', name: 'Oak bracing', desc: '+60 hull', max: 3 },
  { id: 'guns', name: 'Extra gun ports', desc: '+1 gun per broadside', max: 3 },
  { id: 'sail', name: 'Fine canvas', desc: '+7% speed, +20 sails', max: 3 },
  { id: 'drill', name: 'Gun drill', desc: '-10% reload time', max: 3 },
  { id: 'rudder', name: 'Copper sheathing', desc: '+10% turn rate', max: 3 },
  { id: 'marines', name: 'Marines', desc: '+18% boarding strength, +10 crew', max: 3 },
];
export const upgradeCost = (lvl) => [160, 290, 440][lvl];
