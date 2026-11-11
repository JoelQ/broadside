import * as THREE from 'three';

const P_VS = `
attribute vec4 aColor; attribute float aSize;
uniform float uScale;
varying vec4 vColor;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix*vec4(position, 1.);
  gl_PointSize = aSize*uScale/max(-mv.z, 0.1);
  gl_Position = projectionMatrix*mv;
}`;
const P_FS = `
varying vec4 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d)*vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max; this.next = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max); this.grav = new Float32Array(max);
    this.drag = new Float32Array(max); this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uScale = { value: 600 };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: P_VS, fragmentShader: P_FS, uniforms: { uScale: this.uScale },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, a, size, life, grow = 0, grav = 0, drag = 0) {
    const i = this.next; this.next = (i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.a0[i] = a; this.size[i] = size; this.life[i] = this.maxLife[i] = life;
    this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, col, size, life, maxLife, grow, grav, drag, a0 } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const k = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= k; vel[i * 3 + 2] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] += grow[i] * dt;
      const t = life[i] / maxLife[i];
      col[i * 4 + 3] = a0[i] * Math.min(1, t * 2.2);
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = g.aColor.needsUpdate = g.aSize.needsUpdate = true;
  }
}

const R = (a = 1) => (Math.random() - 0.5) * 2 * a;

export class FX {
  constructor(scene) {
    this.soft = new Pool(scene, 5000, false);
    this.glow = new Pool(scene, 1500, true);
  }
  setScale(s) { this.soft.uScale.value = s; this.glow.uScale.value = s; }
  update(dt) { this.soft.update(dt); this.glow.update(dt); }

  cannon(p, dx, dz) {
    for (let i = 0; i < 9; i++) {
      const s = 5 + Math.random() * 14, g = 0.75 + Math.random() * 0.2;
      this.soft.spawn(p.x + dx * 1.5, p.y + R(0.3), p.z + dz * 1.5, dx * s + R(2), 1 + Math.random() * 2, dz * s + R(2), g, g, g, 0.42, 1.6 + Math.random() * 1.2, 2.2 + Math.random() * 1.8, 2.2, -0.3, 1.6);
    }
    this.glow.spawn(p.x + dx * 1.2, p.y, p.z + dz * 1.2, dx * 6, 0, dz * 6, 1, 0.75, 0.3, 1, 5, 0.12, 20);
    for (let i = 0; i < 4; i++) this.glow.spawn(p.x + dx, p.y, p.z + dz, dx * (20 + R(8)) + R(4), R(4), dz * (20 + R(8)) + R(4), 1, 0.6, 0.2, 1, 0.7, 0.25, 0, 6);
  }
  splash(p, big = 1) {
    for (let i = 0; i < 14 * big; i++) {
      this.soft.spawn(p.x + R(0.6), p.y, p.z + R(0.6), R(3.2), 7 + Math.random() * 9 * big, R(3.2), 0.92, 0.97, 1, 0.8, 1.1 + Math.random() * 1.2, 1.1 + Math.random() * 0.6, 1, 20, 0.2);
    }
    this.soft.spawn(p.x, p.y + 0.2, p.z, 0, 0.2, 0, 1, 1, 1, 0.5, 2.5, 1.8, 4);
  }
  wood(p, n = 10) {
    for (let i = 0; i < n; i++) {
      const c = 0.35 + Math.random() * 0.3;
      this.soft.spawn(p.x, p.y, p.z, R(9), 3 + Math.random() * 9, R(9), c, c * 0.72, c * 0.42, 1, 0.45 + Math.random() * 0.5, 1 + Math.random() * 0.7, 0, 24, 0.3);
    }
    for (let i = 0; i < 4; i++) this.soft.spawn(p.x, p.y, p.z, R(2), 1 + Math.random(), R(2), 0.3, 0.27, 0.24, 0.5, 2.5, 1.6, 3, -0.5, 1);
    this.glow.spawn(p.x, p.y, p.z, 0, 0, 0, 1, 0.7, 0.35, 0.9, 4, 0.1, 10);
  }
  canvas(p, col) {
    for (let i = 0; i < 9; i++) this.soft.spawn(p.x, p.y, p.z, R(6), R(4), R(6), col.r, col.g, col.b, 0.95, 0.7 + Math.random() * 0.6, 1.4 + Math.random(), 0, 5, 1.2);
  }
  grape(p) {
    for (let i = 0; i < 8; i++) this.soft.spawn(p.x + R(2), p.y + R(1), p.z + R(2), R(4), 2 + Math.random() * 4, R(4), 0.6, 0.12, 0.1, 0.85, 0.5, 0.6 + Math.random() * 0.4, 0, 14);
    this.soft.spawn(p.x, p.y, p.z, 0, 1, 0, 0.5, 0.45, 0.4, 0.45, 2.5, 1.2, 3);
  }
  flame(x, y, z) {
    this.glow.spawn(x + R(0.8), y, z + R(0.8), R(0.8), 3 + Math.random() * 3, R(0.8), 1, 0.3 + Math.random() * 0.3, 0.06, 0.7, 1.5 + Math.random() * 1.1, 0.5 + Math.random() * 0.4, -1.5);
  }
  smoke(x, y, z, dark = 0.2, wx = 0, wz = 0) {
    const c = dark + Math.random() * 0.1;
    this.soft.spawn(x + R(0.6), y, z + R(0.6), wx + R(0.6), 3.5 + Math.random() * 2, wz + R(0.6), c, c, c, 0.5, 2.5, 3.5 + Math.random() * 2, 2.6, 0, 0.1);
  }
  foam(x, y, z, vx, vz, size = 2.2, life = 2.6) {
    this.soft.spawn(x, y, z, vx, 0, vz, 0.93, 0.97, 0.98, 0.42, size, life, 1.3, 0, 0.8);
  }
  trail(p, r, g, b, glow) {
    (glow ? this.glow : this.soft).spawn(p.x, p.y, p.z, 0, 0.3, 0, r, g, b, glow ? 0.7 : 0.35, glow ? 1.4 : 0.9, glow ? 0.35 : 0.5, 0.8);
  }
  musket(x, y, z) {
    this.soft.spawn(x, y, z, R(2), 1 + Math.random(), R(2), 0.85, 0.85, 0.85, 0.5, 1.2, 1.4, 2.2, -0.2, 1);
    this.glow.spawn(x, y, z, 0, 0, 0, 1, 0.8, 0.4, 0.9, 1.5, 0.08, 8);
  }
}

// ---------- synthesized audio ----------
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ambient();
    } catch (e) { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; return this.muted; }
  noise(dur, type, f0, f1, vol, q = 1, when = 0) {
    const c = this.ctx; if (!c || vol <= 0.003) return;
    const t = c.currentTime + when;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(fl); fl.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  tone(dur, wave, f0, f1, vol, when = 0) {
    const c = this.ctx; if (!c || vol <= 0.003) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = wave;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  cannon(v = 1) {
    this.noise(0.9 + Math.random() * 0.4, 'lowpass', 1500 + Math.random() * 900, 70, 0.9 * v);
    this.tone(0.45, 'sine', 95 + Math.random() * 30, 32, 0.9 * v);
  }
  splash(v = 1) { this.noise(0.5, 'bandpass', 2400, 500, 0.22 * v, 0.7); }
  thud(v = 1) { this.noise(0.22, 'lowpass', 2600, 200, 0.6 * v); this.tone(0.2, 'triangle', 170, 55, 0.5 * v); }
  rip(v = 1) { this.noise(0.35, 'highpass', 900, 3200, 0.25 * v); }
  clang() { const f = 1400 + Math.random() * 1500; this.tone(0.28, 'square', f, f * 0.97, 0.05); this.tone(0.2, 'sine', f * 1.5, f * 1.45, 0.07); }
  musket() { this.noise(0.18, 'bandpass', 1800, 500, 0.35, 0.8); }
  ui() { this.tone(0.07, 'triangle', 660, 520, 0.12); }
  coin() { this.tone(0.12, 'sine', 1320, 1320, 0.1); this.tone(0.25, 'sine', 1760, 1760, 0.1, 0.08); }
  horn(win) {
    const n = win ? [392, 494, 587, 784] : [330, 294, 262, 196];
    n.forEach((fq, i) => { this.tone(0.5, 'sawtooth', fq, fq, 0.07, i * 0.22); this.tone(0.5, 'triangle', fq / 2, fq / 2, 0.1, i * 0.22); });
  }
  creak() { this.tone(0.3, 'sawtooth', 70 + Math.random() * 30, 55, 0.05); }
  ambient() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.11;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
    const lg = c.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(fl); fl.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }
}
