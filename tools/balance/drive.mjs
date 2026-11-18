// Smoke-drives the built game in a headless page: node tools/balance/drive.mjs <script.mjs>
// The script default-exports async (page, shot) => {...}; shot(name) saves a screenshot.
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const [script, outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(pathToFileURL(path.join(here, '../../dist/index.html')).href);
await page.waitForTimeout(500);
const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });
await (await import(pathToFileURL(path.resolve(script)))).default(page, shot);
await browser.close();
