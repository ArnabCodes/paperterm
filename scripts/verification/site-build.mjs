import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const release = JSON.parse(readFileSync('site-dist/release.json', 'utf8'));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(release.version, version);
assert.equal(release.channel, 'alpha');
let checks = 2;
for (const [target, item] of Object.entries(release.downloads)) {
  const bytes = readFileSync(`site-dist${item.url}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256); checks++;
  assert.equal(bytes.length, item.bytes); checks++;
  assert.deepEqual(bytes, readFileSync(`artifacts/${item.url.split('/').pop()}`)); checks++;
  assert.equal(item.status, target === 'safari' ? 'source-only' : target === 'firefox' ? 'unsigned-temporary' : 'unpacked'); checks++;
}
assert.ok(!existsSync('site-dist/reader/manifest.json') && !existsSync('site-dist/reader/background.js')); checks++;
for (const path of ['assets/pip.png', 'assets/mark.svg', 'assets/InterVariable.woff2', 'assets/OFL.txt', '404.html', 'privacy.html', 'release-notes.html', 'licenses.html', 'reader/core.wasm']) assert.ok(existsSync(`site-dist/${path}`)); checks++;
assert.ok(WebAssembly.validate(readFileSync('site-dist/reader/core.wasm'))); checks++;
const html = readFileSync('site-dist/index.html', 'utf8');
for (const name of ['chrome.svg', 'firefox.svg', 'safari.png']) {
  assert.ok(existsSync(`site-dist/assets/${name}`));
  assert.ok(html.includes(`src="/assets/${name}"`));
  checks++;
}
for (const item of Object.values(release.downloads)) assert.ok(html.includes(`href="${item.url}" download=`)); checks++;
assert.match(html, /JavaScript is disabled/); checks++;
assert.doesNotMatch(html, /https?:\/\/[^"\s]+\.(?:js|css)/); checks++;
assert.match(readFileSync('site-dist/_headers', 'utf8'), /Content-Disposition: attachment/); checks++;
console.log(`${checks} website artifact checks passed`);
