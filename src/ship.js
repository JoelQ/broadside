import * as THREE from 'three';

export const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Speed fraction by angle off dead-downwind (deg).
const POLAR = [[0, 0.76], [45, 1], [90, 0.88], [115, 0.66], [135, 0.4], [150, 0.14], [180, 0.02]];
// Sail settings: more canvas is faster, less is a steadier gun platform that turns tighter and is harder to dismast.
export const SAILS = [
  { name: 'Furled', spd: 0, turn: 1, aim: 0.8, dmg: 0.3 },
  { name: 'Reefed', spd: 0.4, turn: 1.12, aim: 0.8, dmg: 0.5 },
  { name: 'Battle sails', spd: 0.7, turn: 1.22, aim: 1, dmg: 0.75 },
  { name: 'Full sail', spd: 1, turn: 0.85, aim: 1.3, dmg: 1.15 },
];
export const TOP = SAILS.length - 1;
// `point` (radians) is how much closer to the wind a rig can sail than a square-rigger.
export function polar(a, point = 0) {
  let d = (Math.abs(a) * 180) / Math.PI;
  d -= ((point * 180) / Math.PI) * clamp((d - 60) / 60, 0, 1);
  for (let i = 1; i < POLAR.length; i++) {
    if (d <= POLAR[i][0]) {
      const [a0, v0] = POLAR[i - 1], [a1, v1] = POLAR[i];
      return v0 + ((v1 - v0) * (d - a0)) / (a1 - a0);
    }
  }
  return 0.05;
}
export function pointOfSail(a, point = 0) {
  const d = (Math.abs(a) * 180) / Math.PI - (point * 180) / Math.PI;
  if (d > 148) return 'In irons';
  if (d > 118) return 'Close-hauled';
  if (d > 75) return 'Beam reach';
  if (d > 25) return 'Broad reach';
  return 'Running';
}

export const AMMO = {
  round: { name: 'Round', long: 'Round shot', range: 250, speed: 128, hull: 6.2, sail: 0.6, crew: 0.3, reload: 1, tip: 'Smashes hulls at long range' },
  chain: { name: 'Chain', long: 'Chain shot', range: 175, speed: 108, hull: 1, sail: 4.5, crew: 0.1, reload: 1, tip: 'Shreds sails — cripple, then close' },
  grape: { name: 'Grape', long: 'Grapeshot', range: 100, speed: 98, hull: 0.6, sail: 0.5, crew: 0, kills: [2, 4], reload: 0.9, tip: 'Sweeps the deck of crew at close range' },
  fire: { name: 'Heated', long: 'Heated shot', range: 185, speed: 112, hull: 4.2, sail: 2, crew: 0.2, ignite: 0.3, reload: 1.55, tip: 'Starts fires. A burning ship loses hull steadily and loads her guns at half speed' },
};
export const AMMO_KEYS = ['round', 'chain', 'grape', 'fire'];
// Gun weight. Heavier guns reach further and hit harder, and take longer to load.
export const CAL = [
  { name: 'light', pdr: '6-pdr', range: 0.8, dmg: 0.7, reload: 0.72 },
  { name: 'medium', pdr: '12-pdr', range: 1, dmg: 1, reload: 1 },
  { name: 'heavy', pdr: '24-pdr', range: 1.22, dmg: 1.45, reload: 1.4 },
];
// Mass, relative to a brig. Heavy ships gather way, lose way and answer the helm slowly.
export const massOf = (spec) => clamp(Math.sqrt((spec.L * spec.B) / 240) * 0.95 + 0.05, 0.6, 2.3);
export const noGoHalf = (spec) => Math.max(0.2, 0.6 - (spec.point || 0)); // half-width of the no-sail wedge
export const JURY = 0.34; // sails jury-rig back to this fraction
export const BELOW = 0.4; // share of a crew below decks, out of reach of gunfire // broadside half-angle (rad)

// ---------- procedural ship model ----------
export function halfWidth(spec, t) {
  const b = spec.B / 2;
  const stern = Math.min(1, 0.7 + t * 1.7);
  const bow = t > 0.6 ? Math.pow(Math.cos(((t - 0.6) / 0.4) * Math.PI * 0.5), 0.75) : 1;
  return Math.max(0.06, b * stern * bow);
}
const deckTop = (spec, t) => spec.D + 0.9 * (2 * t - 1) ** 2 * (t < 0.5 ? 1.5 : 1.1);
export const deckAt = (spec, t) => deckTop(spec, t) - 0.9;

function hullGeometry(spec) {
  const ns = 16, L = spec.L, draft = spec.D * 0.8;
  const hullC = new THREE.Color(spec.hullCol), trimC = new THREE.Color(spec.trimCol), botC = new THREE.Color(0x3a2a22), deckC = new THREE.Color(0x9a7a50);
  const rings = [];
  for (let s = 0; s <= ns; s++) {
    const t = s / ns, z = (t - 0.5) * L, w = halfWidth(spec, t), top = deckTop(spec, t);
    const k = t > 0.78 ? 1 - ((t - 0.78) / 0.22) * 0.8 : 1;
    const half = [[0, -draft * k, botC], [0.55 * w, -draft * 0.78 * k, botC], [0.93 * w, -0.1, hullC], [1.0 * w, top * 0.72, hullC], [0.97 * w, top * 0.73, trimC], [0.95 * w, top, trimC]];
    const ring = [];
    for (let j = half.length - 1; j >= 0; j--) ring.push([-half[j][0], half[j][1], z, half[j][2]]);
    for (let j = 1; j < half.length; j++) ring.push([half[j][0], half[j][1], z, half[j][2]]);
    rings.push(ring);
  }
  const pos = [], col = [];
  const push = (a, b, c) => { for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); col.push(v[3].r, v[3].g, v[3].b); } };
  const n = rings[0].length;
  for (let s = 0; s < ns; s++) for (let j = 0; j < n - 1; j++) {
    const a = rings[s][j], b = rings[s][j + 1], c = rings[s + 1][j + 1], d = rings[s + 1][j];
    // colour each quad by its upper edge so bands stay crisp
    const cc = j < (n - 1) / 2 ? a[3] : b[3];
    const A = [a[0], a[1], a[2], cc], B = [b[0], b[1], b[2], cc], C = [c[0], c[1], c[2], cc], Dd = [d[0], d[1], d[2], cc];
    push(A, B, C); push(A, C, Dd);
  }
  // transom
  const r0 = rings[0], mid = [0, spec.D * 0.3, r0[0][2], hullC];
  for (let j = 0; j < n - 1; j++) push([r0[j][0], r0[j][1], r0[j][2], hullC], [r0[j + 1][0], r0[j + 1][1], r0[j + 1][2], hullC], mid);
  push([r0[0][0], r0[0][1], r0[0][2], hullC], mid, [r0[n - 1][0], r0[n - 1][1], r0[n - 1][2], hullC]);
  // deck
  for (let s = 0; s < ns; s++) {
    const t0 = s / ns, t1 = (s + 1) / ns;
    const w0 = halfWidth(spec, t0) * 0.95, w1 = halfWidth(spec, t1) * 0.95;
    const y0 = deckTop(spec, t0) - 0.9, y1 = deckTop(spec, t1) - 0.9, z0 = (t0 - 0.5) * L, z1 = (t1 - 0.5) * L;
    const dc = s % 2 ? deckC : deckC.clone().multiplyScalar(0.93);
    push([-w0, y0, z0, dc], [w0, y0, z0, dc], [w1, y1, z1, dc]); push([-w0, y0, z0, dc], [w1, y1, z1, dc], [-w1, y1, z1, dc]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function sailTexture(spec, emblem, tier) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = spec.sailCol; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(0,0,0,0.13)'; x.lineWidth = 1;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * 21.3, 0); x.lineTo(i * 21.3, 128); x.stroke(); }
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.4, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  if (emblem === 'skull') {
    x.fillStyle = spec.emblemCol || '#e8e2d0';
    x.beginPath(); x.arc(64, 54, 20, 0, 7); x.fill(); x.fillRect(52, 66, 24, 14);
    x.strokeStyle = spec.emblemCol || '#e8e2d0'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(34, 76); x.lineTo(94, 106); x.moveTo(94, 76); x.lineTo(34, 106); x.stroke();
    x.fillStyle = spec.sailCol; x.beginPath(); x.arc(56, 54, 5, 0, 7); x.arc(72, 54, 5, 0, 7); x.fill();
  } else if (emblem === 'cross') {
    x.fillStyle = spec.emblemCol || '#1f4f8f'; x.fillRect(54, 14, 20, 100); x.fillRect(22, 44, 84, 20);
  } else if (emblem === 'stripes') {
    x.fillStyle = spec.emblemCol; for (let i = 0; i < 3; i++) x.fillRect(0, 14 + i * 40, 128, 16);
  }
  if (tier > 0) {
    x.globalCompositeOperation = 'destination-out';
    let seed = 7 + tier * 13 + (emblem ? 5 : 0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = tier === 1 ? 6 : 15;
    for (let i = 0; i < n; i++) { x.beginPath(); x.ellipse(rnd() * 128, rnd() * 128, 4 + rnd() * (tier === 1 ? 7 : 12), 3 + rnd() * 9, rnd() * 3, 0, 7); x.fill(); }
    if (tier === 2) for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * 15, 128); x.lineTo(i * 15 + 7, 86 + rnd() * 30); x.lineTo(i * 15 + 15, 128); x.fill(); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function squareSail(w, h, mat) {
  const g = new THREE.PlaneGeometry(w, h, 6, 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5;
    p.setZ(i, Math.sin(u * Math.PI) * Math.sin((1 - v) * Math.PI * 0.82) * w * 0.17);
  }
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

export function buildShipModel(spec) {
  const group = new THREE.Group();
  const L = spec.L, B = spec.B;
  const wood = new THREE.MeshLambertMaterial({ color: 0x5b4027, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c1e, flatShading: true });
  const hull = new THREE.Mesh(hullGeometry(spec), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  group.add(hull);
  const deckY = (t) => deckTop(spec, t) - 0.9;

  const lv = +spec.castle || 0, trimMat = new THREE.MeshLambertMaterial({ color: spec.trimCol, flatShading: true }), glowMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let k = 0; k < lv; k++) {
    // sterncastle, one storey per level, each shorter than the one below
    const len = L * (0.24 - k * 0.07), t = 0.1, hgt = 2.4 + L * 0.012;
    const c = new THREE.Mesh(new THREE.BoxGeometry(halfWidth(spec, t) * (1.85 - k * 0.2), hgt, len), trimMat);
    c.position.set(0, deckY(t) + hgt * (0.42 + k), -L / 2 + len / 2 + 0.3);
    group.add(c);
    const win = new THREE.Mesh(new THREE.BoxGeometry(halfWidth(spec, 0) * (1.3 - k * 0.2), 0.7, 0.2), glowMat);
    win.position.set(0, deckY(0) + hgt * (0.4 + k), -L / 2 + 0.2);
    group.add(win);
  }
  if (spec.fore) {
    const len = L * 0.14, t = 0.86, c = new THREE.Mesh(new THREE.BoxGeometry(halfWidth(spec, t) * 1.7, 2.4, len), trimMat);
    c.position.set(0, deckY(t) + 1.0, L / 2 - len / 2 - L * 0.07);
    group.add(c);
  }

  // sails: three damage tiers, with and without emblem
  const mats = [0, 1, 2].map((tier) => [null, spec.emblem]/*x*/.map((em) => { const t = sailTexture(spec, em, tier); return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0x555555, side: THREE.DoubleSide, alphaTest: 0.5 }); }));
  const yards = [], sails = [], lines = [], booms = [];
  const rig = spec.rig || 'square', thick = L / 30;
  const mastZ = { 1: [0.1], 2: [0.24, -0.17], 3: [0.3, 0.0, -0.3], 4: [0.35, 0.12, -0.13, -0.36] }[spec.masts];
  const mainIdx = spec.masts >= 3 ? 1 : 0;
  // a fore-and-aft sail: a flat panel in the ship's centreline plane that swings with its boom
  const flatSail = (pts, mat) => {
    const g = new THREE.BufferGeometry(), ys = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys), z0 = Math.min(...zs), z1 = Math.max(...zs), pos = [], uv = [];
    const tri = pts.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
    for (const i of tri) { pos.push(0, pts[i][0], pts[i][1]); uv.push((pts[i][1] - z0) / (z1 - z0 || 1), (pts[i][0] - y0) / (y1 - y0 || 1)); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  const spar = (y0, z0, y1, z1, r) => {
    const len = Math.hypot(y1 - y0, z1 - z0), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), wood);
    m.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.x = Math.atan2(z1 - z0, y1 - y0);
    return m;
  };
  let mainTop = null;
  mastZ.forEach((zf, mi) => {
    const z = zf * L, t = zf + 0.5, base = deckY(t);
    const H = L * (mi === mainIdx ? 0.92 : spec.masts >= 3 && mi === spec.masts - 1 ? 0.7 : 0.8) * (spec.rigScale || 1);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * thick, 0.38 * thick, H, 6), wood);
    mast.position.set(0, base + H / 2, z);
    group.add(mast);
    if (mi === mainIdx) mainTop = new THREE.Vector3(0, base + H, z);
    const em = mi === mainIdx ? 1 : 0;
    if (rig !== 'square') {
      const boom = new THREE.Group();
      boom.position.set(0, base + 2.2, z);
      let sail;
      if (rig === 'gaff') {
        // sloop: one big mainsail between boom and gaff, abaft the mast
        const bl = L * 0.56, th = H * 0.62, pk = H * 0.86;
        sail = flatSail([[0, 0], [0, -bl], [pk, -bl * 0.62], [th, 0]], mats[0][em]);
        boom.add(spar(0, 0, 0, -bl * 1.03, 0.16), spar(th, 0, pk, -bl * 0.65, 0.13));
      } else {
        // xebec: a triangular lateen sail hung from one long slanting yard
        const yl = L * 0.3 * (em ? 1.1 : 0.9), lowY = H * 0.08, hiY = H * 0.82;
        sail = flatSail([[lowY, yl * 0.75], [hiY, -yl * 0.55], [0, -yl * 0.7]], mats[0][em]);
        boom.add(spar(lowY, yl * 0.78, hiY, -yl * 0.58, 0.15));
      }
      sail.userData = { fa: true, course: false, emblem: em, furl: 1 };
      boom.add(sail); group.add(boom);
      booms.push(boom); sails.push(sail);
    }
    const n = rig === 'square' ? spec.sailsPerMast : 0, frac = n === 4 ? [0.36, 0.27, 0.21, 0.16] : n === 3 ? [0.42, 0.33, 0.25] : [0.56, 0.44];
    let lo = base + 2.6;
    const span = H * 0.95 - 2.6;
    for (let s = 0; s < n; s++) {
      const hi = lo + span * frac[s];
      const w = B * 2.05 * (1 - 0.2 * s) * (mi === mainIdx ? 1 : 0.88), h = hi - lo - 0.7;
      const yard = new THREE.Group();
      yard.position.set(0, hi, z + 0.45);
      const ys = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * thick, 0.14 * thick, w * 1.04, 5), wood);
      ys.rotation.z = Math.PI / 2;
      yard.add(ys);
      const sail = squareSail(w, h, mats[0][mi === mainIdx && s === 0 ? 1 : 0]);
      sail.userData = { course: s === 0, emblem: mi === mainIdx && s === 0 ? 1 : 0, furl: 1 };
      yard.add(sail);
      group.add(yard);
      yards.push(yard); sails.push(sail);
      lo = hi;
    }
    const wS = halfWidth(spec, t) * 0.95, top = base + H * 0.86;
    for (const sx of [-1, 1]) for (const dz of [-1.6, 0.2]) lines.push(0, top, z, sx * wS, deckTop(spec, t), z + dz);
  });
  // bowsprit + jib
  const fore = mastZ[0] * L, tipZ = L / 2 + L * 0.2, tipY = deckY(1) + 2.6;
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * thick, 0.24 * thick, L * 0.3, 5), wood);
  bs.position.set(0, deckY(1) + 1.6, L / 2 + L * 0.06);
  bs.rotation.x = Math.PI / 2 - 0.22;
  group.add(bs);
  const jg = new THREE.BufferGeometry();
  const jt = deckY(mastZ[0] + 0.5) + L * 0.62 * (spec.rigScale || 1);
  jg.setAttribute('position', new THREE.Float32BufferAttribute([0, tipY, tipZ, 0, jt, fore + 0.9, B * 0.16, deckY(0.8) + 2.2, fore + 2.2], 3));
  jg.setAttribute('uv', new THREE.Float32BufferAttribute([0.1, 0.1, 0.9, 0.9, 0.9, 0.1], 2));
  jg.computeVertexNormals();
  const jib = new THREE.Mesh(jg, mats[0][0]);
  jib.userData = { course: false, emblem: 0, jib: true, furl: 1 };
  group.add(jib); sails.push(jib);
  lines.push(0, tipY, tipZ, 0, jt + 1, fore);
  if (mainTop) lines.push(0, mainTop.y, mainTop.z, 0, deckY(0.02) + 2.5, -L / 2 + 0.5);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0.7 })));

  // flag
  const fw = 3.6 * Math.max(1, thick * 0.9), fg = new THREE.PlaneGeometry(fw, fw * 0.58, 6, 1); fg.translate(fw / 2, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: spec.flagCol, side: THREE.DoubleSide }));
  flag.position.copy(mainTop).add(new THREE.Vector3(0, 0.2, 0));
  group.add(flag);

  // guns
  const muzzles = { port: [], stbd: [] };
  const gunG = new THREE.CylinderGeometry(0.2, 0.26, 1.7, 6); gunG.rotateZ(Math.PI / 2);
  const decks = spec.decks || 1, perRow = Math.ceil(spec.guns / decks);
  for (let i = 0; i < spec.guns; i++) {
    const row = decks === 2 && i >= perRow ? 1 : 0, col = row ? i - perRow : i, inRow = row ? spec.guns - perRow : perRow;
    const t = 0.2 + (0.58 * (col + 0.5 + row * 0.5)) / (inRow + row * 0.5), z = (t - 0.5) * L, w = halfWidth(spec, t);
    const y = row ? deckTop(spec, t) * 0.36 : deckY(t) + 0.45, wy = row ? w * 1.0 : w;
    for (const sx of [1, -1]) {
      const gun = new THREE.Mesh(gunG, dark);
      gun.position.set(sx * (wy - 0.35), y, z);
      group.add(gun);
      muzzles[sx > 0 ? 'port' : 'stbd'].push(new THREE.Vector3(sx * (wy + 0.6), y, z));
    }
  }
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffcf70 }));
  lantern.position.set(0, deckTop(spec, 0) + 1.2 + lv * (2.4 + L * 0.012), -L / 2 + 0.2);
  group.add(lantern);

  return { group, yards, sails, booms, flag, muzzles, mats, mastH: L * 0.92 * (spec.rigScale || 1) + spec.D };
}

// ---------- ship simulation ----------
export class Ship {
  constructor(spec, isPlayer) {
    this.spec = spec; this.isPlayer = isPlayer;
    this.model = buildShipModel(spec);
    this.group = this.model.group;
    this.pos = new THREE.Vector3(); this.heading = 0; this.speed = 0; this.rudder = 0;
    this.input = { turn: 0 };
    this.sailLevel = TOP;
    this.hullMax = this.hull = spec.hull; this.sailsMax = this.sails = spec.sails; this.crewMax = this.crew = spec.crew;
    this.reload = { port: 0, stbd: 0 }; this.reloadMax = { port: 1, stbd: 1 };
    this.ammo = 'round';
    this.stock = { chain: 0, grape: 0, fire: 0, ...(spec.stock || {}) };
    this.fire = 0; this.fireT = 0;
    this.cal = CAL[spec.cal ?? 1]; this.arc = spec.arc || 0.5; this.mass = massOf(spec); this.yaw = 0;
    this.dmgMult = (spec.dmg || 1) * this.cal.dmg; this.disp = spec.disp || 0.022; this.reloadMult = 1; this.melee = spec.melee || 1;
    this.sinking = 0; this.dead = false; this.struck = false;
    this.ramCd = 0; this.sailTier = 0; this.roll = 0; this.fxT = 0;
    this.target = null; this.rigT = 0;
    this.figs = new CrewFigures(this);
  }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }
  get hullR() { return clamp(this.hull / this.hullMax, 0, 1); }
  get sailR() { return clamp(this.sails / this.sailsMax, 0, 1); }
  get crewR() { return clamp(this.crew / this.crewMax, 0, 1); }
  get exposed() { return Math.max(0, this.crew - this.crewMax * BELOW); } // men a broadside can reach
  range(ammo = this.ammo) { return AMMO[ammo].range * this.cal.range * (this.spec.reach || 1); }
  reloadTime(ammo = this.ammo) {
    return (this.spec.reload * this.cal.reload * AMMO[ammo].reload * this.reloadMult) / (0.45 + 0.55 * this.crewR);
  }
  startReload(side, frac = 1) { this.reload[side] = this.reloadMax[side] = this.reloadTime() * frac; }
  setAmmo(a) {
    if (a === this.ammo) return false;
    if (a !== 'round' && this.stock[a] <= 0) return false;
    this.ammo = a;
    for (const s of ['port', 'stbd']) if (this.reload[s] <= 0) this.startReload(s, 0.6);
    return true;
  }
  toWorld(local, out = new THREE.Vector3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    return out.set(this.pos.x + local.x * c + local.z * s, this.group.position.y + local.y, this.pos.z - local.x * s + local.z * c);
  }
  toLocal(p, out = new THREE.Vector3()) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading), dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    return out.set(dx * c - dz * s, p.y - this.group.position.y, dx * s + dz * c);
  }
  maxSpeedNow(world) {
    const off = wrap(this.heading - world.wind.dir);
    const v = this.spec.speed * SAILS[this.sailLevel].spd * polar(off, this.spec.point) * (0.25 + 0.75 * this.sailR) * (this.hullR < 0.3 ? 0.82 : 1);
    return this.sailLevel > 0 ? Math.max(v, (this.spec.sweeps || 0) * this.crewR) : v; // sweeps: oars give a floor under the wind
  }

  update(dt, world, frozen) {
    const sp = this.spec;
    if (this.sinking > 0) {
      this.sinking += dt; this.speed *= Math.max(0, 1 - dt);
    } else if (!frozen) {
      const tgt = this.struck ? 0 : this.maxSpeedNow(world);
      const m = this.mass;
      this.speed += (tgt - this.speed) * Math.min(1, (dt * (tgt > this.speed ? 0.42 : 0.7)) / m ** 0.8);
      this.rudder += clamp(this.input.turn - this.rudder, -dt * 2.2, dt * 2.2);
      const way = 0.3 + 0.7 * clamp(this.speed / (0.45 * sp.speed), 0, 1);
      // the hull swings toward the rate the rudder asks for; a heavy hull takes longer to start and to stop swinging
      this.yaw += (this.rudder * sp.turn * way * SAILS[this.sailLevel].turn - this.yaw) * Math.min(1, dt / (0.35 * m));
      this.heading = wrap(this.heading + this.yaw * dt);
      this.speed *= 1 - Math.abs(this.rudder) * 0.07 * dt;
      // while a ship burns her gun crews are fighting the fire: she loads at half speed
      for (const s of ['port', 'stbd']) if (this.reload[s] > 0) this.reload[s] = Math.max(0, this.reload[s] - dt * (this.fire > 0 ? 0.5 : 1));
    } else {
      this.speed *= Math.max(0, 1 - dt * 2);
    }
    this.pos.x += this.fwdX * this.speed * dt; this.pos.z += this.fwdZ * this.speed * dt;
    this.ramCd -= dt;
    // a crew left alone for a few seconds jury-rigs torn canvas back to about a third
    this.rigT += dt;
    if (this.rigT > 4 && this.sinking <= 0 && this.sails < this.sailsMax * JURY) this.sails = Math.min(this.sailsMax * JURY, this.sails + 1.4 * dt);
    this.syncVisual(dt, world);
  }

  syncVisual(dt, world) {
    const g = this.group, L = this.spec.L, fx = this.fwdX, fz = this.fwdZ;
    const hb = world.height(this.pos.x + fx * L * 0.35, this.pos.z + fz * L * 0.35);
    const hs = world.height(this.pos.x - fx * L * 0.35, this.pos.z - fz * L * 0.35);
    const hp = world.height(this.pos.x + fz * 4, this.pos.z - fx * 4), hq = world.height(this.pos.x - fz * 4, this.pos.z + fx * 4);
    const relWind = wrap(world.wind.dir - this.heading);
    const set = SAILS[this.sailLevel].spd;
    let roll = (hp - hq) / 8 * 0.6 - this.rudder * clamp(this.speed / 12, 0, 1) * 0.07 + Math.sin(relWind) * 0.05 * set;
    let y = (hb + hs) * 0.5 * 0.85, pitch = -Math.atan2(hb - hs, L * 0.7) * 0.8;
    if (this.sinking > 0) {
      const k = this.sinking;
      y -= k * k * 0.22; roll += Math.min(0.6, k * 0.09) * (this.spec.seedSign || 1); pitch += Math.min(0.35, k * 0.04);
    }
    this.roll += (roll - this.roll) * Math.min(1, dt * 3);
    g.position.set(this.pos.x, y, this.pos.z);
    g.rotation.set(pitch, this.heading, this.roll, 'YXZ');

    // rig: brace yards to the wind, furl by sail level, tatter by damage
    const brace = clamp(Math.sin(relWind) * 0.85, -0.8, 0.8) * (Math.cos(relWind) > -0.5 ? 1 : 0.5);
    for (const yd of this.model.yards) yd.rotation.y += (brace - yd.rotation.y) * Math.min(1, dt * 1.5);
    const swing = clamp(-Math.sin(relWind) * 0.5, -0.45, 0.45) * (0.4 + 0.6 * set);
    for (const bm of this.model.booms) bm.rotation.y += (swing - bm.rotation.y) * Math.min(1, dt * 1.5);
    const fill = 0.35 + 0.65 * polar(wrap(this.heading - world.wind.dir)) + Math.sin(world.time * 3 + this.pos.x) * 0.04;
    const tier = this.sailR > 0.66 ? 0 : this.sailR > 0.3 ? 1 : 2;
    const gone = this.sailR <= 0.02;
    this.model.sails.forEach((s, i) => {
      const u = s.userData;
      const lv = this.sailLevel, want = lv === 3 ? 1 : lv === 2 ? (u.course ? 0.1 : 1) : lv === 1 ? (u.course ? 0.1 : 0.5) : 0.1;
      u.furl += (want - u.furl) * Math.min(1, dt * 1.6);
      if (u.jib) { s.visible = this.sailLevel > 1 && !gone; }
      else if (u.fa) { const f = this.sailLevel >= 2 ? 1 : this.sailLevel === 1 ? 0.5 : 0.08; u.furl += (f - u.furl) * Math.min(1, dt * 1.6) - (want - u.furl) * Math.min(1, dt * 1.6); s.scale.set(1, u.furl, 1); s.visible = !gone; }
      else { s.scale.set(1, u.furl, 0.25 + 0.75 * fill * u.furl); s.visible = !(gone && i % 2 === 0); }
      if (tier !== this.sailTier) s.material = this.model.mats[tier][u.emblem];
    });
    this.sailTier = tier;
    const fl = this.model.flag;
    fl.visible = !this.struck;
    fl.rotation.y = relWind - Math.PI / 2;
    const fp = fl.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin(x * 2.2 - world.time * 9) * 0.12 * x); }
    fp.needsUpdate = true;
    this.figs.update(dt, world.time, this.boardView || null);
  }
}

// ---------- crew on deck ----------
const FIG_MAX = 64;
let figGeo = null;
function figureGeometry() {
  if (figGeo) return figGeo;
  const parts = [new THREE.BoxGeometry(0.62, 1.35, 0.42).translate(0, 0.68, 0), new THREE.BoxGeometry(0.4, 0.4, 0.4).translate(0, 1.6, 0)].map((g) => g.toNonIndexed());
  const pos = [], nor = [];
  for (const g of parts) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  figGeo = new THREE.BufferGeometry();
  figGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  figGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return figGeo;
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fs = new THREE.Vector3(), _fp = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export class CrewFigures {
  constructor(ship) {
    this.ship = ship;
    const sp = ship.spec;
    this.per = Math.max(2.5, sp.crew / FIG_MAX);
    this.mesh = new THREE.InstancedMesh(figureGeometry(), new THREE.MeshLambertMaterial({ flatShading: true }), FIG_MAX);
    this.mesh.frustumCulled = false;
    const cols = (sp.crewCols || [0x7a2a22, 0x2c2c2c, 0x8a6a3a, 0x5a4a3a]).map((c) => new THREE.Color(c));
    this.f = [];
    for (let i = 0; i < FIG_MAX; i++) {
      const t = 0.16 + Math.random() * 0.68, z = (t - 0.5) * sp.L, x = (Math.random() - 0.5) * 2 * halfWidth(sp, t) * 0.68;
      this.f.push({ sx: x, sz: z, x, z, ph: Math.random() * 6.28, yaw: Math.random() * 6.28, r1: Math.random(), r2: Math.random(), s: 1 });
      this.mesh.setColorAt(i, cols[i % cols.length]);
    }
    ship.group.add(this.mesh);
  }
  // bd (while boarding): { side: local x sign facing the foe, lanes: [men per lane], won: [bool], flip, reach }
  update(dt, time, bd) {
    const sp = this.ship.spec, n = Math.min(FIG_MAX, Math.ceil(this.ship.crew / this.per));
    let lane = 0, used = 0, quota = bd ? Math.ceil(bd.lanes[0] / this.per) : 0;
    for (let i = 0; i < FIG_MAX; i++) {
      const f = this.f[i];
      let tx = f.sx, tz = f.sz, alive = i < n, fight = 0;
      if (bd && alive) {
        while (lane < 2 && used >= quota) { lane++; used = 0; quota = Math.ceil(bd.lanes[lane] / this.per); }
        if (used >= quota) alive = false;
        else {
          used++;
          const k = bd.flip ? 2 - lane : lane, hw = halfWidth(sp, 0.5);
          tz = (k - 1) * sp.L * 0.27 + (f.r1 - 0.5) * sp.L * 0.2;
          tx = bd.won[lane] ? bd.side * (hw + 1.6 + f.r2 * bd.reach) : bd.side * hw * (0.35 + f.r2 * 0.5);
          fight = 1;
        }
      }
      const k = Math.min(1, dt * 2.6);
      f.x += (tx - f.x) * k; f.z += (tz - f.z) * k;
      f.s += ((alive ? 1 : 0) - f.s) * Math.min(1, dt * 6);
      const t = clamp(f.z / sp.L + 0.5, 0, 1);
      const lunge = fight ? Math.sin(time * 9 + f.ph) * 0.3 : 0;
      _fp.set(f.x + (bd ? bd.side * lunge : 0), deckAt(sp, t) + Math.abs(Math.sin(time * (fight ? 9 : 1.3) + f.ph)) * (fight ? 0.25 : 0.05), f.z);
      _fq.setFromAxisAngle(_up, fight ? (bd.side > 0 ? Math.PI / 2 : -Math.PI / 2) : f.yaw);
      _fs.setScalar(Math.max(0.0001, f.s) * 1.65);
      this.mesh.setMatrixAt(i, _fm.compose(_fp, _fq, _fs));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
