// Draws and checks the campaign maps without running the game.
//   node tools/map/map.mjs [leg-regex] [--out dir] [--png] [--json] [--seed n] [--quiet]
// Writes <out>/<leg>.svg for every leg whose name matches ("m1V The run", "m4", "strait"), plus
// <out>/index.html with all of them; --png also writes PNGs and a contact sheet (needs Playwright).
// Prints what the checker found; exits 1 if anything is an error. --json prints the findings as JSON.
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { scenes } from './scenes.mjs';
import { check } from './check.mjs';
import { svg } from './svg.mjs';

const args = process.argv.slice(2), flag = (n) => args.includes('--' + n), opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const valued = new Set(['--out', '--seed']);
const filter = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const out = path.resolve(opt('out', 'out/maps')), seed = +opt('seed', 1);
const slug = (n) => n.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const list = scenes(filter, seed);
if (!list.length) { console.error(`no leg matches "${filter}"`); process.exit(2); }
mkdirSync(out, { recursive: true });
const report = [];
for (const sc of list) {
  const found = check(sc), file = slug(sc.name);
  writeFileSync(path.join(out, file + '.svg'), svg(sc, found));
  report.push({ leg: sc.name, title: sc.title, file: path.join(out, file + '.svg'), findings: found });
}
// index.html: every leg on one page to scan, each map scaled to the same tile; click one to see it full width, again to put it back.
// The maps are inlined, so the page stands on its own (it can be shared as it is).
const tile = (r) => {
  const bad = r.findings.filter((x) => x.level !== 'note');
  return `<figure><div class="map">${readFileSync(r.file, 'utf8').replace(/^<svg /, '<svg preserveAspectRatio="xMidYMid meet" ')}</div><figcaption><b>${r.leg}</b> · ${r.title}${bad.map((x) => `<div class="${x.level}">${x.level}: ${x.msg.replace(/</g, '&lt;')}</div>`).join('')}</figcaption></figure>`;
};
writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadside maps</title>
<style>body{background:#0d2433;color:#cde;font:13px system-ui,sans-serif;margin:12px}h1{font-size:16px;margin:0 0 10px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
figure{margin:0;background:#0a1c28;border-radius:6px;overflow:hidden}figure .map{height:380px;cursor:zoom-in}figure.big{grid-column:1/-1}figure.big .map{height:auto;cursor:zoom-out}figure svg{width:100%;height:100%;display:block;overflow:hidden}
figcaption{padding:6px 8px}.error{color:#ff6b5e}.warn{color:#ffcc00}</style>
<h1>Broadside maps · ${report.length} legs · ${report.reduce((n, r) => n + r.findings.filter((x) => x.level === 'error').length, 0)} errors</h1>
<main>${report.map(tile).join('\n')}</main>
<script>document.querySelectorAll('figure .map').forEach((m) => m.onclick = () => { m.parentNode.classList.toggle('big'); m.scrollIntoView({ block: 'nearest' }); });</script>`);

if (flag('png')) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch(), page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const r of report) {
    await page.goto(pathToFileURL(r.file).href);
    await page.locator('svg').screenshot({ path: (r.png = r.file.replace(/\.svg$/, '.png')) });
  }
  await page.setViewportSize({ width: 1640, height: 900 }); // five maps across
  await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await page.screenshot({ path: path.join(out, 'contact.png'), fullPage: true });
  await browser.close();
}

const errors = report.reduce((n, r) => n + r.findings.filter((x) => x.level === 'error').length, 0);
if (flag('json')) console.log(JSON.stringify({ out, errors, legs: report }, null, 2));
else {
  for (const r of report) {
    const shown = r.findings.filter((x) => !flag('quiet') || x.level !== 'note');
    console.log(`${r.leg}${shown.length ? '' : '  ok'}`);
    for (const x of shown) console.log(`  ${x.level.padEnd(5)} ${x.msg}`);
  }
  console.log(`\n${report.length} legs, ${errors} errors · maps in ${path.relative(process.cwd(), out) || '.'}/${flag('png') ? ' (svg, png, contact.png)' : ''}`);
}
process.exit(errors ? 1 : 0);
