// The story told one step at a time: a page's `text` is a list of steps, each a line of narration (a string) or
// a line someone says ({ who, text }, an empty string a step that only carries the page's end; `who` a key of CAST in portraits.js). A step with a speaker shows their
// portrait and name beside it. Click, tap, Space or Enter goes on; Back or the left arrow goes back; Skip or
// Escape jumps to the last step, which carries the page's buttons and anything else it ends with.
import { portrait, CAST } from './portraits.js';

let D = null; // the page being told: { page, steps, i, end }

const steps = (page) => (page.text || []).map((t) => (typeof t === 'string' ? { text: t } : t));

// page: { eyebrow, title, text }. end: the HTML that closes the last step (notes, the page's buttons).
export function tellSteps(page, end, show) {
  D = { page, steps: steps(page), i: 0, end, show };
  if (!D.steps.length) D.steps = [{ text: '' }];
  render();
}

function render() {
  if (D.page.onStep) D.page.onStep(D.i); // the scene behind can follow the story, step by step
  const { page, steps: S, i, end } = D, s = S[i], c = CAST[s.who], last = i === S.length - 1;
  const dots = S.length > 1 ? `<span class="dlg-dots">${S.map((_, j) => `<i class="${j === i ? 'on' : j < i ? 'seen' : ''}"></i>`).join('')}</span>` : '';
  // going on is the usual thing to do, so it is the one big button; back and skip are quiet links beside the dots
  const nav = `<div class="dlg-nav"><span class="dlg-aux">${dots}${i ? '<button class="dlg-link" data-act="camp:dlg:back">‹ Back</button>' : ''}${last ? '' : '<button class="dlg-link" data-act="camp:dlg:skip">Skip</button>'}</span>${last ? '' : '<button class="btn big dlg-next" data-act="camp:dlg:next">Next ›</button>'}</div>`;
  D.show(`<div class="dlg${c ? ' speaks' : ''}"${last ? '' : ' data-act="camp:dlg:next"'}>
    <div class="dlg-title"><div class="eyebrow">${page.eyebrow || ''}</div><h2>${page.title || ''}</h2></div>
    <div class="dlg-row">${c ? `<figure class="dlg-face">${portrait(s.who)}</figure>` : '<div class="dlg-face none"></div>'}
      <div class="dlg-box">${c ? `<div class="dlg-name">${c.name}<small>${c.role}</small></div>` : ''}${s.text ? `<p>${s.text}</p>` : ''}
        ${last ? `<div class="dlg-end story">${end}</div>` : ''}${nav}</div></div></div>`, 'dlgscr');
}

const showing = () => D && document.querySelector('#screen.dlgscr .dlg');
export function dialogAct(k) {
  if (!showing()) return;
  if (k === 'next' && D.i < D.steps.length - 1) D.i++;
  else if (k === 'back' && D.i > 0) D.i--;
  else if (k === 'skip') D.i = D.steps.length - 1;
  else return;
  render();
}
// keys while a page is being told; true if the key was used
export function dialogKey(k) {
  if (!showing()) return false;
  if (k === ' ' || k === 'enter' || k === 'arrowright') {
    if (D.i < D.steps.length - 1) { dialogAct('next'); return true; }
    const btns = document.querySelectorAll('#screen .dlg-end .btn.big');
    if (btns.length === 1) { btns[0].click(); return true; } // one way on: Enter takes it
    return false;
  }
  if (k === 'arrowleft' || k === 'backspace') { dialogAct('back'); return true; }
  if (k === 'escape') { dialogAct('skip'); return true; }
  return false;
}
