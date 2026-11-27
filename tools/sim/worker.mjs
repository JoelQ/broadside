// One headless game in a worker thread: plays the cells play.mjs sends it, one at a time, and posts each result back.
import { parentPort, workerData } from 'worker_threads';
import { pathToFileURL } from 'url';
import path from 'path';
const { load } = await import(pathToFileURL(path.join(workerData.root, 'tools/sim/headless.mjs')).href);
const { H } = await load(workerData.extra || [], workerData.harness);
parentPort.on('message', ({ id, kind, cfg }) => {
  try {
    // a harness call, or with kind 'call' any page-side function by name ({ fn: 'HS.polar', args }), for other tools
    const res = kind === 'call' ? cfg.fn.split('.').reduce((o, k) => o[k], globalThis)(...cfg.args) : H[kind](cfg);
    parentPort.postMessage({ id, res });
  } catch (e) { parentPort.postMessage({ id, error: e.stack || String(e) }); }
});
parentPort.postMessage({ ready: true });
