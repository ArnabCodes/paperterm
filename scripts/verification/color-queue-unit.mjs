import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const workers = [];
globalThis.Worker = class {
  constructor() { workers.push(this); }
  postMessage(message, transfers) {
    this.message = structuredClone(message, { transfer: transfers });
  }
  complete() { this.onmessage({ data: { pixels: this.message.pixels } }); }
  terminate() { this.terminated = true; }
};
globalThis.ImageData = class {
  constructor(data, width, height) { Object.assign(this, { data, width, height }); }
};
const source = await readFile(new URL('../../src/canvas-colorizer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import.meta.url', JSON.stringify(new URL('../../src/canvas-colorizer.ts', import.meta.url).href));
const { CanvasColorizer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const preferences = { recolor: true, palette: [] };
const original = new ImageData(new Uint8ClampedArray([20, 30, 40, 255]), 1, 1);
const wait = () => new Promise(resolve => setTimeout(resolve, 10));
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; console.log(`PASS ${label}`); };
const queue = new CanvasColorizer();
const canvas = {}, secondCanvas = {};
let reads = 0;
const read = () => { reads++; return original; };
const first = queue.transform(canvas, read, preferences);
const replaced = queue.transform(canvas, read, preferences);
check(await first === null && reads === 0, 'Superseded queued work is skipped before canvas readback');
await wait();
check(workers.length === 1 && reads === 1, 'Worker is lazy and only one job is dispatched');
check(original.data.byteLength === 4, 'Transfer does not detach the original raster cache');
const other = queue.transform(secondCanvas, read, preferences);
await wait();
check(reads === 1, 'Queued canvases are not read while the worker is occupied');
workers[0].complete();
check((await replaced).data.join(',') === '20,30,40,255', 'Transferred raster returns with exact pixels and dimensions');
await wait();
workers[0].complete(); await other;
const canceled = queue.transform(canvas, read, preferences);
queue.cancel(canvas);
check(await canceled === null, 'Canvas cancellation resolves queued callers');
const stale = queue.transform(canvas, () => null, preferences);
await wait();
check(await stale === null, 'Stale or detached canvas can skip readback entirely');
const failure = queue.transform(canvas, read, preferences).then(() => false, error => /worker could not run/.test(error.message));
const queuedFailure = queue.transform(secondCanvas, read, preferences).then(() => false, error => /worker could not run/.test(error.message));
await wait(); workers[0].onerror();
check(await failure && await queuedFailure && workers[0].terminated, 'Worker failure rejects callers and releases the broken worker');
console.log(`${passed} color-queue checks passed.`);
