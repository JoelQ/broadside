import { mulberry } from './geo.js';

// The one random source for everything that decides a fight: shot fall, damage, fires, the AI's choices,
// wind shifts. Seed it and a fight plays out the same way every time (the balance harness does, so any
// run can be replayed). Unseeded it is Math.random. Purely visual randomness (smoke, crew, sparks) stays
// on Math.random so drawing more or less never changes what happens.
let next = Math.random, current = null;
export const rng = () => next();
export function seedRng(seed) { current = seed == null ? null : seed >>> 0; next = current == null ? Math.random : mulberry(current); }
export const rngSeed = () => current;
