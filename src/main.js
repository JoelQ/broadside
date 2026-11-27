import { start } from './game.js';
import { VIEW } from './view.js';
import { PT } from './playtest.js';

// The game in the browser: the rules (game.js) drawn by the view (view.js), one tick of each per frame.
const G = start(VIEW);
window.G = G;
if (__PLAYTEST__) { PT.install(G, G.api, G.CAMP); G.rec = PT; G.api.showTitle(); }
G.api.snapCamera();
const { renderer, scene, camera, frame } = G.view;
const tick = (dt) => { G.api.update(dt); frame(dt); };
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!G.paused) tick(dt);
  if (__PLAYTEST__) for (let i = 1; i < G.ptSpeed && !G.paused; i++) tick(dt); // playtest: time runs faster
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
// tools: G.step plays and draws (screenshots); G.tick, from game.js, plays without drawing
G.step = (dt, n = 1) => { for (let i = 0; i < n; i++) tick(dt); renderer.render(scene, camera); };
requestAnimationFrame(loop);
