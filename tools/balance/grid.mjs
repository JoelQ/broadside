// The full grid: every ownable ship, stock and fully fitted, with every captain, against every pirate.
export const SHIPS = { wren: 'brig', 0: 'sloop', 2: 'xebec', 3: 'frigate' };
export const PIRATES = ['sloop', 'brig', 'xebec', 'frigate', 'galleon'];
export const PLANS = {
  'duel round': { move: 'duel', ammo: 'round', board: 'never' },
  'duel chain': { move: 'duel', ammo: 'chain', board: 'never' },
  'duel fire': { move: 'duel', ammo: 'fire', board: 'never' },
  'duel combo': { move: 'duel', ammo: 'combo', board: 'never' },
  'kite round': { move: 'kite', ammo: 'round', board: 'never' },
  'hug round': { move: 'hug', ammo: 'round', board: 'never' },
  'hug fire': { move: 'hug', ammo: 'fire', board: 'never' },
  'rush board': { move: 'duel', ammo: 'round', board: 'rush' },
  'prep board': { move: 'duel', ammo: 'combo', board: 'odds' },
  'hug board': { move: 'hug', ammo: 'combo', board: 'odds' },
};
const cells = [];
for (const ship of Object.keys(SHIPS)) for (const fit of [null, 'full']) for (const plan of Object.keys(PLANS)) for (let level = 0; level < 5; level++) {
  const id = ship === 'wren' ? 'wren' : +ship;
  cells.push({ label: `${SHIPS[ship]}${fit ? '+' : ' '} | ${plan} | v ${PIRATES[level]}`, ship: id, shipName: SHIPS[ship], fit, plan: PLANS[plan], planName: plan, level, pirate: PIRATES[level] });
}
export default cells;
