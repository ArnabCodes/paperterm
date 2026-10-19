import type { TextLine } from './types';

interface Engine extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  allocate: (length: number) => number;
  release: (pointer: number, length: number) => void;
  run_lookup: (pointer: number, length: number) => bigint;
}

let lines: TextLine[] = [];
let engine: Promise<Engine>;
function initialize(url: string) { return fetch(url).then(async response => {
  if (!response.ok) throw new Error('Could not load the reference engine');
  const result = await WebAssembly.instantiate(await response.arrayBuffer());
  return result.instance.exports as Engine;
}); }

self.onmessage = async event => {
  const { id, type, query, kind } = event.data;
  if (type === 'initialize') { engine = initialize(event.data.url); return; }
  if (type === 'index') { lines = event.data.lines; return; }
  try {
    const core = await engine;
    const input = new TextEncoder().encode(JSON.stringify({ lines, query, kind }));
    const pointer = core.allocate(input.length);
    let packed: bigint;
    try {
      new Uint8Array(core.memory.buffer, pointer, input.length).set(input);
      packed = core.run_lookup(pointer, input.length);
    } finally { core.release(pointer, input.length); }
    const resultPointer = Number(packed >> 32n);
    const resultLength = Number(packed & 0xffffffffn);
    try {
      const result = JSON.parse(new TextDecoder().decode(new Uint8Array(core.memory.buffer, resultPointer, resultLength)));
      self.postMessage({ id, result });
    } finally { core.release(resultPointer, resultLength); }
  } catch (error) { self.postMessage({ id, error: String(error) }); }
};
