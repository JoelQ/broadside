// Plays one cell of legs.mjs and prints where everything was every few seconds.
//   LEGS='m1V The patrol' HULLS=sloop ROUTES=shoals node tools/balance/trace.mjs [seconds-between-lines]
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const cells = (await import('./legs.mjs')).default, every = +process.argv[2] || 10;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message, e.stack));
await page.goto(pathToFileURL(path.join(here, '../../dist/index.html')).href);
await page.waitForTimeout(600);
await page.addScriptTag({ content: readFileSync(path.join(here, 'harness.js'), 'utf8') });
for (const c of cells.slice(0, 3)) {
  const r = await page.evaluate((cfg) => H.leg(cfg), JSON.parse(JSON.stringify({ ...c, trace: every })));
  console.log(`== ${c.label}: ${r.o} at ${r.t}s`);
  console.log(r.trace.join('\n'));
}
await browser.close();
