import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const packages = {};
let checks = 0;
for (const [target, suffix] of [['chrome', 'chrome.zip'], ['firefox', 'firefox.xpi'], ['safari', 'safari-source.zip']]) {
  const path = `artifacts/pipit-${version}-${suffix}`;
  const bytes = readFileSync(path);
  const files = packages[target] = unzipSync(bytes);
  const expected = readFileSync(`${path}.sha256`, 'utf8').split(' ')[0];
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected); checks++;
  assert.ok(Object.keys(files).every(name => !name.includes('\\') && !name.startsWith('/') && !name.split('/').includes('..'))); checks++;
  for (const name of ['manifest.json', 'index.html', 'background.js', 'extension-policy.js', 'core.wasm', 'sample.pdf', 'fonts/InterVariable.woff2', 'vendor/PDFJS-LICENSE', 'INSTALL.txt']) assert.ok(files[name], `${target}: ${name}`);
  assert.ok(WebAssembly.validate(files['core.wasm'])); checks++;
  assert.equal(JSON.parse(strFromU8(files['manifest.json'])).version, version); checks++;
}
for (const name of Object.keys(packages.chrome).filter(name => !['manifest.json', 'background.js', 'INSTALL.txt'].includes(name))) {
  for (const target of ['firefox', 'safari']) assert.deepEqual(packages[target][name], packages.chrome[name], `${target} shared frontend ${name}`);
}
checks++;
assert.match(strFromU8(packages.firefox['background.js']), /onHeadersReceived/); checks++;
assert.doesNotMatch(strFromU8(packages.safari['background.js']), /onHeadersReceived|updateDynamicRules/); checks++;
assert.match(strFromU8(packages.safari['INSTALL.txt']), /NOT an installable/); checks++;
console.log(JSON.stringify({ passed: checks, version, sharedFiles: Object.keys(packages.chrome).length - 3, targets: Object.keys(packages) }));
