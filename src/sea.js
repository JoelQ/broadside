// The sea as rules: wind, waves, land, banks and current, everything a ship or a shot meets. The game's rules and
// the balance tools run on this in plain Node; world.js draws it (sky, water, land, banks) in the browser.
// A view can be given: it hears when land, banks or the light change, so it can build what it draws. The rules never wait on it.
import { mulberry, scatterIslands } from './util.js';
import { rng } from './rng.js';
import { coastLand, molePieces, segDist, makeShoal } from './shore.js';

// ---------- shared wave model (JS + GLSL stay in sync) ----------
export const RAW_WAVES = [
  // dirX, dirZ, amplitude, wavelength, speed
  [1.0, 0.25, 0.55, 64, 5.6],
  [0.3, 1.0, 0.36, 41, 4.3],
  [-0.65, 0.7, 0.22, 27, 3.5],
];
export const RAW_DETAIL = [
  [0.8, 0.6, 0.05, 9.0, 2.2],
  [-0.4, 0.9, 0.04, 6.1, 1.9],
  [0.9, -0.5, 0.03, 4.3, 1.7],
  [-0.8, -0.3, 0.022, 2.9, 1.4],
  [0.1, 1.0, 0.016, 1.9, 1.2],
];
export const norm = (w) => {
  const l = Math.hypot(w[0], w[1]);
  const k = (Math.PI * 2) / w[3];
  return { dx: w[0] / l, dz: w[1] / l, amp: w[2], k, om: w[4] * k };
};
export const WAVES = RAW_WAVES.map(norm);
export const DETAIL = RAW_DETAIL.map(norm);

// The light and the sea state of each setting. `amp` is how high the waves run, which the rules use (shot meets the
// waves); the rest is colour for world.js.
export const ENVS = {
  harbor: {
    zenith: 0x3f6fb4, horizon: 0xf3cf9c, sun: [0.55, 0.34, 0.5], sunCol: 0xffd9a0,
    deep: 0x0f4a63, shallow: 0x3aa0a0, cloud: 0xffe6c8, cover: 0.55,
    hemi: 1.1, dir: 2.0, fog: [500, 3200], amp: 0.28,
  },
  home: { // the two home ports: the harbour's evening light, with clearer air so the far shores and mountains read
    zenith: 0x3f6fb4, horizon: 0xf0cfa0, sun: [0.55, 0.34, 0.5], sunCol: 0xffd9a0,
    deep: 0x0f4a63, shallow: 0x3aa0a0, cloud: 0xffe6c8, cover: 0.55,
    hemi: 1.0, dir: 2.2, fog: [900, 5200], amp: 0.28,
  },
  noon: {
    zenith: 0x2a6fc4, horizon: 0xb7d8ee, sun: [0.45, 0.8, 0.35], sunCol: 0xfff6e0,
    deep: 0x0a3d63, shallow: 0x1f8a9e, cloud: 0xffffff, cover: 0.52,
    hemi: 1.15, dir: 2.0, fog: [350, 2600], amp: 1.0,
  },
  golden: {
    zenith: 0x3d5f9c, horizon: 0xf6bd80, sun: [0.75, 0.2, -0.5], sunCol: 0xffc77a,
    deep: 0x103852, shallow: 0x3b7f86, cloud: 0xffd9b0, cover: 0.5,
    hemi: 0.95, dir: 2.1, fog: [300, 2400], amp: 0.9,
  },
  overcast: {
    zenith: 0x6f8291, horizon: 0xb3bdc3, sun: [-0.3, 0.75, 0.5], sunCol: 0xdfe6ea,
    deep: 0x1c3f4b, shallow: 0x3d6d73, cloud: 0xd5dbe0, cover: 0.3,
    hemi: 1.25, dir: 1.0, fog: [220, 1700], amp: 1.25,
  },
  dusk: {
    zenith: 0x1c2756, horizon: 0xe07050, sun: [-0.7, 0.12, 0.6], sunCol: 0xff8752,
    deep: 0x0c2240, shallow: 0x35566e, cloud: 0xc77a78, cover: 0.48,
    hemi: 0.75, dir: 1.9, fog: [280, 2200], amp: 1.0,
  },
  storm: {
    zenith: 0x27313b, horizon: 0x71808a, sun: [0.3, 0.6, -0.6], sunCol: 0xaab8c2,
    deep: 0x0f262f, shallow: 0x2c5058, cloud: 0x4c5963, cover: 0.12,
    hemi: 1.0, dir: 0.8, fog: [160, 1300], amp: 1.9,
  },
};


const NONE = { env() {}, island() {}, islands() {}, coast() {}, clearIslands() {}, shoals() {}, clearPaws() {} };

export class Sea {
  constructor(view = NONE) {
    this.view = view;
    this.time = 0;
    this.amp = 1;
    this.wind = { dir: 0.6, target: 0.6, timer: 40, str: 1, strTarget: 1, base: 1, steady: false };
    this.shoals = []; this.currentAt = null; this.envName = 'noon';
    this.paws = []; // cat's-paws, made by the view (see world.js)
    this.islands = []; this.coasts = []; this.moles = []; this.pieces = []; this.pieceGrid = new Map();
    this.setEnv('noon');
  }
  setEnv(name) {
    const e = ENVS[name];
    this.amp = e.amp;
    this.env = e; this.envName = name; this.baseAmp = e.amp;
    this.view.env(name);
  }
  height(x, z) {
    let h = 0;
    const t = this.time;
    for (const w of WAVES) h += w.amp * Math.sin(w.k * (x * w.dx + z * w.dz) + t * w.om);
    return h * this.amp;
  }

  // Land that is not a round island: coasts and moles (see shore.js). Their shore circles are binned in a
  // grid so ships, shot and the AI only look at the shore near them; ground(x, z) is the height of the land.
  addCoast(def) {
    const c = coastLand(def);
    this.coasts.push(c);
    for (const p of c.pieces) this.addPiece(p);
    this.view.coast(c, def);
    return c;
  }
  addMole(m) {
    this.moles.push(m);
    for (const p of molePieces(m.path, m.w)) this.addPiece(p);
    for (const [x, z, r] of m.platforms || []) this.addPiece({ x, z, r });
    for (const [x, z, r] of m.blocks || []) this.addPiece({ x, z, r }); // a fort on its head: solid to ships, but shot meets the fort itself
  }
  addPiece(p) { const k = Math.floor(p.x / 60) * 4099 + Math.floor(p.z / 60); let c = this.pieceGrid.get(k); if (!c) this.pieceGrid.set(k, (c = [])); c.push(p); this.pieces.push(p); }
  // shore circles within r of a point
  shoreNear(x, z, r, out = []) {
    out.length = 0;
    const g0 = Math.floor((x - r - 40) / 60), g1 = Math.floor((x + r + 40) / 60), h0 = Math.floor((z - r - 40) / 60), h1 = Math.floor((z + r + 40) / 60);
    for (let gx = g0; gx <= g1; gx++) for (let gz = h0; gz <= h1; gz++) { const c = this.pieceGrid.get(gx * 4099 + gz); if (c) for (const p of c) if (Math.hypot(p.x - x, p.z - z) < r + p.r) out.push(p); }
    return out;
  }
  ground(x, z) {
    let y = -20;
    for (const c of this.coasts) { const b = c.shape.box; if (x > b[0] - 30 && x < b[2] + 30 && z > b[1] - 30 && z < b[3] + 30) y = Math.max(y, c.ground(x, z)); }
    for (const m of this.moles) {
      if (segDist(m.path, x, z) < m.w / 2) y = Math.max(y, m.top + (m.parapet || 0)); // the sea wall along it stops shot too
      for (const [px, pz, r] of m.platforms || []) if (Math.hypot(x - px, z - pz) < r) y = Math.max(y, m.top);
    }
    return y;
  }
  clearIslands() { this.islands = []; this.coasts = []; this.moles = []; this.pieces = []; this.pieceGrid = new Map(); this.view.clearIslands(); this.setShoals([]); this.currentAt = null; this.clearPaws(); this.setWind(undefined, 1, true); this.wind.steady = false; this.wind.next = null; }
  // wind strength: 0 is a dead calm, 1 a working breeze, 1.6 a gale
  setWind(dir, str, now) {
    const w = this.wind;
    if (dir !== undefined) { w.target = dir; if (now) w.dir = dir; }
    if (str !== undefined) { w.strTarget = w.base = str; if (now) w.str = str; }
  }
  windName() { const s = this.wind.str; return s < 0.3 ? 'Calm' : s < 0.65 ? 'Light airs' : s <= 1.25 ? 'Breeze' : 'Gale'; }
  // islands placed by hand: [{x, z, r, h?, seed?}]
  addIsland(o) {
    const seed = o.seed || Math.round(o.x * 7 + o.z * 13 + o.r), isl = { x: o.x, z: o.z, r: o.r * 0.8, h: o.h || o.r * 0.45 };
    this.islands.push(isl);
    this.view.island(o, isl, seed);
    return isl;
  }
  // shoals: [{ outline, depth }], each a shape (see makeShoal in shore.js). A ship drawing more than `depth` sticks
  // anywhere inside. With the pilot aboard (`marked`) the view writes each bank's depth on it, red where a ship of
  // `draught` would stick.
  setShoals(list, marked, draught = 0) {
    this.shoals = list.map(makeShoal);
    this.view.shoals(this.shoals, marked, draught);
  }
  clearPaws() { this.view.clearPaws(); this.paws = []; }
  strAt(x, z) {
    let s = this.wind.str;
    for (const p of this.paws) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) s += 0.75 * p.f * (1 - (d / p.r) ** 2); }
    return s;
  }
  shoalAt(x, z, draught) {
    for (const s of this.shoals) if (draught > s.depth && s.at(x, z) > 0) return s;
    return null;
  }
  setIslands(seed, count) {
    this.islands = [];
    const list = scatterIslands(seed, count);
    for (const o of list) this.islands.push({ x: o.x, z: o.z, r: o.r * 0.8, h: o.h });
    this.view.islands(list);
  }
  update(dt) {
    this.time += dt;
    const w = this.wind;
    w.timer -= dt;
    // the next shift is decided a little before it arrives, so a good pilot can call it
    if (w.timer <= 12 && w.next == null && !w.steady && w.base >= 0.3) w.next = (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.55);
    if (w.timer <= 0) { w.timer = 45 + rng() * 35; if (w.next != null) { w.target = w.dir + w.next; w.shifted = w.next; } w.next = null; }
    w.dir += (w.target - w.dir) * Math.min(1, dt * 0.22);
    // in a calm the air comes in cat's-paws: brief puffs a light ship can use
    w.strTarget = w.base;
    w.str += (w.strTarget - w.str) * Math.min(1, dt * 0.25);
    this.amp = this.baseAmp * (0.25 + 0.75 * Math.min(1, w.str)) * (w.str > 1.25 ? 1.5 : 1);
  }
}
