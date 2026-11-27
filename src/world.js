import * as THREE from 'three';
import { mulberry, clamp } from './geo.js';
import { makeIsland } from './land.js';
import { coastMesh } from './coast.js';
import { WAVES, DETAIL, ENVS } from './sea.js';

// The sea drawn: sky, water, light, land, banks, wind streaks and current marks, all following a Sea (sea.js), which
// holds the rules. The Sea tells this view when its land, banks or light change; update() follows its clock and waves.
export { WAVES, ENVS };

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

function canvasTex(n, draw) {
  const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a sand bank seen through the water: bright in the middle, fading out
const bankTexture = () => canvasTex(128, (x, n) => {
  const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,250,215,1)'); g.addColorStop(0.75, 'rgba(255,255,255,0.75)'); g.addColorStop(0.9, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, n, n);
});
// broken water: a dashed, uneven white band
const foamTexture = () => canvasTex(128, (x, n) => {
  const rnd = mulberry(3);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${(0.3 + rnd() * 0.7).toFixed(2)})`; x.fillRect(rnd() * n, rnd() * n, 2 + rnd() * 6, 2 + rnd() * 3); }
});
const labelTexture = (txt, danger) => canvasTex(128, (x, n) => {
  x.font = 'bold 44px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.strokeText(txt, n / 2, n / 2);
  x.fillStyle = danger ? '#ff8a7a' : '#f6ecc8'; x.fillText(txt, n / 2, n / 2);
});

// A bank seen through the water, drawn from its shape: a grid over it whose colour and alpha follow how far
// inside the edge each point is, bright sand in the middle fading out a little past the edge.
function bankGeometry(s) {
  const [x0, z0, x1, z1] = s.box, pad = clamp(s.inner * 0.3, 4, 14), st = clamp(Math.sqrt(s.area) / 22, 3, 8);
  const nx = Math.ceil((x1 - x0 + pad * 2) / st), nz = Math.ceil((z1 - z0 + pad * 2) / st), X0 = x0 - pad, Z0 = z0 - pad;
  const A = new Float32Array((nx + 1) * (nz + 1)), sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const d = s.at(X0 + i * st, Z0 + j * st), t = d / Math.max(s.inner, 1);
    A[j * (nx + 1) + i] = d < 0 ? 0.38 * sm(-pad, 0, d) : 0.38 + 0.37 * Math.min(1, t / 0.3) + 0.25 * clamp((t - 0.3) / 0.7, 0, 1);
  }
  const pos = [], col = [];
  const v = (i, j) => { const a = A[j * (nx + 1) + i], k = clamp((a - 0.75) / 0.25, 0, 1); pos.push(X0 + i * st, 0, Z0 + j * st); col.push(1, 1 - 0.02 * k, 1 - 0.16 * k, a); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!(A[j * (nx + 1) + i] || A[j * (nx + 1) + i + 1] || A[(j + 1) * (nx + 1) + i] || A[(j + 1) * (nx + 1) + i + 1])) continue;
    v(i, j); v(i, j + 1); v(i + 1, j); v(i + 1, j); v(i, j + 1); v(i + 1, j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  return g;
}
// broken water along a closed outline (anticlockwise): a band `out` yards outside it and `inn` inside
function edgeGeometry(pts, out, inn) {
  const n = pts.length, pos = [], uv = [], idx = [];
  let run = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
    if (i) run += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const ox = tz / l, oz = -tx / l; // outward
    pos.push(p[0] + ox * out, 0, p[1] + oz * out, p[0] - ox * inn, 0, p[1] - oz * inn);
    uv.push(run / 40, 0, run / 40, 0.12);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class WorldView {
  constructor(scene, sea) {
    this.scene = scene; this.sea = sea; sea.view = this;
    this.shoalGroup = new THREE.Group(); scene.add(this.shoalGroup);
    this.tex = { bank: bankTexture(), foam: foamTexture() };
    // current marks: foam lines that ride the current, so the set of the water is something you can see
    const NF = 150;
    this.flow = Array.from({ length: NF }, () => ({ x: 0, z: 0, life: 0, max: 1, vx: 0, vz: 0 }));
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 6), 3));
    fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NF * 8), 4));
    this.flowMesh = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    this.flowMesh.frustumCulled = false; scene.add(this.flowMesh);
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
    this.env(sea.envName);
  }

  updateStreaks(dt, focus) {
    const wx = Math.sin(this.sea.wind.dir), wz = Math.cos(this.sea.wind.dir), sp = 34 * Math.max(0.08, this.sea.wind.str);
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

  env(name) {
    const e = ENVS[name];
    const u = this.u;
    u.uZenith.value.set(e.zenith); u.uHorizon.value.set(e.horizon); u.uSunCol.value.set(e.sunCol);
    u.uDeep.value.set(e.deep); u.uShallow.value.set(e.shallow); u.uCloud.value.set(e.cloud);
    u.uSun.value.set(...e.sun).normalize(); u.uFog.value.set(...e.fog); u.uCover.value = e.cover;
    u.uAmp.value = e.amp;
    this.hemi.color.set(e.zenith).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.set(e.deep).lerp(new THREE.Color(e.horizon), 0.3);
    this.hemi.intensity = e.hemi;
    this.sun.color.set(e.sunCol); this.sun.intensity = e.dir;
    this.scene.fog.color.set(e.horizon); this.scene.fog.near = e.fog[0]; this.scene.fog.far = e.fog[1];
  }

  coast(c, def) { this.islandGroup.add(coastMesh(c, def).mesh); }
  island(o, isl, seed) { this.islandGroup.add(makeIsland(o.r, isl.h, mulberry(seed), o.x, o.z, o.opts || {})); }
  islands(list) {
    this.islandGroup.clear();
    for (const o of list) this.islandGroup.add(makeIsland(o.r, o.h, mulberry(o.seed), o.x, o.z));
  }
  clearIslands() { this.islandGroup.clear(); }
  shoals(list, marked, draught = 0) {
    for (const m of this.shoalGroup.children) { if (m.geometry) m.geometry.dispose(); }
    this.shoalGroup.clear(); this.shoalRings = [];
    this.tex.foam.wrapS = this.tex.foam.wrapT = THREE.RepeatWrapping;
    for (const s of list) {
      const reef = s.depth < 2, m = new THREE.Mesh(bankGeometry(s), new THREE.MeshBasicMaterial({ vertexColors: true, color: reef ? 0xb8d8c0 : 0x9fe8d6, transparent: true, opacity: reef ? 0.75 : 0.6, depthWrite: false, depthTest: false, fog: false }));
      m.position.y = 0.9; m.renderOrder = 1; this.shoalGroup.add(m);
      const danger = marked && draught > s.depth;
      const r = new THREE.Mesh(edgeGeometry(s.shape.pts, 2, 3), new THREE.MeshBasicMaterial({ map: this.tex.foam, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, fog: false }));
      r.position.y = 1; r.renderOrder = 2; r.userData.ph = Math.random() * 6; this.shoalGroup.add(r); this.shoalRings.push(r);
      if (reef) {
        const rnd = mulberry(Math.round(s.x * 3 + s.z * 7)), mat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1, flatShading: true });
        const [x0, z0, x1, z1] = s.box, want = Math.round(Math.sqrt(s.area / Math.PI) / 6 * Math.max(1, Math.sqrt(s.area / Math.PI) / Math.max(4, s.inner) / 1.6));
        for (let i = 0, tries = 0; i < want && tries < want * 30; tries++) {
          const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
          if (s.at(x, z) < 2) continue;
          i++;
          const k = 1.5 + rnd() * 3, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(k, 0), mat);
          rock.position.set(x, -k * 0.35, z); rock.scale.y = 0.6; rock.rotation.y = rnd() * 6;
          this.shoalGroup.add(rock);
        }
      }
      if (marked) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(reef ? 'reef' : s.depth.toFixed(1), danger), transparent: true, depthTest: false, fog: false }));
        sp.position.set(s.x, 6, s.z); sp.scale.set(22, 22, 1); sp.renderOrder = 3; this.shoalGroup.add(sp);
      }
    }
  }
  updateFeatures(dt, focus) {
    const sea = this.sea;
    for (const r of this.shoalRings || []) r.material.opacity = 0.5 + 0.25 * Math.sin(sea.time * 1.7 + r.userData.ph);
    // current marks
    const pos = this.flowMesh.geometry.attributes.position, col = this.flowMesh.geometry.attributes.color;
    this.flowMesh.visible = !!sea.currentAt;
    if (!sea.currentAt) return;
    this.flow.forEach((m, i) => {
      m.life -= dt;
      if (m.life <= 0) {
        const a = Math.random() * 6.28, d = 15 + Math.random() * 260;
        m.x = focus.x + Math.sin(a) * d; m.z = focus.z + Math.cos(a) * d;
        const c = sea.currentAt(m.x, m.z); m.vx = c[0]; m.vz = c[1];
        m.max = m.life = Math.hypot(c[0], c[1]) > 0.4 ? 2.5 + Math.random() * 2 : 0.2 + Math.random();
      }
      m.x += m.vx * dt; m.z += m.vz * dt;
      const v = Math.hypot(m.vx, m.vz), len = 3 + v * 3.2, a = v > 0.4 ? Math.sin((m.life / m.max) * Math.PI) * Math.min(0.85, 0.3 + v * 0.15) : 0;
      const y = sea.height(m.x, m.z) + 0.35, ux = m.vx / (v || 1), uz = m.vz / (v || 1);
      pos.setXYZ(i * 2, m.x, y, m.z); pos.setXYZ(i * 2 + 1, m.x - ux * len, y, m.z - uz * len);
      col.setXYZW(i * 2, 0.92, 0.97, 1, a); col.setXYZW(i * 2 + 1, 0.92, 0.97, 1, 0);
    });
    pos.needsUpdate = col.needsUpdate = true;
  }
  // follow the sea's clock and waves, and keep the water and the sky centred on the camera
  update(dt, camPos) {
    this.u.uTime.value = this.sea.time;
    this.u.uAmp.value = this.sea.amp;
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
