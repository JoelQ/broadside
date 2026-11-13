// The campaign's ships: one catalogue of hulls, dressed in the colours of whoever sails them.
// Numbers here are the hull in good hands (yours). An enemy ship is the same hull under a
// `grade`, which makes her gunnery and drill a little worse than yours.

export const HULLS = {
  sloop: {
    cls: 'Sloop', kit: 'runner', value: 260, L: 20, B: 5.8, D: 2.2, masts: 1, sailsPerMast: 2, castle: false, rigScale: 1.25, rig: 'gaff',
    hull: 165, sails: 80, crew: 38, guns: 5, speed: 15.6, turn: 0.78, reload: 6.4, cal: 0, arc: 0.7, point: 0.26,
    role: 'Darts and turns on a coin, sails closer to the wind than anything afloat, and floats over most shoals. Light guns with a wide sweep; a thin hull.',
    ai: { range: 110, plan: 'round', boarder: false, battleSail: false },
  },
  brig: {
    cls: 'Brig', kit: 'line', value: 420, L: 30, B: 8, D: 3, masts: 2, sailsPerMast: 2, castle: false,
    hull: 300, sails: 100, crew: 80, guns: 7, speed: 14, turn: 0.5, reload: 6, cal: 1, arc: 0.5, point: 0,
    role: 'A sound, balanced ship. Does everything fairly well.',
    ai: { range: 120, plan: 'round', boarder: false, battleSail: true },
  },
  xebec: {
    cls: 'Xebec', kit: 'boarder', value: 580, L: 36, B: 7.2, D: 2.5, masts: 3, sailsPerMast: 2, castle: false, rigScale: 0.72, rig: 'lateen',
    hull: 215, sails: 110, crew: 135, guns: 7, speed: 13.5, turn: 0.58, reload: 6.4, cal: 0, arc: 0.6, point: 0.2,
    role: 'Room for a huge crew: made for boarding. Light quick-firing guns, a thin hull, shallow enough for shoal water, and she points well to windward.',
    ai: { range: 90, plan: 'grape', boarder: true, battleSail: false },
  },
  merchantman: {
    cls: 'Armed merchantman', kit: 'gun', value: 780, L: 46, B: 11.2, D: 4.3, masts: 3, sailsPerMast: 3, castle: 1, rigScale: 0.88, decks: 1,
    hull: 500, sails: 120, crew: 64, guns: 12, speed: 12.4, turn: 0.32, reload: 5.6, cal: 2, arc: 0.42, point: 0,
    role: 'A hired ship with heavy guns that outreach everything smaller, slow to load. Ponderous at the helm, short of hands, and she draws too much for shoal water.',
    ai: { range: 180, plan: 'fire', boarder: false, battleSail: true },
  },
  flagship: {
    cls: 'Great ship', kit: 'gun', value: 1500, L: 64, B: 16, D: 6.2, masts: 4, sailsPerMast: 4, castle: 2, fore: true, rigScale: 0.74, decks: 2,
    hull: 900, sails: 170, crew: 220, guns: 18, speed: 11.2, turn: 0.21, reload: 6.2, cal: 2, arc: 0.38, point: -0.1,
    role: 'A fortress, and as handy as one. Helpless in a calm, and she needs deep water under her.',
    ai: { range: 190, plan: 'mixed', boarder: false, battleSail: true },
  },
  galley: {
    cls: 'Galley', kit: 'galley', value: 620, L: 42, B: 6.6, D: 1.8, masts: 2, sailsPerMast: 2, castle: false, rigScale: 0.66, rig: 'lateen',
    hull: 230, sails: 80, crew: 170, melee: 0.75, guns: 3, speed: 10.5, turn: 0.5, reload: 7.5, cal: 0, arc: 0.5, point: 0.15,
    bow: { n: 3, cal: 2, arc: 0.22, main: true }, oars: 10.5, rowers: 100,
    role: 'Heavy guns that fire ahead, weak sides, a great crew. Under oars she owes the wind nothing, until the oarsmen tire. Only a gale troubles her.',
    ai: { range: 150, plan: 'round', boarder: true, boardAt: 1.5, battleSail: false, bowOn: true },
  },
  galliot: {
    cls: 'Galliot', kit: 'galley', value: 300, L: 27, B: 4.8, D: 1.4, masts: 1, sailsPerMast: 2, castle: false, rigScale: 0.8, rig: 'lateen',
    hull: 125, sails: 60, crew: 85, melee: 0.8, guns: 2, speed: 11, turn: 0.7, reload: 7, cal: 0, arc: 0.55, point: 0.15,
    bow: { n: 1, cal: 1, arc: 0.24, main: true }, oars: 11.5, rowers: 50,
    role: 'A small, quick galley: one good gun in the bow and a crowd of men behind it.',
    ai: { range: 110, plan: 'round', boarder: true, boardAt: 1.3, battleSail: false, bowOn: true },
  },
};

// Shore works. B is the footprint, D the height of the gun platform; the battery fires along the heading.
export const FORTS = {
  battery: { cls: 'Shore battery', fixed: true, L: 18, B: 18, D: 6, hull: 300, sails: 1, crew: 40, melee: 0.9, guns: 0, speed: 0, turn: 0, reload: 9, cal: 1, bow: { n: 4, cal: 1, arc: 0.75 }, disp: 0.03, stock: { fire: 6 }, ai: { range: 200, plan: 'round' } },
  castle: { cls: 'Castle', fixed: true, L: 24, B: 24, D: 9, hull: 800, sails: 1, crew: 90, melee: 1, guns: 0, speed: 0, turn: 0, reload: 8, cal: 2, bow: { n: 6, cal: 2, arc: 0.7 }, disp: 0.03, stock: { fire: 8 }, ai: { range: 260, plan: 'round' } },
  koules: { cls: 'Sea fortress', fixed: true, shape: 'square', L: 30, B: 30, D: 10, hull: 1100, sails: 1, crew: 120, melee: 1, guns: 0, speed: 0, turn: 0, reload: 10, cal: 2, bow: { n: 8, cal: 2, arc: 0.85 }, disp: 0.028, stock: { fire: 10 }, ai: { range: 260, plan: 'round' } },
};

export const LIVERY = {
  island: { hullCol: 0x2f4a6b, trimCol: 0xd9b25f, sailCol: '#efe6cf', emblem: 'cross', emblemCol: '#27558f', flagCol: 0x2b62b8, crewCols: [0x2b5fa8, 0xe8e2d0, 0x1f3f70, 0xc9a24a] },
  venice: { hullCol: 0x5b2a22, trimCol: 0xd9b25f, sailCol: '#efe6cf', emblem: 'lion', emblemCol: '#b07f22', flagCol: 0xa81f1f, crewCols: [0x8a1f1f, 0xe8e2d0, 0x3a3a44, 0xc9a24a] },
  ottoman: { hullCol: 0x23402f, trimCol: 0xd8c27a, sailCol: '#ece4d2', emblem: 'crescent', emblemCol: '#b3221a', flagCol: 0xb3221a, crewCols: [0xb3221a, 0xe8e2d0, 0x2f5f44, 0xd8c27a] },
  pirate: { hullCol: 0x1d1d22, trimCol: 0x7c2f24, sailCol: '#4a4640', emblem: 'band', emblemCol: '#8a1f1f', flagCol: 0x111111, crewCols: [0x7a2a22, 0x2c2c2c, 0x8a6a3a, 0x5a4a3a] },
  stone: { hullCol: 0xb9ab8c, trimCol: 0x8f8268 },
};

// Your ship's company grows with your standing. A ship needs her full crew to load fast and to hold her deck;
// a big ship with too few hands is a slow, hollow thing. Oarsmen come with an oared ship and are not counted.
export const HANDS = [80, 90, 105, 120, 135, 150];

// How well a ship is handled. Yours is 'own'. Most enemies are 'line'; a few are better or worse.
export const GRADE = {
  own: { disp: 0.021, dmg: 1, melee: 1, reload: 0 },
  crack: { disp: 0.023, dmg: 1, melee: 1.1, reload: 0.4 },
  line: { disp: 0.028, dmg: 0.95, melee: 1, reload: 0.9 },
  poor: { disp: 0.035, dmg: 0.9, melee: 0.85, reload: 1.4 },
};
const STOCK = { own: {}, crack: { chain: 6, grape: 6, fire: 6 }, line: { chain: 4, grape: 4, fire: 2 }, poor: { chain: 2, grape: 2, fire: 0 } };

// A ship ready to build: hull + colours + grade, with anything in `over` laid on top.
export function shipSpec(hull, livery, name, grade = 'line', over = {}) {
  const h = HULLS[hull] || FORTS[hull], g = GRADE[grade], lv = LIVERY[livery];
  const base = { ...h, ...lv, hullId: hull, livery, name, disp: h.disp || g.disp, dmg: g.dmg, melee: (h.melee || 1) * g.melee, reload: h.reload + g.reload, stock: { ...STOCK[grade], ...(h.stock || {}) } };
  const out = { ...base, ...over };
  if (over.ai) out.ai = { ...h.ai, ...over.ai };
  if (over.bow) out.bow = { ...h.bow, ...over.bow };
  return out;
}

// Fittings for oared ships. The other kits are the skirmish game's.
export const GALLEY_KIT = { name: 'Galley', items: [
  { id: 'marines', at: 'tavern', name: 'Marines', desc: '+20 crew and +20% strength in a boarding', add: { crew: 20 }, mul: { melee: 1.2 } },
  { id: 'hooks', at: 'wright', name: 'Grappling crews', desc: 'Board from 30% further off, at a bigger speed gap', mul: { boardReach: 1.3, boardSpeed: 1.4 } },
  { id: 'stroke', at: 'sails', name: 'Picked oarsmen', desc: '+7% speed under oars', mul: { oars: 1.07 } },
  { id: 'oak', at: 'wright', name: 'Oak bracing', desc: '+40 hull', add: { hull: 40 } },
] };

export const OFFICERS = {
  pilot: { name: 'The pilot', does: 'Shoals are marked on the water, and wind shifts are called before they arrive.' },
  carpenter: { name: 'The carpenter', does: 'A fourth watch in every pause at sea.' },
  gunner: { name: 'The gunner', does: 'Change shot without losing the load.' },
  marines: { name: 'The captain of marines', does: 'Shift your flag to a prize without spending a watch, and she arrives fully crewed.' },
};
