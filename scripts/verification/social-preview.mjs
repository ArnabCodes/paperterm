import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = process.argv[2];
const read = async path => {
  if (!base) return readFileSync(`site-dist/${path}`);
  const response = await fetch(new URL(path, base), { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
  assert.equal(response.status, 200, path);
  return Buffer.from(await response.arrayBuffer());
};
for (const path of ['index.html', 'docs/index.html', 'reader/index.html', 'privacy.html', 'release-notes.html', 'licenses.html']) {
  const html = (await read(path)).toString();
  assert.equal((html.match(/property="og:image"/g) || []).length, 1, path);
  assert.ok(html.includes('https://pipit-reader.pages.dev/assets/pipit-social-v1.png'), path);
  assert.ok(html.includes('name="twitter:card" content="summary"'), path);
  assert.ok(html.includes('property="og:image:alt"'), path);
}
const bytes = await read('assets/pipit-social-v1.png');
assert.equal(bytes.readUInt32BE(16), 512); assert.equal(bytes.readUInt32BE(20), 512);
if (base) assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(readFileSync('site-dist/assets/pipit-social-v1.png')).digest('hex'));
console.log('PASS six static social previews, square 512px PNG, and public image parity when hosted.');
