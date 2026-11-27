// Every module an entry point loads, followed through `import ... from`. `node tools/sim/deps.mjs src/game.js`
// lists them and fails if any is drawing code: three.js, or a module that touches the page (document, window).
import { readFileSync } from 'fs';
import path from 'path';

export function deps(entry) {
  const seen = new Map(), todo = [path.resolve(entry)];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    const src = readFileSync(f, 'utf8'), out = [];
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)) out.push(m[1]);
    seen.set(f, { src, imports: out });
    for (const s of out) if (s.startsWith('.')) todo.push(path.resolve(path.dirname(f), s));
  }
  return seen;
}
// what each module does that a plain Node process can't: three.js, the page, audio, storage
export function drawing(entry) {
  const bad = [];
  for (const [f, { src, imports }] of deps(entry)) {
    const why = [];
    if (imports.includes('three')) why.push('imports three');
    for (const [re, w] of [[/\bdocument\./, 'document'], [/\bwindow\./, 'window'], [/\blocalStorage\b/, 'localStorage'], [/\bAudioContext\b/, 'audio']]) if (re.test(src.replace(/\/\/.*$/gm, ''))) why.push(w);
    if (why.length) bad.push(`${path.relative(process.cwd(), f)}: ${why.join(', ')}`);
  }
  return bad;
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const entry = process.argv[2] || 'src/game.js', bad = drawing(entry);
  for (const f of deps(entry).keys()) console.log(path.relative(process.cwd(), f));
  if (bad.length) { console.error('\ndrawing code in the sim:\n  ' + bad.join('\n  ')); process.exit(1); }
}
