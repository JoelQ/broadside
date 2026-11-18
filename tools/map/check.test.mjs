// node --test tools/map
import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from './check.mjs';
import { scenes } from './scenes.mjs';

const ship = (id, x, z, o = {}) => ({ id, name: id, cls: 'Brig', hull: 'brig', side: 1, x, z, h: 0, L: 30, B: 8, D: 3, fixed: false, o, t: 0 });
const base = (over = {}) => ({
  name: 'test', title: 'test', player: { x: 0, z: 0, h: 0 }, wind: { dir: 0, str: 1 }, land: [], shoals: [], zones: [], laterZones: [],
  ships: [], arrivals: [], routes: {}, windShifts: [], current: null, ...over,
});
const levels = (sc) => check(sc).map((f) => `${f.level}: ${f.msg}`);
const has = (sc, re) => levels(sc).some((s) => re.test(s));

test('every campaign leg builds and passes', () => {
  for (const sc of scenes()) assert.deepEqual(check(sc).filter((f) => f.level === 'error'), [], sc.name);
});

test('a ship on land is an error', () => {
  assert.ok(has(base({ land: [{ x: 300, z: 0, r: 100, hit: 80 }], ships: [ship('a', 310, 0)] }), /^error: a .* starts on land/));
});

test('a ship that draws more than the bank is an error; one that floats over it is not', () => {
  const bank = { x: 300, z: 0, r: 100, depth: 2.5 };
  assert.ok(has(base({ shoals: [bank], ships: [ship('a', 300, 0)] }), /^error: a .* starts aground/));
  assert.ok(!has(base({ shoals: [bank], ships: [{ ...ship('a', 300, 0), D: 2.2 }] }), /aground/));
});

test('a player start some hulls would stick on is a warning that names them', () => {
  const out = levels(base({ shoals: [{ x: 0, z: 0, r: 60, depth: 2.6 }] }));
  assert.ok(out.some((s) => /^warn: player starts aground in a brig/.test(s) && !/sloop/.test(s)), out.join('\n'));
});

test('a zone behind a wall of land is unreachable; one behind a bank only small ships cross names them', () => {
  const ring = Array.from({ length: 24 }, (_, i) => ({ x: 500 + Math.sin(i / 3.82) * 150, z: Math.cos(i / 3.82) * 150, r: 40, hit: 32 }));
  assert.ok(has(base({ land: ring, zones: [{ name: 'cove', x: 500, z: 0, r: 30 }] }), /^error: zone "cove" reachable by no hull/));
  const bar = { x: 500, z: 0, r: 220, depth: 2.4 };
  const out = levels(base({ shoals: [bar], zones: [{ name: 'cove', x: 500, z: 0, r: 30 }] }));
  const line = out.find((s) => s.startsWith('note: zone "cove"'));
  assert.ok(/sloop/.test(line) && !/brig|merchantman|flagship/.test(line), out.join('\n'));
});

test('a route waypoint on land is an error', () => {
  assert.ok(has(base({ land: [{ x: 300, z: 300, r: 100, hit: 80 }], routes: { run: [{ go: [300, 300], r: 30 }] } }), /^error: route "run" has a waypoint on land/));
});
