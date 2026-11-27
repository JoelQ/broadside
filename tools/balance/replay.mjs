// Plays one fight or leg again, exactly, from the seed a run recorded.
//   node tools/balance/replay.mjs <jobs.mjs> <label-regex> <seed> [trace-seconds]
// e.g. node tools/balance/replay.mjs tools/balance/legs.mjs 'm1V The run \| sloop \| shoals' 81234 5
// Prints the result, and for a campaign leg where every ship was every few seconds. Run it twice to
// see the same fight twice; change the rules and run it again to see what the change did to that fight.
// Plays in plain Node from src/ (see tools/sim); DIST=<html> plays a built page in the browser instead.
import { pathToFileURL } from 'url';
import path from 'path';
import { play } from './play.mjs';
const [jobsFile, pattern, seedArg, everyArg] = process.argv.slice(2);
if (!jobsFile || !pattern || seedArg == null) { console.error('usage: replay.mjs <jobs.mjs> <label-regex> <seed> [trace-seconds]'); process.exit(2); }
const cells = (await import(pathToFileURL(path.resolve(jobsFile)))).default, re = new RegExp(pattern);
const c = cells.find((x) => re.test(x.label));
if (!c) { console.error(`no cell matches /${pattern}/`); process.exit(2); }
if (process.env.DIALS) c.dials = { ...JSON.parse(process.env.DIALS), ...(c.dials || {}) }; // the same DIALS as run.mjs
const seed = +seedArg, every = +everyArg || 0;
const [[r]] = await play([{ ...c, seed, trace: every || undefined }], 1, { workers: 1, dist: process.env.DIST, story: !!process.env.STORY });
const { trace, legs, ...rest } = r;
console.log(`== ${c.label} · seed ${seed}`);
console.log(JSON.stringify(rest));
if (trace && trace.length) console.log(trace.join('\n'));
