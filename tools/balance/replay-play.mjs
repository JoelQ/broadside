// Plays fights a person recorded in the playtest build again, exactly, with nothing drawn.
//   node tools/balance/replay-play.mjs <recording.json>... [--out run.json]
// A recording is what the playtest build's "Copy" button puts on the clipboard (pause menu, or the playtest
// panel's Recorded fights): save it to a file. Each is played in plain Node from src/ (DIST=<html> plays a build instead)
// and checked against what happened when it was played: same outcome, and where (if anywhere) the ship first
// drifted from the recorded track. On the build it was recorded on it should not drift; on another build, or with
// DIALS, the drift and the outcome say what the change would have done to that very fight, played the same way.
// STORY=1 records the replay; --out writes a run file that story.mjs can draw.
import { readFileSync, writeFileSync } from 'fs';
import { play } from './play.mjs';
const args = process.argv.slice(2), files = [], flags = {};
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i]; else files.push(args[i]); }
if (!files.length) { console.error('usage: replay-play.mjs <recording.json>... [--out run.json]'); process.exit(2); }
const DIALS = process.env.DIALS ? JSON.parse(process.env.DIALS) : undefined;
const recs = files.flatMap((f) => { const raw = JSON.parse(readFileSync(f, 'utf8')); return Array.isArray(raw) ? raw : [raw]; });
const played = await play(recs.map((rec) => ({ rec, dials: DIALS })), 1, { dist: process.env.DIST, story: !!process.env.STORY });
const cells = [];
recs.forEach((rec, n) => {
  {
    const res = played[n][0];
    const label = `${rec.title} | ${rec.hull} | played ${rec.when.slice(0, 16).replace('T', ' ')}`;
    console.log(`== ${label}`);
    if (res.o === 'mismatch') { console.log(`  can't replay: ${res.why}`); return; }
    const done = rec.outcome != null, tamper = rec.tampered ? ' (playtest controls were used: expect it to differ)' : '';
    console.log(`  recorded: ${done ? `${rec.outcome} at ${rec.t}s, hull ${Math.round(rec.hullLeft * 100)}%` : `still going when it was copied, ${rec.dt.length} frames in`}${tamper}`);
    const drift = res.drift ? `left the recorded track at ${res.drift.t}s (${res.drift.yards} yd off${res.drift.hull ? `, hull ${res.drift.hull > 0 ? "+" : ""}${res.drift.hull} points` : ''})` : 'kept to the recorded track';
    console.log(`  replayed: ${res.o === 'unfinished' ? 'still going' : res.o} at ${res.t}s, hull ${Math.round(res.hull * 100)}%${done ? ` · ${res.same ? 'same outcome' : 'DIFFERENT OUTCOME'}` : ''} · ${drift}`);
    if (res.story) console.log(`  ${res.story.cause}`);
    cells.push({ label, legName: rec.title, hull: rec.hull, routeName: 'played', results: [res], runs: [{ k: 0, seed: res.seed, win: res.win, o: res.o, t: res.t }] });
  }
});
if (flags.out) writeFileSync(flags.out, JSON.stringify(cells));
