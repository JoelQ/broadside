import * as THREE from 'three';

// Every model in the game is built in code from boxes, cylinders and lofted strips. A Batch
// collects any number of those, each in its own colour, into one flat-shaded mesh, so a whole
// ship or a whole town costs one draw call however much detail it carries.
const _c = new THREE.Color(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const cyls = {};
const unitCyl = (seg, taper) => cyls[seg + ':' + taper] || (cyls[seg + ':' + taper] = new THREE.CylinderGeometry(taper, 1, 1, seg).toNonIndexed());

export const xf = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));

export class Batch {
  // `twin` is a second batch that is placed along with this one (a building's lit windows)
  constructor(twin) { this.pos = []; this.col = []; this.base = null; this.twin = twin; }
  // everything added inside fn is placed relative to x,y,z and turned by ry: one building, one tree
  at(x, y, z, ry, fn) {
    const old = this.base, m = xf(x, y, z, 0, ry);
    this.base = old ? old.clone().multiply(m) : m;
    if (this.twin) this.twin.base = this.base;
    fn(this);
    this.base = old;
    if (this.twin) this.twin.base = old;
    return this;
  }
  vert(x, y, z, c) {
    _v.set(x, y, z); if (this.base) _v.applyMatrix4(this.base);
    this.pos.push(_v.x, _v.y, _v.z); this.col.push(c.r, c.g, c.b);
  }
  // any geometry, in one colour, placed by a matrix
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, flip = m && m.determinant() < 0;
    _c.set(color);
    for (let i = 0; i < p.count; i++) {
      const k = flip && i % 3 ? i + (i % 3 === 1 ? 1 : -1) : i; // a mirrored copy keeps its faces outward
      _w.fromBufferAttribute(p, k); if (m) _w.applyMatrix4(m);
      this.vert(_w.x, _w.y, _w.z, _c);
    }
    return this;
  }
  // a plank from one point to another, w wide and h thick
  beam(a, b, w, h, color) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], run = Math.hypot(dx, dz);
    return this.add(UNIT_BOX, color, xf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -Math.atan2(dy, run), Math.atan2(dx, dz), 0, w, h, Math.hypot(run, dy)));
  }
  // box of size w,h,d centred at x,y,z, turned by rx,ry,rz
  box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(UNIT_BOX, color, xf(x, y, z, rx, ry, rz, w, h, d)); }
  // upright cylinder (or cone: r1 is the top radius) centred at x,y,z
  cyl(r1, r0, h, color, x, y, z, seg = 6, rx = 0, ry = 0, rz = 0) { return this.add(unitCyl(seg, r0 ? r1 / r0 : 1), color, xf(x, y, z, rx, ry, rz, r0 || r1, h, r0 || r1)); }
  // a round bar from one point to another
  bar(a, b, r, color, seg = 5, r1 = r) {
    _w.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _w.length(), m = new THREE.Matrix4().compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q.setFromUnitVectors(_s.set(0, 1, 0), _w.divideScalar(len || 1)), _s.set(r, len, r));
    return this.add(unitCyl(seg, r1 / r), color, m);
  }
  tri(a, b, c, color) {
    _c.set(color);
    for (const v of [a, b, c]) this.vert(v[0], v[1], v[2], _c);
    return this;
  }
  quad(a, b, c, d, color) { return this.tri(a, b, c, color).tri(a, c, d, color); }
  // skin between successive rings of points; colors[j] paints the strip between point j and j+1
  loft(rings, colors) {
    for (let s = 0; s < rings.length - 1; s++) for (let j = 0; j < rings[s].length - 1; j++)
      this.quad(rings[s][j], rings[s][j + 1], rings[s + 1][j + 1], rings[s + 1][j], Array.isArray(colors) ? colors[j] : colors);
    return this;
  }
  get empty() { return !this.pos.length; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
  mesh(material) { return new THREE.Mesh(this.geometry(), material || SOLID); }
}
export const SOLID = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
export const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
export const shade = (color, k) => new THREE.Color(color).multiplyScalar(k);
export const blend = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
export const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
