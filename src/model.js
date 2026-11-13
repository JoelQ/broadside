import * as THREE from 'three';
import { Batch, SOLID, GLOW, shade, clamp } from './geo.js';

// The procedural ship model: every ship in the game is built here from its spec.
const WOOD = 0x5b4027, SPAR = 0x74522f, IRON = 0x1c1c1e, DECK = 0x9a7a50, BOTTOM = 0x3a2a22, LAMP = 0xffd98a, CAP = 0x46301d, GOLD = 0xd9b25f;
const css = (c) => (typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'));

// ---------- hull shape ----------
export function halfWidth(spec, t) {
  const b = spec.B / 2;
  const stern = Math.min(1, 0.7 + t * 1.7);
  const bow = t > 0.6 ? Math.pow(Math.cos(((t - 0.6) / 0.4) * Math.PI * 0.5), 0.75) : 1;
  return Math.max(0.06, b * stern * bow);
}
const deckTop = (spec, t) => spec.D + 0.9 * (2 * t - 1) ** 2 * (t < 0.5 ? 1.5 : 1.1); // top of the rail
export const deckAt = (spec, t) => deckTop(spec, t) - 0.9; // the main deck
// Raised decks: a quarterdeck (and on a galleon a poop above it) aft, a forecastle forward.
// `lift` is the height of the deck above the main deck, `base` the height its walls start from.
export function raisedDecks(spec) {
  const lv = +spec.castle || 0, h = 2.4 + spec.L * 0.012, out = [];
  for (let k = 0; k < lv; k++) out.push({ t0: 0, t1: 0.245 - k * 0.07, lift: h * (k + 1), base: k ? h * k + 0.9 : 0.9, k });
  if (spec.fore) out.push({ t0: 0.79, t1: 0.93, lift: 2.2, base: 0.9, k: 0 });
  return out;
}
const liftAt = (decks, t) => decks.reduce((m, r) => (t >= r.t0 && t <= r.t1 ? Math.max(m, r.lift) : m), 0);
// the deck a man stands on at t, raised decks included
export const deckLevel = (spec, t, decks = raisedDecks(spec)) => deckAt(spec, t) + liftAt(decks, t);

// ---------- textures ----------
function sailTexture(spec, emblem, tier) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  let seed = 7 + tier * 13 + (emblem ? 5 : 0);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = spec.sailCol; x.fillRect(0, 0, S, S);
  // weathering: broad faint stains
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},0.035)`; x.beginPath(); x.ellipse(rnd() * S, rnd() * S, 20 + rnd() * 50, 14 + rnd() * 36, rnd() * 3, 0, 7); x.fill(); }
  // cloths sewn edge to edge, and two bands of reef points
  x.strokeStyle = 'rgba(0,0,0,0.15)'; x.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * S / 8, 0); x.lineTo(i * S / 8, S); x.stroke(); }
  for (const y of [52, 88]) {
    x.fillStyle = 'rgba(0,0,0,0.09)'; x.fillRect(0, y, S, 5);
    x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 16; i++) x.fillRect(8 + i * 16, y + 3, 1.5, 9);
  }
  const gr = x.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0.14)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = gr; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 5; x.strokeRect(0, 0, S, S); // bolt rope
  const ec = spec.emblemCol || '#e8e2d0';
  x.save(); x.scale(2, 2);
  if (emblem === 'skull') {
    x.fillStyle = ec;
    x.beginPath(); x.arc(64, 54, 20, 0, 7); x.fill(); x.fillRect(52, 66, 24, 14);
    x.strokeStyle = ec; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(34, 76); x.lineTo(94, 106); x.moveTo(94, 76); x.lineTo(34, 106); x.stroke();
    x.fillStyle = spec.sailCol; x.beginPath(); x.arc(56, 54, 5, 0, 7); x.arc(72, 54, 5, 0, 7); x.fill(); x.fillRect(62, 62, 4, 6);
    for (let i = 0; i < 3; i++) x.fillRect(56 + i * 6, 74, 2, 6);
  } else if (emblem === 'cross') {
    x.fillStyle = spec.emblemCol || '#1f4f8f'; x.fillRect(54, 14, 20, 100); x.fillRect(22, 44, 84, 20);
  } else if (emblem === 'stripes') {
    x.fillStyle = spec.emblemCol; for (let i = 0; i < 3; i++) x.fillRect(0, 14 + i * 40, 128, 16);
  }
  else if (emblem === 'crescent') { x.fillStyle = ec; x.beginPath(); x.arc(64, 60, 26, 0, 7); x.fill(); x.fillStyle = spec.sailCol; x.beginPath(); x.arc(74, 60, 22, 0, 7); x.fill(); }
  else if (emblem === 'lion') { x.fillStyle = ec; lion(x, 64, 62, 1.5); }
  else if (emblem === 'band') { x.fillStyle = ec; x.fillRect(0, 50, 128, 26); }
  if (tier > 0) {
    x.globalCompositeOperation = 'destination-out';
    const n = tier === 1 ? 6 : 15;
    for (let i = 0; i < n; i++) { x.beginPath(); x.ellipse(rnd() * 128, rnd() * 128, 4 + rnd() * (tier === 1 ? 7 : 12), 3 + rnd() * 9, rnd() * 3, 0, 7); x.fill(); }
    if (tier === 2) for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * 15, 128); x.lineTo(i * 15 + 7, 86 + rnd() * 30); x.lineTo(i * 15 + 15, 128); x.fill(); }
  }
  x.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
// the winged lion, near enough: body, head, wing, tail and a book under one paw
function lion(x, cx, cy, k) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.fillRect(-16, -6, 30, 11); x.beginPath(); x.arc(-18, -8, 8, 0, 7); x.fill();
  for (const lx of [-15, -7, 5, 11]) x.fillRect(lx, 4, 4, 10);
  x.beginPath(); x.moveTo(-8, -6); x.lineTo(8, -24); x.lineTo(12, -6); x.fill();
  x.fillRect(13, -12, 3, 9); x.fillRect(13, -14, 9, 3); x.fillRect(-26, 10, 9, 6);
  x.restore();
}
export function flagTexture(spec) {
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 56;
  const x = cv.getContext('2d');
  x.fillStyle = css(spec.flagCol); x.fillRect(0, 0, 96, 56);
  x.fillStyle = x.strokeStyle = '#ece6d4';
  if (spec.emblem === 'cross') { x.fillRect(30, 0, 10, 56); x.fillRect(0, 23, 96, 10); }
  else if (spec.emblem === 'crescent') { x.beginPath(); x.arc(44, 28, 15, 0, 7); x.fill(); x.fillStyle = css(spec.flagCol); x.beginPath(); x.arc(50, 28, 12.5, 0, 7); x.fill(); }
  else if (spec.emblem === 'lion') { x.fillStyle = '#e8c15a'; x.fillRect(0, 0, 96, 5); x.fillRect(0, 51, 96, 5); lion(x, 46, 30, 0.8); }
  else if (spec.emblem === 'band' || spec.emblem === 'stripes') { x.fillRect(0, 22, 96, 12); }
  else if (spec.emblem === 'plain') { /* a bare field */ }
  else {
    x.beginPath(); x.arc(48, 22, 11, 0, 7); x.fill(); x.fillRect(42, 28, 12, 9);
    x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(30, 34); x.lineTo(66, 50); x.moveTo(66, 34); x.lineTo(30, 50); x.stroke();
    x.fillStyle = css(spec.flagCol); x.beginPath(); x.arc(44, 22, 3, 0, 7); x.arc(52, 22, 3, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- sails ----------
// a square sail hung from its yard: narrower at the head, bellied, the foot cut in a shallow arch
function squareSail(head, foot, h, mat) {
  const g = new THREE.PlaneGeometry(1, h, 10, 7);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) / h + 0.5, arch = Math.sin(u * Math.PI);
    p.setXYZ(i, (u - 0.5) * (foot + (head - foot) * v), p.getY(i) + arch * h * 0.07 * (1 - v) ** 3, arch * Math.sin((1 - v) * Math.PI * 0.82) * foot * 0.17);
  }
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
// a fore-and-aft sail: corners given as [y, z] in the ship's centreline plane, bellied out to +x
function flatSail(pts, mat, belly) {
  const [a, b, c, d] = pts.length === 3 ? [pts[0], pts[1], pts[2], pts[2]] : pts, n = 7;
  const ys = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys), z0 = Math.min(...zs), z1 = Math.max(...zs), pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / n;
    const y = (a[0] + (b[0] - a[0]) * u) * (1 - v) + (d[0] + (c[0] - d[0]) * u) * v, z = (a[1] + (b[1] - a[1]) * u) * (1 - v) + (d[1] + (c[1] - d[1]) * u) * v;
    pos.push(belly * Math.sin(u * Math.PI) * Math.sin(v * Math.PI), y, z); uv.push((z - z0) / (z1 - z0 || 1), (y - y0) / (y1 - y0 || 1));
    if (i < n && j < n) { const k = j * (n + 1) + i; idx.push(k, k + 1, k + n + 2, k, k + n + 2, k + n + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// ---------- hull ----------
function buildHull(S, glow, spec, decks) {
  const L = spec.L, ns = 26, draft = spec.D * 0.8, top0 = deckTop(spec, 0), top1 = deckTop(spec, 1);
  const hullC = spec.hullCol, trimC = spec.trimCol, wale = shade(hullC, 0.5), inner = shade(DECK, 0.66);
  const planks = [0, 1, 2, 3, 4, 5].map((i) => shade(DECK, i % 2 ? 1 : 0.9));
  // the stern leans aft and the stem leans forward as they rise
  const zOf = (t, y) => (t - 0.5) * L - 0.035 * L * Math.max(0, y / top0) * Math.max(0, 1 - t / 0.12) + 0.035 * L * clamp(y / top1, 0, 1.3) * Math.max(0, (t - 0.82) / 0.18);
  const across = (t, pts, y) => { const w = pts[pts.length - 1][0]; for (let i = 1; i < 6; i++) pts.push([w * (1 - i / 3), y]); for (let i = pts.length - 6; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]); return pts.map((q) => [q[0], q[1], zOf(t, q[1])]); };
  const outer = (t) => {
    const w = halfWidth(spec, t), top = deckTop(spec, t);
    const k = (t > 0.78 ? 1 - ((t - 0.78) / 0.22) * 0.8 : 1) * (t < 0.16 ? 0.45 + 0.55 * (t / 0.16) : 1); // the keel rises to the stem and under the stern
    return [[0, -draft * k], [0.5 * w, -draft * 0.82 * k], [0.82 * w, -draft * 0.45 * k], [0.94 * w, -0.05], [w, top * 0.62], [1.03 * w, top * 0.64], [1.03 * w, top * 0.72], [0.97 * w, top * 0.74], [0.95 * w, top]];
  };
  const sideCols = [BOTTOM, BOTTOM, BOTTOM, hullC, wale, wale, wale, trimC, CAP, CAP, CAP, inner];
  const rings = [];
  for (let s = 0; s <= ns; s++) {
    const t = s / ns, w = halfWidth(spec, t), top = deckTop(spec, t);
    rings.push(across(t, [...outer(t), [0.985 * w, top], [0.985 * w, top + 0.14], [0.88 * w, top + 0.14], [0.9 * w, top - 0.9]], top - 0.9));
  }
  S.loft(rings, [...sideCols, ...planks, ...sideCols.slice().reverse()]);
  // transom, stem post, rudder
  const tr = outer(0);
  S.loft(tr.map((q) => [[-q[0], q[1], zOf(0, q[1])], [q[0], q[1], zOf(0, q[1])]]), [BOTTOM, BOTTOM, BOTTOM, hullC, wale, wale, wale, trimC]);
  S.box(tr[8][0] * 2.08, 0.16, 0.34, CAP, 0, top0 + 0.07, zOf(0, top0));
  S.bar([0, -draft * 0.2, zOf(1, -1)], [0, top1 + 0.5, zOf(1, top1 + 0.5)], 0.2, CAP, 4);
  S.box(0.22, draft * 0.5 + 1.2, 1.3, BOTTOM, 0, 0.6 - (draft * 0.5 + 1.2) / 2, -L / 2 - 0.55);

  // raised decks
  for (const r of decks) {
    const n = Math.max(2, Math.ceil((r.t1 - r.t0) * ns)), rr = [], wf = 0.95 - 0.02 * r.k;
    const cols = [trimC, CAP, inner, ...planks, inner, CAP, trimC];
    for (let i = 0; i <= n; i++) {
      const t = r.t0 + ((r.t1 - r.t0) * i) / n, w = halfWidth(spec, t) * wf, y = deckAt(spec, t);
      rr.push(across(t, [[w, y + r.base], [w, y + r.lift + 0.9], [w - 0.16, y + r.lift + 0.9], [w - 0.16, y + r.lift]], y + r.lift));
    }
    S.loft(rr, cols);
    // a bulkhead closes each open end, with a door, lit windows, a rail above and ladders down
    for (const [t, dir] of [[r.t0, -1], [r.t1, 1]]) {
      const w = halfWidth(spec, t) * wf, y = deckAt(spec, t), lo = y + (dir < 0 || !r.k ? 0 : r.base - 0.9), hi = y + r.lift;
      if (t <= 0) { // the stern itself: carry the transom up
        S.quad([-w, y + r.base, zOf(0, y + r.base)], [w, y + r.base, zOf(0, y + r.base)], [w, hi + 0.9, zOf(0, hi + 0.9)], [-w, hi + 0.9, zOf(0, hi + 0.9)], trimC);
        S.box(w * 2.06, 0.16, 0.34, CAP, 0, hi + 0.97, zOf(0, hi + 0.9));
        continue;
      }
      const z = (t - 0.5) * L;
      S.quad([-w, lo, z], [w, lo, z], [w, hi, z], [-w, hi, z], shade(trimC, 0.8));
      S.box(w * 2, 0.12, 0.16, CAP, 0, hi + 0.84, z);
      for (let px = -w + 0.1; px < w; px += Math.max(0.8, w / 5)) S.box(0.1, 0.8, 0.1, CAP, px, hi + 0.4, z);
      if (hi - lo > 1.6) {
        S.box(0.9, Math.min(2, hi - lo - 0.3), 0.12, shade(WOOD, 0.55), 0, lo + Math.min(2, hi - lo - 0.3) / 2, z + dir * 0.02);
        for (const sx of [-1, 1]) {
          glow.box(0.7, 0.6, 0.1, LAMP, sx * w * 0.42, lo + (hi - lo) * 0.6, z + dir * 0.03);
          S.beam([sx * w * 0.72, lo, z + dir * (hi - lo) * 0.75], [sx * w * 0.72, hi, z + dir * 0.06], 0.8, 0.12, WOOD);
        }
      }
    }
  }
  // stern windows: one lit row for the cabin, one more for each storey of the sterncastle
  const rake = Math.atan((0.035 * L) / top0), w0 = halfWidth(spec, 0) * 0.95;
  const rows = [top0 * 0.52, ...decks.filter((r) => r.t0 === 0).map((r) => deckAt(spec, 0) + r.lift - 0.2)];
  rows.forEach((y, i) => {
    const wr = w0 * (i ? 0.82 : 0.78), n = Math.max(3, Math.round(wr * 2 / 1.0)), hgt = Math.min(1.05, top0 * 0.2 + 0.2), z = zOf(0, y);
    S.box(wr * 2 + 0.3, hgt + 0.3, 0.12, shade(trimC, 0.6), 0, y, z - 0.02, -rake);
    for (let k = 0; k < n; k++) glow.box((wr * 2) / n - 0.16, hgt, 0.1, LAMP, -wr + ((k + 0.5) * wr * 2) / n, y, z - 0.08, -rake);
    S.box(wr * 2 + 0.5, 0.12, 0.3, GOLD, 0, y - hgt / 2 - 0.25, zOf(0, y - hgt / 2 - 0.25) - 0.08, -rake);
  });
  // lanterns over the taffrail
  const sternTop = deckTop(spec, 0) + liftAt(decks, 0);
  for (const sx of decks.some((r) => r.t0 === 0) ? [-0.6, 0, 0.6] : [0]) {
    const lx = sx * w0, ly = sternTop + (sx ? 0.9 : 1.2), lz = zOf(0, sternTop) - 0.25;
    S.box(0.08, ly - sternTop, 0.08, IRON, lx, (ly + sternTop) / 2, lz);
    glow.box(0.42, 0.5, 0.42, LAMP, lx, ly + 0.25, lz);
    S.cyl(0, 0.34, 0.26, IRON, lx, ly + 0.63, lz, 4, 0, Math.PI / 4);
  }
  // head: the knee under the bowsprit, a gilded figurehead, anchors at the catheads
  const hz = L / 2, hy = top1, tip = [0, hy + 0.25, hz + L * 0.085];
  for (const sx of [-0.11, 0.11]) S.tri([sx, 0.3, zOf(1, 0.3)], [sx, tip[1], tip[2]], [sx, hy, zOf(1, hy)], trimC);
  S.bar([0, 0.3, zOf(1, 0.3)], tip, 0.13, shade(trimC, 0.8), 4);
  S.box(0.34, 0.95, 0.34, GOLD, 0, tip[1] + 0.1, tip[2] + 0.05, 0.9);
  S.box(0.26, 0.26, 0.26, GOLD, 0, tip[1] + 0.52, tip[2] + 0.5, 0.9);
  for (const sx of [-1, 1]) {
    const t = 0.87, k = clamp(L / 36, 0.6, 1.3), w = halfWidth(spec, t) + 0.45 * k, y = deckTop(spec, t), z = (t - 0.5) * L;
    S.box(w + 0.2, 0.2 * k, 0.22 * k, CAP, sx * w * 0.5, y + 0.2 * k, z);
    S.box(0.1 * k, 1.5 * k, 0.1 * k, IRON, sx * w, y - 0.75 * k, z); S.box(0.1 * k, 0.1 * k, k, WOOD, sx * w, y - 0.1 * k, z);
    for (const d of [-1, 1]) S.box(0.1 * k, 0.6 * k, 0.12 * k, IRON, sx * w, y - 1.35 * k, z + d * 0.22 * k, d * 0.9);
  }
}

// ---------- the whole ship ----------
export function buildShipModel(spec) {
  const group = new THREE.Group(), S = new Batch(), glow = new Batch();
  const L = spec.L, B = spec.B, decks = raisedDecks(spec);
  const deckY = (t) => deckAt(spec, t), lift = (t) => liftAt(decks, t);
  const railY = (t) => deckTop(spec, t) + lift(t), railX = (t) => halfWidth(spec, t) * (lift(t) ? 0.95 : 1);
  buildHull(S, glow, spec, decks);

  // sails: three damage tiers, with and without emblem
  const mats = [0, 1, 2].map((tier) => [null, spec.emblem].map((em) => { const t = sailTexture(spec, em, tier); return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0x555555, side: THREE.DoubleSide, alphaTest: 0.5 }); }));
  const yards = [], sails = [], lines = [], booms = [], extra = [];
  const rig = spec.rig || 'square', thick = L / 30;
  const mastZ = { 1: [0.1], 2: [0.24, -0.17], 3: [0.3, 0.0, -0.3], 4: [0.35, 0.12, -0.13, -0.36] }[spec.masts];
  const mainIdx = spec.masts >= 3 ? 1 : 0;
  const line = (a, b) => lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const spars = (parts) => { const b = new Batch(); for (const [p, q, r, r1] of parts) b.bar(p, q, r, SPAR, 6, r1 ?? r); return b.mesh(); };
  // shrouds: a fan of ropes from the masthead down to the ship's side, laced across with ratlines
  const shrouds = (head, feet) => {
    for (const f of feet) line(head, f);
    const n = Math.floor((head[1] - feet[0][1]) / 1.1);
    for (let i = 1; i < n; i++) for (let j = 0; j < feet.length - 1; j++) {
      const k = i / n, a = feet[j], b = feet[j + 1];
      line([a[0] + (head[0] - a[0]) * k, a[1] + (head[1] - a[1]) * k, a[2] + (head[2] - a[2]) * k], [b[0] + (head[0] - b[0]) * k, b[1] + (head[1] - b[1]) * k, b[2] + (head[2] - b[2]) * k]);
    }
  };
  const tops = []; // where each mast's lower stays make fast, fore to aft
  let mainTop = null;
  mastZ.forEach((zf, mi) => {
    const z = zf * L, t = zf + 0.5, base = deckY(t), up = lift(t);
    const H = L * (mi === mainIdx ? 0.92 : spec.masts >= 3 && mi === spec.masts - 1 ? 0.7 : 0.8) * (spec.rigScale || 1), head = base + H;
    if (mi === mainIdx) mainTop = new THREE.Vector3(0, head, z);
    const em = mi === mainIdx ? 1 : 0;
    const n = rig === 'square' ? spec.sailsPerMast : 0, frac = n === 4 ? [0.36, 0.27, 0.21, 0.16] : n === 3 ? [0.42, 0.33, 0.25] : [0.56, 0.44];
    // yards: a mast stepped through a raised deck carries its lowest sail clear of it
    const his = [];
    let lo = base + up + 2.6;
    const span = base + H * 0.95 - lo;
    for (let s = 0; s < n; s++) his.push((lo += span * frac[s]));
    const hounds = n ? his[0] + 0.5 * thick : base + H * 0.84; // where the shrouds come in
    // mast: a stout lower mast, a top to spread the upper shrouds, and a lighter topmast above
    if (n) {
      S.bar([0, base - 0.5, z], [0, hounds + 0.9 * thick, z], 0.38 * thick, WOOD, 8, 0.3 * thick);
      S.bar([0, hounds - 0.4 * thick, z], [0, head, z], 0.27 * thick, SPAR, 6, 0.14 * thick);
      S.box(2.1 * thick, 0.14 * thick, 1.7 * thick, CAP, 0, hounds, z);
      S.box(0.8 * thick, 0.3 * thick, 0.8 * thick, CAP, 0, hounds + 0.9 * thick, z);
      for (let s = 1; s < n - 1; s++) for (const dz of [-0.3, 0.3]) S.box(1.3 * thick, 0.1 * thick, 0.12 * thick, CAP, 0, his[s] + 0.4 * thick, z + dz * thick);
    } else {
      S.bar([0, base - 0.5, z], [0, head, z], 0.38 * thick, WOOD, 8, 0.2 * thick);
      S.box(1.2 * thick, 0.1 * thick, 0.14 * thick, CAP, 0, hounds, z);
    }
    S.cyl(0.2 * thick, 0.2 * thick, 0.14 * thick, CAP, 0, head + 0.07 * thick, z, 6);
    S.cyl(0.46 * thick, 0.46 * thick, 0.5, CAP, 0, base + up + 0.25, z, 8); // mast partners at the deck
    tops.push([0, hounds, z, n ? his[n - 1] : head - 0.3]);

    if (rig !== 'square') {
      const boom = new THREE.Group();
      boom.position.set(0, base + 2.2, z);
      let sail;
      if (rig === 'gaff') {
        // sloop: one big mainsail between boom and gaff, abaft the mast
        const bl = L * 0.56, th = H * 0.62, pk = H * 0.86;
        sail = flatSail([[0, 0], [0, -bl], [pk, -bl * 0.62], [th, 0]], mats[0][em], bl * 0.1);
        boom.add(spars([[[0, 0, 0], [0, 0, -bl * 1.03], 0.2, 0.13], [[0, th, 0], [0, pk, -bl * 0.65], 0.16, 0.1]]));
      } else {
        // xebec: a triangular lateen sail hung from one long slanting yard
        const yl = L * 0.3 * (em ? 1.1 : 0.9), lowY = H * 0.08, hiY = H * 0.82;
        sail = flatSail([[lowY, yl * 0.75], [hiY, -yl * 0.55], [0, -yl * 0.7]], mats[0][em], yl * 0.13);
        boom.add(spars([[[0, (lowY + hiY) / 2, yl * 0.1], [0, lowY - 0.3, yl * 0.8], 0.19, 0.1], [[0, (lowY + hiY) / 2, yl * 0.1], [0, hiY + 0.3, -yl * 0.6], 0.19, 0.1]]));
      }
      sail.userData = { fa: true, course: false, emblem: em, furl: 1 };
      boom.add(sail); group.add(boom);
      booms.push(boom); sails.push(sail);
    }
    lo = base + up + 2.6;
    for (let s = 0; s < n; s++) {
      const hi = his[s];
      const wd = (k) => B * 2.05 * (1 - 0.2 * k) * (mi === mainIdx ? 1 : 0.88), w = wd(s), h = hi - lo - 0.7;
      const yard = new THREE.Group();
      yard.position.set(0, hi, z + 0.45);
      yard.add(spars([[[0, 0, 0], [w * 0.54, 0, 0], 0.17 * thick, 0.09 * thick], [[0, 0, 0], [-w * 0.54, 0, 0], 0.17 * thick, 0.09 * thick]]));
      const sail = squareSail(w * 0.96, s ? wd(s - 1) * 0.96 : w, h, mats[0][mi === mainIdx && s === 0 ? 1 : 0]);
      sail.userData = { course: s === 0, emblem: mi === mainIdx && s === 0 ? 1 : 0, furl: 1 };
      yard.add(sail);
      group.add(yard);
      yards.push(yard); sails.push(sail);
      lo = hi;
    }
    // a square-rigger sets a gaff spanker abaft her aftermost mast
    if (n && spec.masts > 1 && mi === spec.masts - 1) {
      const boom = new THREE.Group(), by = base + up + 2.2;
      boom.position.set(0, by, z);
      const bl = Math.min(L * 0.3, z + L * 0.54), th = (hounds - by) * 0.9, pk = th + bl * 0.42;
      const sail = flatSail([[0, -0.3], [0, -bl], [pk, -bl * 0.72], [th, -0.3]], mats[0][0], bl * 0.09);
      sail.userData = { fa: true, course: false, emblem: 0, furl: 1 };
      boom.add(spars([[[0, 0, 0], [0, 0, -bl * 1.04], 0.17 * thick, 0.11 * thick], [[0, th, 0], [0, pk + 0.2, -bl * 0.76], 0.14 * thick, 0.09 * thick]]), sail);
      group.add(boom); booms.push(boom); extra.push(sail);
    }
    // standing rigging
    const ns = L < 26 ? 2 : n ? 4 : 3, gap = L * 0.028, y0 = railY(t) + 0.05;
    for (const sx of [-1, 1]) {
      const feet = Array.from({ length: ns }, (_, i) => { const tz = z - 0.3 - i * gap; return [sx * railX(tz / L + 0.5), y0, tz]; });
      shrouds([sx * (n ? 0.9 : 0.2) * thick, hounds, z], feet);
      S.box(0.34, 0.12, gap * (ns - 1) + 0.9, CAP, sx * (railX(t) + 0.1), y0 - 0.1, z - 0.3 - (gap * (ns - 1)) / 2);
      if (n) {
        shrouds([sx * 0.1, his[Math.min(1, n - 1)], z], [[sx * 0.95 * thick, hounds, z + 0.6 * thick], [sx * 0.95 * thick, hounds, z - 0.6 * thick]]);
        const bz = z - L * 0.1; line([0, his[n - 1], z], [sx * railX(bz / L + 0.5), railY(bz / L + 0.5), bz]);
      }
    }
  });
  // stays: each mast is held forward to the one ahead of it, the foremast to the bowsprit
  const fore = mastZ[0] * L, tipZ = L / 2 + L * 0.2, tipY = deckY(1) + 2.6, sprit = [0, deckY(1) + 1.6 - L * 0.15 * Math.sin(0.22), L / 2 + L * 0.06 - L * 0.15 * Math.cos(0.22)];
  tops.forEach((p, i) => {
    const a = tops[i - 1];
    if (a) { line([0, p[1], p[2]], [0, deckY(a[2] / L + 0.5) + lift(a[2] / L + 0.5) + 0.6, a[2] - 0.5]); line([0, p[3], p[2]], [0, a[1], a[2]]); }
    else line([0, p[1], p[2]], [0, deckY(1) + 1.3, L / 2 - 0.4]);
  });
  // bowsprit + jib
  S.bar(sprit, [0, tipY, tipZ], 0.24 * thick, WOOD, 6, 0.13 * thick);
  S.bar([0, deckY(1) + 1.9, L / 2 + L * 0.1], [0, deckY(1) + 0.3, L / 2 + L * 0.105], 0.07 * thick, IRON, 4);
  line([0, tipY, tipZ], [0, deckY(1) + 0.3, L / 2 + L * 0.105]); line([0, deckY(1) + 0.3, L / 2 + L * 0.105], [0, 0.6, L / 2 + 0.3]);
  const jt = deckY(mastZ[0] + 0.5) + L * 0.62 * (spec.rigScale || 1);
  const jib = flatSail([[tipY + 0.3, tipZ - 0.4], [jt, fore + 0.9], [deckY(0.8) + 2.4, fore + 2.2]], mats[0][0], L * 0.035);
  jib.userData = { course: false, emblem: 0, jib: true, furl: 1 };
  group.add(jib); sails.push(jib, ...extra);
  line([0, tipY, tipZ], [0, jt + 1, fore]);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0.7 })));

  // flag
  const fw = 3.6 * Math.max(1, thick * 0.9), fg = new THREE.PlaneGeometry(fw, fw * 0.58, 8, 2); fg.translate(fw / 2, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: flagTexture(spec), side: THREE.DoubleSide }));
  flag.position.copy(mainTop).add(new THREE.Vector3(0, 0.2 - fw * 0.29, 0));
  group.add(flag);

  // guns: barrel, carriage and port for each; a lower-deck gun gets a lid hinged up over its port
  const muzzles = { port: [], stbd: [] };
  const decksN = spec.decks || 1, perRow = Math.ceil(spec.guns / decksN), cal = [0.85, 1, 1.18][spec.cal ?? 1];
  for (let i = 0; i < spec.guns; i++) {
    const row = decksN === 2 && i >= perRow ? 1 : 0, col = row ? i - perRow : i, inRow = row ? spec.guns - perRow : perRow;
    const t = 0.2 + (0.58 * (col + 0.5 + row * 0.5)) / (inRow + row * 0.5), z = (t - 0.5) * L, w = halfWidth(spec, t);
    const y = row ? deckTop(spec, t) * 0.36 : deckY(t) + 0.45;
    for (const sx of [1, -1]) {
      S.bar([sx * (w - 1.25), y, z], [sx * (w + 0.5), y, z], 0.27 * cal, IRON, 7, 0.19 * cal);
      S.cyl(0.24 * cal, 0.24 * cal, 0.14, IRON, sx * (w + 0.47), y, z, 7, 0, 0, Math.PI / 2);
      const px = row ? 0.975 : 0.925;
      S.box(0.07 * w + 0.3, 0.66, 0.9, 0x0b0b0c, sx * w * px, y + 0.02, z);
      if (row) S.box(0.07, 0.66, 0.9, spec.trimCol, sx * (w * 0.99 + 0.36), y + 0.5, z, 0, 0, sx * 1.1);
      else if (!lift(t)) { S.box(0.95, 0.3, 0.8, 0x6b3524, sx * (w - 1.0), y - 0.3, z); S.box(0.5, 0.2, 0.8, 0x6b3524, sx * (w - 1.3), y - 0.05, z); }
      muzzles[sx > 0 ? 'port' : 'stbd'].push(new THREE.Vector3(sx * (w + 0.6), y, z));
    }
  }

  // a galley's battery fires ahead, over the beak
  if (spec.bow) {
    muzzles.bow = [];
    const n = spec.bow.n, t = 0.84, w = halfWidth(spec, t) * 0.8, y = deckY(t) + 1.0, z = (t - 0.5) * L, c = [0.85, 1, 1.18][spec.bow.cal ?? 1], gap = n > 1 ? Math.min(1.3, (2 * w) / (n - 1)) : 0;
    S.box(w * 2 + 1.2, 0.5, 2.6, CAP, 0, y - 0.5, z - 0.6);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * gap;
      S.bar([x, y, z - 1.7], [x, y, z + 1.0], 0.3 * c, IRON, 7, 0.2 * c);
      muzzles.bow.push(new THREE.Vector3(x, y, z + 1.2));
    }
  }
  // oars: one bank a side, each a single mesh that is sheared to sweep and lift
  let oars = null;
  if (spec.oars) {
    oars = [];
    const n = Math.max(6, Math.round(L / 2.4));
    for (const sx of [1, -1]) {
      const b = new Batch();
      for (let i = 0; i < n; i++) {
        const t = 0.2 + (0.56 * (i + 0.5)) / n, z = (t - 0.5) * L, w = halfWidth(spec, t);
        b.bar([sx * (w - 0.4), deckY(t) + 0.5, z], [sx * (w + B * 0.95), 0.1, z], 0.09, 0xb89a68, 4, 0.14);
      }
      const m = b.mesh(); m.matrixAutoUpdate = false; m.userData.sx = sx;
      group.add(m); oars.push(m);
    }
  }

  // deck furniture along the centreline: hatch gratings, capstan, a boat on the big ships, the wheel
  const stops = [0.5 * L * 0.7, ...mastZ.map((m) => m * L), -L * 0.32];
  let boat = L >= 40;
  for (let i = 0; i < stops.length - 1; i++) {
    const zc = (stops[i] + stops[i + 1]) / 2, len = stops[i] - stops[i + 1], t = zc / L + 0.5, y = deckY(t);
    if (lift(t) || lift(t + 0.05) || lift(t - 0.05) || len < L * 0.13) continue;
    const gw = B * 0.24, gl = Math.min(len * 0.42, L * 0.09);
    S.box(gw + 0.3, 0.22, gl + 0.3, CAP, 0, y + 0.11, zc); S.box(gw, 0.08, gl, 0x2a2118, 0, y + 0.25, zc);
    if (boat) {
      boat = false;
      const bl = Math.min(len * 0.8, L * 0.17), bw = B * 0.1, rr = [];
      for (let k = 0; k <= 6; k++) { const u = k / 6, hw = bw * Math.sin(Math.PI * (0.12 + u * 0.8)) ** 0.7, zz = zc + (u - 0.5) * bl, yy = y + 0.75; rr.push([[-hw, yy, zz], [-hw * 0.8, yy + 0.45, zz], [0, yy + 0.7, zz], [hw * 0.8, yy + 0.45, zz], [hw, yy, zz]]); }
      S.loft(rr, [0xd8d0bc, 0xcfc6b0, 0xcfc6b0, 0xd8d0bc]);
      for (const dz of [-0.3, 0.3]) S.box(bw * 2.2, 0.5, 0.22, CAP, 0, y + 0.5, zc + dz * bl);
    } else if (i === mainIdx + 1) S.cyl(0.42, 0.5, 0.9, WOOD, 0, y + 0.45, zc + gl / 2 + 1.1, 8).cyl(0.62, 0.62, 0.16, CAP, 0, y + 0.95, zc + gl / 2 + 1.1, 8);
  }
  const wt = decks.some((r) => r.t0 === 0) ? 0.1 : 0.13, wy = deckLevel(spec, wt, decks), wz = (wt - 0.5) * L;
  S.box(0.3, 1.0, 0.5, WOOD, 0, wy + 0.5, wz - 0.25);
  S.add(new THREE.TorusGeometry(0.62, 0.07, 4, 10), SPAR, new THREE.Matrix4().makeTranslation(0, wy + 1.05, wz + 0.08));
  for (let k = 0; k < 4; k++) S.box(1.5, 0.07, 0.07, SPAR, 0, wy + 1.05, wz + 0.08, 0, 0, (k * Math.PI) / 4);
  S.box(0.5, 0.75, 0.5, CAP, 0, wy + 0.38, wz + 1.3); // binnacle
  for (const [bx, bt] of [[0.45, mastZ[0] + 0.47], [-0.5, mastZ[0] + 0.455], [0.4, mastZ[mastZ.length - 1] + 0.56]]) if (!lift(bt)) S.cyl(0.3, 0.36, 0.85, 0x7a5632, bx * halfWidth(spec, bt), deckY(bt) + 0.43, (bt - 0.5) * L, 8);

  group.add(S.mesh());
  if (!glow.empty) group.add(glow.mesh(GLOW));
  return { group, yards, sails, booms, flag, muzzles, mats, decks, oars, mastH: L * 0.92 * (spec.rigScale || 1) + spec.D };
}
