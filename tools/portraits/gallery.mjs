// A gallery of every character portrait at dialog and bubble sizes, for review.
//   node tools/portraits/gallery.mjs [--png]  -> out/portraits/index.html (and gallery.png with --png)
import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { CAST, portrait } from '../../src/portraits.js';
import { STORY } from '../../src/story.js';

const out = path.resolve('out/portraits');
mkdirSync(out, { recursive: true });
const SIDE = { crew: 'Your people', venice: 'Venice', ottoman: 'The Porte', pirate: 'Pirate' };
const ids = Object.keys(CAST);
const strip = (s) => s.replace(/<[^>]+>/g, '');

// a sample line for the mock dialog and bubble, taken from the game's own words where there is one
const SAMPLE = {
  manolis: [strip(STORY.choice.text[3]), 'Pilot: “Wind’s about to shift, veering.”'],
  marousa: [strip(STORY.m3.venice.brief.text[2]), 'Marousa: “If the wind fails, we are a fort.”'],
  barbaro: [strip(STORY.m1.venice.brief.text[1]), 'Barbaro, reloading: “Pick one. Any one.”'],
  ibrahim: [strip(STORY.m1.ottoman.brief.text[1]), 'İbrahim Reis: “They cannot run. Remember that neither can we.”'],
  piero: ['', 'The carpenter has opinions about what the last one did to his planking.'],
  kemal: ['', 'The carpenter has opinions about what the last one did to his planking.'],
  recruiter: ['', '“A captain who can fight a brig like that should not be carrying wine.”'],
  secretary: ['', '“Lychna is the Sultan’s island, after all.”'],
  morosini: ['', 'Morosini sends for you and says what the medal does not.'],
  vizier: ['', 'The Grand Vizier sends a robe of honour.'],
  mags: ['', '“Strike your colours, Lychna.”'],
  daughter: ['', strip(STORY.legs['Among the islets'].both)],
  varga: ['', strip(STORY.legs['A lee shore'].both)],
  yusra: ['', strip(STORY.legs['The careenage'].both)],
  thorne: ['', 'Thorne’s men are ashore in the village.'],
  korrigan: ['', strip(STORY.legs['False colours'].both)],
  kastor: ['', strip(STORY.legs['The brothers'].both)],
  polydeukes: ['', strip(STORY.legs['The brothers'].both)],
};

const card = (id) => {
  const c = CAST[id], [long, short] = SAMPLE[id] || [c.where, c.where];
  return `<section class="card ${c.side}">
  <div class="big">${portrait(id)}</div>
  <div class="info"><h2>${c.name}</h2><div class="role">${c.role} · <span>${SIDE[c.side]}</span></div><p class="where">${c.where}</p>
    <div class="sizes"><figure>${portrait(id, { small: true })}<figcaption>64</figcaption></figure><figure class="s40">${portrait(id, { small: true })}<figcaption>40</figcaption></figure><figure class="s28">${portrait(id, { small: true })}<figcaption>28</figcaption></figure></div>
    <div class="bubble"><div class="face">${portrait(id, { small: true })}</div><span>${short}</span></div>
  </div></section>`;
};
const strip2 = ids.map((id) => `<div class="mini" title="${CAST[id].name}">${portrait(id, { small: true })}</div>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadside: character portraits</title>
<style>
body{margin:0;background:#0a1826;color:#f3ead2;font-family:'IM Fell English',Georgia,serif;padding:24px}
h1{font-family:'Pirata One',Georgia,serif;font-weight:400;color:#d7b25a;margin:0 0 4px;font-size:34px}
.lede{max-width:760px;opacity:.85;margin:0 0 18px;line-height:1.4}
.lineup{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 24px;padding:12px;background:rgba(9,18,30,.74);border:1px solid rgba(215,178,90,.5);border-radius:10px}
.mini svg{width:48px;height:48px;border-radius:50%;border:2px solid rgba(215,178,90,.7);display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:18px}
.card{display:flex;gap:16px;background:rgba(9,18,30,.74);border:1px solid rgba(215,178,90,.5);border-radius:12px;padding:14px}
.big svg{width:220px;height:220px;border-radius:8px;border:2px solid #d7b25a;display:block}
.info{flex:1;min-width:0}
h2{margin:0;font-family:'Pirata One',Georgia,serif;font-weight:400;font-size:26px;color:#f3ead2}
.role{color:#d7b25a;font-size:15px}.role span{opacity:.75}
.where{font-size:14px;opacity:.8;margin:6px 0 10px}
.sizes{display:flex;align-items:flex-end;gap:12px;margin-bottom:12px}
.sizes figure{margin:0;text-align:center;font-size:11px;opacity:.9}
.sizes svg{width:64px;height:64px;border-radius:50%;border:2px solid rgba(215,178,90,.8);display:block}
.sizes .s40 svg{width:40px;height:40px}.sizes .s28 svg{width:28px;height:28px;border-width:1.5px}
.hook{max-width:900px;margin:0 0 22px;line-height:1.4;font-size:15px}.hook h3{font-family:'Pirata One',Georgia,serif;font-weight:400;color:#d7b25a;font-size:22px;margin:0}.hook code{font-size:13px;color:#e8d9a8}
.bubble{display:flex;align-items:center;gap:10px;background:rgba(9,18,30,.9);border:1px solid rgba(215,178,90,.5);border-radius:28px;padding:5px 14px 5px 5px;font-size:15px;max-width:360px}
.bubble .face svg{width:44px;height:44px;border-radius:50%;border:2px solid #d7b25a;display:block}
</style></head><body>
<h1>Character portraits</h1>
<p class="lede">Drawn in code (src/portraits.js), flat-shaded like the ships. Each one at dialog size, at three bubble sizes, and in a mock in-game bubble. Background: sea blue for your own people (anyone who can sail as your officer), crimson for the Venetians and green for the Ottomans who give you orders, one shared smoke-brown for every pirate.</p>
<div class="lineup">${strip2}</div>
<div class="hook"><h3>How they hook in</h3>
<p><b>In game, now:</b> any line that starts with a speaker's name (<i>Manolis: “…”</i>, <i>Pilot:</i>, <i>Barbaro</i>, <i>İbrahim Reis</i>, <i>Marousa</i>) shows that face in its bubble. <code>speakerOf(text)</code> in src/portraits.js picks the face, so new lines in src/missions.js need nothing extra.</p>
<p><b>Dialog, later:</b> a briefing becomes a list of steps like <code>{ who: 'barbaro', text: '…' }</code> in src/story.js. Narration steps leave out <code>who</code>. The dialog shows <code>portrait(who)</code> large beside the text, and the name and role come from <code>CAST[who]</code>.</p></div>
<div class="grid">${ids.map(card).join('')}</div>
</body></html>`;
writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote', path.join(out, 'index.html'));

if (process.argv.includes('--png')) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await p.screenshot({ path: path.join(out, 'gallery.png'), fullPage: true });
  await b.close(); console.log('wrote', path.join(out, 'gallery.png'));
}
