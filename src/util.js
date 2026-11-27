// Plain maths shared by the rules and the drawing: angles, clamps and seeded random numbers. No three.js here.
export const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Where a seeded scatter of islands goes: [{ x, z, r, h, seed }]. `r` is the drawn size; ships hit land
// at r * 0.8. Plain numbers only, so tools can place the same islands without drawing them.
export function scatterIslands(seed, count) {
  const rnd = mulberry(seed), out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const a = rnd() * Math.PI * 2, d = 190 + rnd() * 620, r = 26 + rnd() * 42;
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (out.some((i) => Math.hypot(i.x - x, i.z - z) < i.r * 0.8 + r + 90)) continue;
    out.push({ x, z, r, h: r * (0.35 + rnd() * 0.3), seed: seed * 31 + out.length });
  }
  return out;
}
// small seeded random number generator
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
