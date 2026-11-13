// Walks the whole campaign for one side, winning every fight by decree, to check that the story
// flow, pauses, prizes, saves and port all hold together.   node tools/balance/drive.mjs tools/balance/flow.mjs [shots dir]
export default async (page, shot) => {
  for (const side of ['venice', 'ottoman']) {
    const log = [];
    const act = (a) => page.evaluate((a) => G.api.act(a), a);
    const state = () => page.evaluate(() => ({ s: G.state, run: G.CAMP.run && G.CAMP.run.key + ':' + G.CAMP.run.i, stage: G.CAMP.st.stage, gold: G.gold, ship: G.player.spec.name, crew: Math.round(G.player.crew), stable: G.CAMP.st.stable.map((x) => x.hull).join(','), off: G.CAMP.st.officers.join(','), btn: [...document.querySelectorAll('#screen:not(.hidden) [data-act]')].map((b) => b.dataset.act) }));
    await page.evaluate(() => localStorage.clear());
    await act('camp:new');
    let guard = 0, legs = 0, shifted = false;
    while (guard++ < 200) {
      const st = await state();
      if (st.s === 'intro') {
        await act('engage');
        await page.evaluate(() => { G.coach = null; G.tick(0.05, 100); });
        // take a prize now and then, so the pause has something to offer
        await page.evaluate(() => { const f = G.ships.find((s) => s.side === 1 && !s.spec.fixed && !s.out); if (f) G.api.shipOut(f, 'captured'); G.player.hull *= 0.6; G.player.crew *= 0.8; G.api.endBattle('won'); G.tick(0.05, 120); });
        legs++; continue;
      }
      if (st.s === 'port') { log.push(`port stage ${st.stage} gold ${st.gold} ship ${st.ship} crew ${st.crew} stable ${st.stable} officers ${st.off}`); if (st.stage === 3) await shot(side + '-port'); await act('sail'); continue; }
      const b = st.btn;
      if (!b.length) { log.push('STUCK ' + JSON.stringify(st)); break; }
      if (b.includes('camp:title')) { log.push(`ending reached after ${legs} legs`); await shot(side + '-ending'); await act('camp:title'); break; }
      if (b.some((x) => x.startsWith('camp:side:'))) { await act('camp:side:' + side); continue; }
      if (b.includes('camp:next')) {
        const flag = b.find((x) => x.startsWith('camp:flag:'));
        if (flag && !shifted) { shifted = true; await shot(side + '-pause'); await act(flag); log.push('shifted flag: ' + (await state()).ship); await shot(side + '-pause2'); }
        for (const w of b.filter((x) => x.startsWith('camp:w:'))) await act(w);
        await act('camp:next'); continue;
      }
      await act(['camp:go', 'camp:ending', 'camp:port'].find((x) => b.includes(x)) || b[0]);
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('broadside.campaign.v1')));
    console.log(`== ${side}: ${legs} legs, done=${saved && saved.done}\n` + log.join('\n'));
  }
  // a reload must offer to continue
  await page.reload(); await page.waitForTimeout(500);
  console.log('title after reload:', await page.evaluate(() => document.getElementById('screen').innerText.replace(/\n+/g, ' | ')));
};
