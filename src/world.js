import * as THREE from 'three';
import { mulberry } from './geo.js';
import { makeIsland } from './land.js';

// ---------- shared wave model (JS + GLSL stay in sync) ----------
const RAW_WAVES = [
  // dirX, dirZ, amplitude, wavelength, speed
  [1.0, 0.25, 0.55, 64, 5.6],
  [0.3, 1.0, 0.36, 41, 4.3],
  [-0.65, 0.7, 0.22, 27, 3.5],
];
const RAW_DETAIL = [
  [0.8, 0.6, 0.05, 9.0, 2.2],
  [-0.4, 0.9, 0.04, 6.1, 1.9],
  [0.9, -0.5, 0.03, 4.3, 1.7],
  [-0.8, -0.3, 0.022, 2.9, 1.4],
  [0.1, 1.0, 0.016, 1.9, 1.2],
];
const norm = (w) => {
  const l = Math.hypot(w[0], w[1]);
  const k = (Math.PI * 2) / w[3];
  return { dx: w[0] / l, dz: w[1] / l, amp: w[2], k, om: w[4] * k };
};
export const WAVES = RAW_WAVES.map(norm);
const DETAIL = RAW_DETAIL.map(norm);

const f = (n) => n.toFixed(5);
const glslWave = (list, withHeight) =>
  list
    .map(
      (w) => `{ float ph = ${f(w.k)}*dot(p, vec2(${f(w.dx)},${f(w.dz)})) + uTime*${f(w.om)};
      ${withHeight ? `r.x += ${f(w.amp)}*sin(ph);` : ''}
      r.yz += ${f(w.amp * w.k)}*cos(ph)*vec2(${f(w.dx)},${f(w.dz)}); }`
    )
    .join('\n');

const WAVE_GLSL = `
uniform float uTime;
uniform float uAmp;
// returns (height, dh/dx, dh/dz)
vec3 bigWave(vec2 p){ vec3 r = vec3(0.); ${glslWave(WAVES, true)} return r*uAmp; }
vec2 detailWave(vec2 p){ vec3 r = vec3(0.); ${glslWave(DETAIL, false)} return r.yz*(0.6+0.4*uAmp); }
`;

export const ENVS = {
  harbor: {
    zenith: 0x3f6fb4, horizon: 0xf3cf9c, sun: [0.55, 0.34, 0.5], sunCol: 0xffd9a0,
    deep: 0x0f4a63, shallow: 0x3aa0a0, cloud: 0xffe6c8, cover: 0.55,
    hemi: 1.1, dir: 2.0, fog: [500, 3200], amp: 0.28,
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

const SKY_VS = `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; }
`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uSun, uSunCol, uCloud;
uniform float uCover, uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(7.1,3.3); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = max(d.y, 0.);
  vec3 col = mix(uHorizon, uZenith, pow(y, 0.5));
  float s = max(dot(d, uSun), 0.);
  col += uSunCol*(pow(s, 10.)*0.25);
  if (d.y > 0.01) {
    vec2 uv = d.xz/(d.y+0.14)*1.1 + vec2(uTime*0.006, uTime*0.003);
    float n = fbm(uv);
    float c = smoothstep(uCover, uCover+0.3, n) * smoothstep(0.01, 0.22, d.y);
    float shade = smoothstep(uCover+0.1, uCover+0.55, n);
    vec3 cc = mix(uCloud, uCloud*0.62 + uHorizon*0.12, shade);
    cc += uSunCol*pow(s, 6.)*0.3;
    col = mix(col, cc, c*0.9);
  }
  col += uSunCol*pow(s, 1200.)*4.;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}
`;

const WATER_VS = `
${WAVE_GLSL}
uniform vec3 uCenter;
varying vec3 vWorld;
varying float vH;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.);
  float fade = 1. - smoothstep(430., 660., distance(wp.xz, uCenter.xz));
  float h = bigWave(wp.xz).x*fade;
  wp.y += h; vH = h; vWorld = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;
const WATER_FS = `
${WAVE_GLSL}
uniform vec3 uCenter, uZenith, uHorizon, uSun, uSunCol, uDeep, uShallow;
uniform vec2 uFog;
uniform float uNear;
varying vec3 vWorld;
varying float vH;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  float cd = distance(vWorld.xz, uCenter.xz);
  if (uNear > 0.5 && cd > 690.) discard;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam/dist;
  vec3 w = bigWave(vWorld.xz);
  float dfade = smoothstep(340., 30., dist);
  vec2 warp = 7.*vec2(noise(vWorld.xz*0.045), noise(vWorld.xz*0.045 + 31.7));
  vec2 dd = detailWave(vWorld.xz + warp)*dfade;
  vec3 n = normalize(vec3(-(w.y+dd.x), 1., -(w.z+dd.y)));
  float fres = 0.03 + 0.97*pow(1. - max(dot(n, V), 0.), 5.);
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0., 1.), 0.5));
  float crest = clamp(w.x/(uAmp*1.1)*0.5 + 0.5, 0., 1.);
  vec3 body = mix(uDeep, uShallow, crest*crest*0.6);
  float diff = 0.55 + 0.45*max(dot(n, uSun), 0.);
  vec3 col = mix(body*diff, sky, fres*0.8);
  float sp = max(dot(R, uSun), 0.);
  col += uSunCol*(pow(sp, 260.)*2.2 + pow(sp, 24.)*0.12);
  // foam flecks on crests
  vec2 fp = vWorld.xz + vec2(uTime*0.4, uTime*0.25);
  float fn = noise(fp*0.45)*0.5 + noise(fp*1.3)*0.3 + noise(fp*4.1)*0.2;
  float foam = smoothstep(0.72, 1.0, crest)*smoothstep(0.48, 0.78, fn)*smoothstep(520., 60., dist);
  col = mix(col, vec3(0.88, 0.94, 0.96), clamp(foam, 0., 1.)*0.5);
  float fog = clamp((dist - uFog.x)/(uFog.y - uFog.x), 0., 1.);
  col = mix(col, uHorizon, fog*fog*(3.-2.*fog));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}
`;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.amp = 1;
    this.wind = { dir: 0.6, target: 0.6, timer: 40, str: 1, strTarget: 1, base: 1, steady: false };
    this.shoals = []; this.currentAt = null; this.envName = 'noon';
    this.shoalGroup = new THREE.Group(); scene.add(this.shoalGroup);
    this.islands = [];
    this.islandGroup = new THREE.Group();
    scene.add(this.islandGroup);

    const C = () => ({ value: new THREE.Color() });
    this.u = {
      uTime: { value: 0 }, uAmp: { value: 1 }, uCenter: { value: new THREE.Vector3() },
      uZenith: C(), uHorizon: C(), uSunCol: C(), uDeep: C(), uShallow: C(), uCloud: C(),
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uFog: { value: new THREE.Vector2(300, 2000) },
      uCover: { value: 0.5 },
    };

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(6000, 32, 16),
      new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    const mk = (near) =>
      new THREE.ShaderMaterial({
        vertexShader: WATER_VS, fragmentShader: WATER_FS,
        uniforms: { ...this.u, uNear: { value: near } },
      });
    const g1 = new THREE.PlaneGeometry(1400, 1400, 220, 220);
    g1.rotateX(-Math.PI / 2);
    this.near = new THREE.Mesh(g1, mk(1));
    const g2 = new THREE.RingGeometry(680, 9000, 72, 1);
    g2.rotateX(-Math.PI / 2);
    this.far = new THREE.Mesh(g2, mk(0));
    this.near.frustumCulled = this.far.frustumCulled = false;
    scene.add(this.near, this.far);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x224455, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0xffffff, 300, 2000);
    // wind streaks: faint lines drifting downwind so the wind is something you can see
    const N = 80;
    this.streaks = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, life: 0, max: 1 }));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 8), 4));
    this.streakMesh = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    this.streakMesh.frustumCulled = false;
    scene.add(this.streakMesh);
    this.setEnv('noon');
  }

  updateStreaks(dt, focus) {
    const wx = Math.sin(this.wind.dir), wz = Math.cos(this.wind.dir), sp = 34 * Math.max(0.08, this.wind.str);
    const pos = this.streakMesh.geometry.attributes.position, col = this.streakMesh.geometry.attributes.color;
    this.streaks.forEach((s, i) => {
      s.life -= dt;
      if (s.life <= 0) {
        s.max = s.life = 1.6 + Math.random() * 1.8;
        const a = Math.random() * 6.28, d = 20 + Math.random() * 130;
        s.x = focus.x + Math.sin(a) * d - wx * 30; s.z = focus.z + Math.cos(a) * d - wz * 30; s.y = 2 + Math.random() * 16;
      }
      s.x += wx * sp * dt; s.z += wz * sp * dt;
      const len = 15, a = Math.sin((s.life / s.max) * Math.PI) * 0.7;
      pos.setXYZ(i * 2, s.x, s.y, s.z); pos.setXYZ(i * 2 + 1, s.x - wx * len, s.y, s.z - wz * len);
      col.setXYZW(i * 2, 1, 1, 1, a); col.setXYZW(i * 2 + 1, 1, 1, 1, 0);
    });
    pos.needsUpdate = col.needsUpdate = true;
  }

  setEnv(name) {
    const e = ENVS[name];
    const u = this.u;
    u.uZenith.value.set(e.zenith); u.uHorizon.value.set(e.horizon); u.uSunCol.value.set(e.sunCol);
    u.uDeep.value.set(e.deep); u.uShallow.value.set(e.shallow); u.uCloud.value.set(e.cloud);
    u.uSun.value.set(...e.sun).normalize(); u.uFog.value.set(...e.fog); u.uCover.value = e.cover;
    u.uAmp.value = this.amp = e.amp;
    this.hemi.color.set(e.zenith).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.set(e.deep).lerp(new THREE.Color(e.horizon), 0.3);
    this.hemi.intensity = e.hemi;
    this.sun.color.set(e.sunCol); this.sun.intensity = e.dir;
    this.scene.fog.color.set(e.horizon); this.scene.fog.near = e.fog[0]; this.scene.fog.far = e.fog[1];
    this.env = e; this.envName = name; this.baseAmp = e.amp;
  }

  height(x, z) {
    let h = 0;
    const t = this.time;
    for (const w of WAVES) h += w.amp * Math.sin(w.k * (x * w.dx + z * w.dz) + t * w.om);
    return h * this.amp;
  }

  clearIslands() { this.islandGroup.clear(); this.islands = []; this.setShoals([]); this.currentAt = null; this.setWind(undefined, 1, true); this.wind.steady = false; }
  // wind strength: 0 is a dead calm, 1 a working breeze, 1.6 a gale
  setWind(dir, str, now) {
    const w = this.wind;
    if (dir !== undefined) { w.target = dir; if (now) w.dir = dir; }
    if (str !== undefined) { w.strTarget = w.base = str; if (now) w.str = str; }
  }
  windName() { const s = this.wind.str; return s < 0.3 ? 'Calm' : s < 0.65 ? 'Light airs' : s <= 1.25 ? 'Breeze' : 'Gale'; }
  // islands placed by hand: [{x, z, r, h?, seed?}]
  addIsland(o) {
    const rnd = mulberry(o.seed || Math.round(o.x * 7 + o.z * 13 + o.r)), isl = { x: o.x, z: o.z, r: o.r * 0.8, h: o.h || o.r * 0.45 };
    this.islands.push(isl);
    this.islandGroup.add(makeIsland(o.r, isl.h, rnd, o.x, o.z, o.opts || {}));
    return isl;
  }
  // shoals: [{x, z, r, depth}]. A ship drawing more than `depth` sticks there.
  setShoals(list, marked) {
    for (const m of this.shoalGroup.children) { m.geometry.dispose(); }
    this.shoalGroup.clear(); this.shoals = list;
    for (const s of list) {
      const g = new THREE.CircleGeometry(s.r, 28); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x8fe0cf, transparent: true, opacity: marked ? 0.3 : 0.16, depthWrite: false, depthTest: false, fog: false }));
      m.position.set(s.x, 0.9, s.z); m.renderOrder = 1; this.shoalGroup.add(m);
      if (marked) {
        const rg = new THREE.RingGeometry(s.r - 1.2, s.r, 40); rg.rotateX(-Math.PI / 2);
        const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xf3e6b0, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false, fog: false }));
        r.position.set(s.x, 1, s.z); r.renderOrder = 1; this.shoalGroup.add(r);
      }
    }
  }
  shoalAt(x, z, draught) {
    for (const s of this.shoals) if (draught > s.depth && Math.hypot(x - s.x, z - s.z) < s.r) return s;
    return null;
  }

  setIslands(seed, count) {
    this.islandGroup.clear();
    this.islands = [];
    const rnd = mulberry(seed);
    let guard = 0;
    while (this.islands.length < count && guard++ < 200) {
      const a = rnd() * Math.PI * 2, d = 190 + rnd() * 620, r = 26 + rnd() * 42;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (this.islands.some((i) => Math.hypot(i.x - x, i.z - z) < i.r + r + 90)) continue;
      const isl = { x, z, r: r * 0.8, h: r * (0.35 + rnd() * 0.3) };
      this.islands.push(isl);
      this.islandGroup.add(makeIsland(r, isl.h, rnd, x, z));
    }
  }

  update(dt, camPos) {
    this.time += dt;
    this.u.uTime.value = this.time;
    const w = this.wind;
    w.timer -= dt;
    if (w.timer <= 0) { w.timer = 35 + Math.random() * 40; if (!w.steady) w.target = w.dir + (Math.random() - 0.5) * 1.3; }
    w.dir += (w.target - w.dir) * Math.min(1, dt * 0.08);
    // in a calm the air comes in cat's-paws: brief puffs a light ship can use
    w.strTarget = w.base < 0.3 ? w.base + Math.max(0, Math.sin(this.time * 0.37) * Math.sin(this.time * 0.11 + 1)) * 0.3 : w.base;
    w.str += (w.strTarget - w.str) * Math.min(1, dt * 0.25);
    this.amp = this.u.uAmp.value = this.baseAmp * (0.25 + 0.75 * Math.min(1, w.str)) * (w.str > 1.25 ? 1.5 : 1);
    const s = 1400 / 220;
    const cx = Math.round(camPos.x / s) * s, cz = Math.round(camPos.z / s) * s;
    this.near.position.set(cx, 0, cz);
    this.far.position.set(cx, 0, cz);
    this.u.uCenter.value.set(cx, 0, cz);
    this.sky.position.copy(camPos);
    this.sun.position.copy(camPos).addScaledVector(this.u.uSun.value, 500);
    this.sun.target.position.copy(camPos);
  }
}
