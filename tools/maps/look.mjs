// Screenshots of campaign maps, for designing and checking them. Build the game first.
//   node tools/maps/look.mjs <outDir> <mission>:<leg>:<side>[,...] [width]x[height]
// e.g. node tools/maps/look.mjs /tmp/maps m4:0:venice,m5:0:ottoman 1280x720
// For each leg it saves <name>-chart.png (straight down on the whole map, fog off) and
// <name>-deck.png (the game's own camera a few seconds into the fight).
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const [outDir = '.', list = 'm4:0:venice', size = '1280x720', hull = 'brig'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: W < 1000, isMobile: W < 1000 });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(pathToFileURL(path.join(here, '../../dist/index.html')).href);
await page.waitForTimeout(800);
for (const item of list.split(',')) {
  const [mission, leg, side, view] = item.split(':');
  const name = `${mission}-${leg}-${side}${view ? '-' + view : ''}`;
  await page.evaluate(({ mission, leg, side, hull }) => {
    const C = G.CAMP, st = (C.st = C.fresh());
    G.mode = 'campaign'; st.side = side === 'null' ? null : side; st.stage = C.order.indexOf(mission);
    st.officers = ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, Math.max(0, st.stage));
    st.stable = [{ id: 'h1', hull, name: 'Test', fit: {} }]; G.ship = 'h1'; G.fit = {}; C.rebuild(); C.man();
    C.startMission();
    const run = C.run;
    if (isNaN(+leg)) { run.legs = [C.pool[leg]]; run.i = 0; } else run.i = +leg;
    if (isNaN(+leg) || run.i) C.startLeg();
    G.api.act('engage'); G.paused = false;
  }, { mission, leg, side, hull });
  await page.waitForTimeout(300);
  await page.evaluate(() => G.step(0.05, 60));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, name + '-deck.png') });
  // straight down on the whole chart
  await page.evaluate(() => {
    G.paused = true;
    const { renderer, scene, camera } = G.view, f = scene.fog, u = G.world.u.uFog.value, keep = [f.near, f.far, camera.fov, camera.far, u.x, u.y];
    document.body.classList.add('chartshot');
    if (!document.getElementById('chartcss')) { const st = document.createElement('style'); st.id = 'chartcss'; st.textContent = 'body.chartshot > *:not(canvas){visibility:hidden !important}'; document.head.appendChild(st); }
    u.set(1e5, 2e5);
    f.near = 1e5; f.far = 2e5; camera.fov = 60; camera.far = 20000; camera.updateProjectionMatrix();
    camera.position.set(0, 1080 / Math.tan(Math.PI / 6), 1); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    G.world.update(0, { x: 0, y: 0, z: 0 });
    G.world.near.material.uniforms.uNear.value = 0;
    renderer.render(scene, camera);
    window.__restore = () => { [f.near, f.far, camera.fov, camera.far] = keep; u.set(keep[4], keep[5]); document.body.classList.remove('chartshot'); camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); G.world.near.material.uniforms.uNear.value = 1; };
  });
  await page.screenshot({ path: path.join(outDir, name + '-chart.png') });
  await page.evaluate(() => window.__restore());
  // VIEWS='[[camx,camy,camz,lookx,looky,lookz],...]' adds <name>-view<i>.png from fixed cameras
  for (const [i, v] of JSON.parse(process.env.VIEWS || '[]').entries()) {
    await page.evaluate((v) => {
      const { renderer, scene, camera } = G.view;
      camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]); camera.updateMatrixWorld();
      G.world.update(0, camera.position); renderer.render(scene, camera);
      document.body.classList.add('chartshot');
    }, v);
    await page.screenshot({ path: path.join(outDir, `${name}-view${i}.png`) });
    await page.evaluate(() => document.body.classList.remove('chartshot'));
  }
  await page.evaluate(() => { G.paused = false; G.state = 'story'; });
  console.log('saved', name);
}
await browser.close();
