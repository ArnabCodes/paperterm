import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { manifestFor, targetInstructions } from './extension-targets.mjs';

const base = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
for (const target of ['chrome', 'firefox', 'safari']) {
  const stage = resolve('artifacts/unpacked');
  const output = resolve(stage, target);
  if (dirname(output) !== stage) throw new Error('Invalid extension staging path');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync('dist', output, { recursive: true });
  writeFileSync(`${output}/manifest.json`, JSON.stringify(manifestFor(base, target), null, 2) + '\n');
  if (target !== 'chrome') cpSync(`extension/${target}.js`, `${output}/background.js`);
  cpSync('LICENSE', `${output}/LICENSE`);
  writeFileSync(`${output}/INSTALL.txt`, `Pipit ${base.version} — ${target}\n\n${targetInstructions[target]}\n\nThe reader, rendering workers, fonts, Rust WASM lookup, and themes are shared across targets. Documents stay local; remote source URLs and explicitly followed external links contact their original hosts.\n`);
  console.log(output);
}
