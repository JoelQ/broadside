// A test build that opens straight onto any fight set in a rebuilt place, for playtesting maps on a phone.
//   npm run build && node tools/maps/preview.mjs   -> dist/preview.html
// It is the normal build with a menu added to the title screen; nothing in src/ changes.
import { readFileSync, writeFileSync } from 'fs';
const FIGHTS = [
  ['The Dardanelles', [['Up the strait', 'venice', 'm4', 0], ['Down the strait', 'ottoman', 'm4', 0]]],
  ['Candia', [['The mole (assault)', 'ottoman', 'm5', 0], ['The sortie (defence)', 'venice', 'm5', 0], ['The harbour (assault)', 'ottoman', 'm5', 1], ['The harbour (defence)', 'venice', 'm5', 1], ['The flagship (assault)', 'ottoman', 'm5', 2], ['The flagship (defence)', 'venice', 'm5', 2]]],
];
const HULLS = ['sloop', 'brig', 'xebec', 'merchantman', 'galley', 'flagship'];
const panel = `<style>
#mp{position:fixed;left:10px;top:10px;z-index:99;font:14px Georgia,serif;color:#f6ecc8}
#mp>button{background:#7a2a22;color:#fff;border:0;border-radius:8px;padding:8px 12px;font:inherit}
#mp .box{display:none;margin-top:6px;background:rgba(20,24,30,.94);border-radius:10px;padding:10px 12px;max-height:80vh;overflow:auto;width:min(92vw,420px)}
#mp.open .box{display:block}#mp h4{margin:8px 0 4px;font-size:13px;opacity:.75}
#mp .row{display:flex;flex-wrap:wrap;gap:6px}#mp .row button{background:#33404d;color:#f6ecc8;border:0;border-radius:6px;padding:7px 9px;font:inherit;font-size:13px}
#mp .row button.on{background:#c9a24a;color:#111}</style>
<div id="mp"><button id="mpb">Map test</button><div class="box"><h4>Your ship</h4><div class="row" id="mph"></div>
${FIGHTS.map(([place, legs]) => `<h4>${place}</h4><div class="row">${legs.map(([t, s, m, l]) => `<button data-s="${s}" data-m="${m}" data-l="${l}">${t}</button>`).join('')}</div>`).join('')}</div></div>
<script>
(() => {
  const mp = document.getElementById('mp'); let hull = 'brig';
  const hb = document.getElementById('mph');
  hb.innerHTML = ${JSON.stringify(HULLS)}.map((h) => '<button data-h="' + h + '"' + (h === 'brig' ? ' class="on"' : '') + '>' + h + '</button>').join('');
  setInterval(() => { mp.style.display = ['battle', 'boarding', 'intro', 'ending'].includes(G.state) ? 'none' : ''; }, 400);
  document.getElementById('mpb').onclick = () => mp.classList.toggle('open');
  hb.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; hull = b.dataset.h; hb.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  mp.querySelector('.box').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-m]'); if (!b) return;
    const C = G.CAMP, st = (C.st = C.fresh());
    G.mode = 'campaign'; G.paused = false; st.side = b.dataset.s; st.stage = C.order.indexOf(b.dataset.m);
    st.officers = ['pilot', 'carpenter', 'gunner', 'marines'].slice(0, st.stage); st.gold = 500;
    st.stable = [{ id: 'h1', hull, name: 'Test', fit: {} }]; G.ship = 'h1'; G.fit = {}; C.rebuild(); C.man();
    G.player.stock = { chain: 8, grape: 8, fire: 5 };
    C.startMission(); const run = C.run, l = +b.dataset.l;
    if (l) { run.i = l; C.startLeg(); }
    mp.classList.remove('open');
  });
})();
</script>`;
const html = readFileSync('dist/index.html', 'utf8').replace('</body>', () => panel + '</body>');
writeFileSync('dist/preview.html', html);
console.log('wrote dist/preview.html', (html.length / 1024).toFixed(0) + ' KB');
