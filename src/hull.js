// The shape of a hull as numbers: how wide she is along her length, where her decks are, and where her guns
// sit. The rules need the guns (how many balls a broadside throws, and from where) and the height of her rig
// (where chain shot aims); the 3D model in model.js is built on the same numbers. No three.js here.
import { Vec3 } from './vec.js';

export function halfWidth(spec, t) {
  const b = spec.B / 2;
  const stern = Math.min(1, 0.7 + t * 1.7);
  const bow = t > 0.6 ? Math.pow(Math.cos(((t - 0.6) / 0.4) * Math.PI * 0.5), 0.75) : 1;
  return Math.max(0.06, b * stern * bow);
}
export const deckTop = (spec, t) => spec.D + 0.9 * (2 * t - 1) ** 2 * (t < 0.5 ? 1.5 : 1.1); // top of the rail
export const deckAt = (spec, t) => deckTop(spec, t) - 0.9; // the main deck
// Raised decks: a quarterdeck (and on a galleon a poop above it) aft, a forecastle forward.
// `lift` is the height of the deck above the main deck, `base` the height its walls start from.
export function raisedDecks(spec) {
  const lv = +spec.castle || 0, h = 2.4 + spec.L * 0.012, out = [];
  for (let k = 0; k < lv; k++) out.push({ t0: 0, t1: 0.245 - k * 0.07, lift: h * (k + 1), base: k ? h * k + 0.9 : 0.9, k });
  if (spec.fore) out.push({ t0: 0.79, t1: 0.93, lift: 2.2, base: 0.9, k: 0 });
  return out;
}
export const liftAt = (decks, t) => decks.reduce((m, r) => (t >= r.t0 && t <= r.t1 ? Math.max(m, r.lift) : m), 0);
// the deck a man stands on at t, raised decks included
export const deckLevel = (spec, t, decks = raisedDecks(spec)) => deckAt(spec, t) + liftAt(decks, t);

// Where her guns' muzzles are, in her own frame (x to port, y up, z ahead), and how tall her rig stands.
// A fort (spec.fixed) has one battery, which fires along its heading.
export function gunsOf(spec) {
  if (spec.fixed) {
    const R = spec.B / 2, H = spec.D, n = spec.bow.n, arc = spec.bow.arc || 0.8, muzzles = { bow: [] };
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? (i / (n - 1) - 0.5) * 2 * arc * 0.8 : 0, x = Math.sin(a) * R, z = Math.cos(a) * R, y = H * 0.8;
      muzzles.bow.push(new Vec3(x * 1.1, y, z * 1.1));
    }
    return { muzzles, mastH: H + (spec.hullId === 'koules' ? 15 : 9) };
  }
  const L = spec.L, muzzles = { port: [], stbd: [] }, deckY = (t) => deckAt(spec, t);
  const decksN = spec.decks || 1, perRow = Math.ceil(spec.guns / decksN);
  for (let i = 0; i < spec.guns; i++) {
    const row = decksN === 2 && i >= perRow ? 1 : 0, col = row ? i - perRow : i, inRow = row ? spec.guns - perRow : perRow;
    const t = 0.2 + (0.58 * (col + 0.5 + row * 0.5)) / (inRow + row * 0.5), z = (t - 0.5) * L, w = halfWidth(spec, t);
    const y = row ? deckTop(spec, t) * 0.36 : deckY(t) + 0.45;
    for (const sx of [1, -1]) muzzles[sx > 0 ? 'port' : 'stbd'].push(new Vec3(sx * (w + 0.6), y, z));
  }
  if (spec.bow) {
    muzzles.bow = [];
    const n = spec.bow.n, t = 0.84, w = halfWidth(spec, t) * 0.8, y = deckY(t) + 1.0, z = (t - 0.5) * L, gap = n > 1 ? Math.min(1.3, (2 * w) / (n - 1)) : 0;
    for (let i = 0; i < n; i++) muzzles.bow.push(new Vec3((i - (n - 1) / 2) * gap, y, z + 1.2));
  }
  return { muzzles, mastH: L * 0.92 * (spec.rigScale || 1) + spec.D };
}
