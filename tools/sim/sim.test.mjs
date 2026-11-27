// The rules stay apart from the drawing: src/game.js loads no three.js and touches no page, and a fight plays in
// plain Node, the same twice on the same seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import path from 'path';
import { drawing } from './deps.mjs';
import { load } from './headless.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the rules load no drawing code', () => {
  assert.deepEqual(drawing(path.join(root, 'src/game.js')), []);
});

test('a leg plays headless, the same on the same seed', async () => {
  const { H } = await load();
  const legs = (await import('../balance/legs.mjs')).default;
  const cfg = JSON.parse(JSON.stringify({ ...legs[0], seed: 5, maxT: 60 }));
  const a = H.leg(cfg), b = H.leg(cfg);
  assert.ok(a.o, 'an outcome');
  assert.deepEqual(a, b);
});
