// node --test tools/map
import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from './check.mjs';
import { scenes } from './scenes.mjs';
import { Shape } from '../../src/coast.js';

const ship = (id, x, z, o = {}) => ({ id, name: id, cls: 'Brig', hull: 'brig', side: 1, x, z, h: 0, L: 30, B: 8, D: 3, fixed: false, o, t: 0 });
const base = (over = {}) => ({
  name: 'test', title: 'test', player: { x: 0, z: 0, h: 0 }, wind: { dir: 0, str: 1 }, land: [], shoals: [], zones: [], laterZones: [],
  coasts: [], moles: [], ships: [], arrivals: [], routes: {}, windShifts: [], current: null, ...over,
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

test('coasts and moles are land', () => {
  const coast = { shape: new Shape([[200, -400], [600, -400], [600, 400], [200, 400]]) };
  assert.ok(has(base({ coasts: [coast], ships: [ship('a', 400, 0)] }), /^error: a .* starts on land/));
  assert.ok(!has(base({ coasts: [coast], ships: [ship('a', 100, 0)] }), /on land/));
  const mole = { path: [[-300, 200], [300, 200]], w: 20, platforms: [], blocks: [[0, 300, 15]] };
  assert.ok(has(base({ moles: [mole], ships: [ship('a', 0, 202)] }), /^error: a .* starts on land/));
  assert.ok(has(base({ moles: [mole], routes: { r: [{ go: [0, 300] }] } }), /^error: route "r" has a waypoint on land/));
});

test('a harbour closed by a coast and a mole is unreachable', () => {
  // land to the north with a bay cut into it, its mouth shut by a mole
  const coast = { shape: new Shape([[-600, 200], [-100, 200], [-100, 500], [100, 500], [100, 200], [600, 200], [600, 800], [-600, 800]]) };
  const mole = { path: [[-130, 210], [130, 210]], w: 20, platforms: [], blocks: [] };
  assert.ok(has(base({ coasts: [coast], moles: [mole], zones: [{ name: 'basin', x: 0, z: 400, r: 30 }] }), /^error: zone "basin" reachable by no hull/));
  assert.ok(!has(base({ coasts: [coast], zones: [{ name: 'basin', x: 0, z: 400, r: 30 }] }), /reachable by no hull/));
});
