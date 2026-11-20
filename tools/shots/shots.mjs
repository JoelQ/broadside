// Screenshots of the built game at desktop and phone sizes, for checking looks and layout.
//   node tools/shots/shots.mjs [scene-regex] [--out dir] [--sizes desktop,phone,portrait]
// Scenes: the title, the campaign's first story screen, the two home ports, and the opening of every campaign leg (from the balance grid).
// Writes <out>/<size>/<scene>.png and <out>/index.html with them side by side. Exits 1 on any page error.
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import { LEGS } from '../balance/legs.mjs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const filter = args.find((a, i) => !a.startsWith('--') && !['--out', '--sizes'].includes(args[i - 1]));
const out = path.resolve(opt('out', 'out/shots')), re = filter ? new RegExp(filter, 'i') : null;
const page0 = pathToFileURL(path.join(here, '../../dist/index.html')).href, harness = readFileSync(path.join(here, '../balance/harness.js'), 'utf8');

const se = devices['iPhone SE'];
const SIZES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { ...se, viewport: { width: se.viewport.height, height: se.viewport.width } }, // held sideways
  portrait: { ...se }, // should ask to turn the phone
};
const sizes = opt('sizes', 'desktop,phone,portrait').split(',');

const act = (page, a) => page.evaluate((a) => G.api.act(a), a);
const SCENES = [
  { name: 'title', run: async () => {} },
  { name: 'prologue', run: async (page) => { await page.evaluate(() => localStorage.clear()); await act(page, 'camp:new'); } },
  // each side's home port (homes.js), with a few ships at their moorings
  ...[['port-suda', 'venice'], ['port-chania', 'ottoman']].map(([name, side]) => ({ name, run: async (page) => {
    await page.evaluate((side) => {
      const C = G.CAMP; G.mode = 'campaign'; const st = (C.st = C.fresh()); st.side = side; st.stage = 2;
      st.stable = ['brig', 'sloop', 'xebec', 'galley'].map((hull, i) => ({ id: 's' + (i + 1), hull, name: hull, fit: {} }));
      C.rebuild(); G.api.showPort(); G.api.snapCamera();
    }, side);
  } })),
  ...LEGS.map((L) => ({
    name: L.name.replace(/[^\w]+/g, '-').toLowerCase(),
    run: async (page) => {
      await page.addScriptTag({ content: harness });
      await page.evaluate((cfg) => { H.setupLeg({ ...cfg, hull: 'brig', seed: 1 }); G.fast = false; G.paused = false; G.bot = null; }, { mission: L.mission, leg: L.leg, side: L.side, carry: L.carry });
    },
  })),
].filter((s) => !re || re.test(s.name));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let errors = 0;
for (const size of sizes) {
  mkdirSync(path.join(out, size), { recursive: true });
  const ctx = await browser.newContext(SIZES[size]);
  for (const sc of SCENES) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors++; console.error(`PAGE ERROR [${size} ${sc.name}]`, e.message); });
    await page.goto(page0);
    await page.waitForTimeout(500);
    await sc.run(page);
    await page.waitForTimeout(1200); // let it draw, and the camera settle
    await page.screenshot({ path: path.join(out, size, sc.name + '.png') });
    await page.close();
    console.log(`${size.padEnd(8)} ${sc.name}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Broadside screenshots</title>
<style>body{background:#111;color:#ccc;font:13px system-ui;margin:12px}section{display:flex;gap:10px;align-items:flex-start;margin-bottom:18px}img{max-height:300px;border:1px solid #333}h3{margin:6px 0}</style>
${SCENES.map((s) => `<h3>${s.name}</h3><section>${sizes.map((z) => `<img src="${z}/${s.name}.png" title="${z}">`).join('')}</section>`).join('\n')}`);
console.log(`${SCENES.length} scenes x ${sizes.length} sizes in ${path.relative(process.cwd(), out)}/, ${errors} page errors`);
process.exit(errors ? 1 : 0);
