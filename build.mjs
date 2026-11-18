import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
// `node build.mjs` makes the public game, dist/index.html. `node build.mjs --playtest` makes dist/playtest.html,
// the same game with the playtest tools (src/playtest.js); the public build leaves that code out entirely.
const playtest = process.argv.includes('--playtest');
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', define: { __PLAYTEST__: String(playtest) } });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
let html = readFileSync('src/index.template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
if (playtest) html = html.replace(/<title>([^<]*)<\/title>/, '<title>$1 (playtest)</title>');
const out = playtest ? 'dist/playtest.html' : 'dist/index.html';
mkdirSync('dist', { recursive: true });
writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB');
