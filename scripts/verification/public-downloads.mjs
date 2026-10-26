import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const base = new URL(process.argv[2] || 'https://pipit-reader.pages.dev');
if (base.protocol !== 'https:') throw new Error('Public deployment checks require HTTPS');
const expected = JSON.parse(readFileSync(process.argv[3] || 'site-dist/release.json', 'utf8'));
const output = `output/playwright/public-${Date.now()}`;
mkdirSync(output, { recursive: true });
const records = [];
let checks = 0;
const verify = (condition, label) => { assert.ok(condition, label); checks++; };
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000) });
  verify(response.ok, `${path} responds successfully`);
  return response;
}
const home = await get('/');
verify((await home.text()).includes('Pipit — PDF reader for research papers.'), 'Public homepage describes Pipit as a research PDF reader');
verify(home.headers.get('content-security-policy')?.includes("script-src 'self'"), 'Homepage CSP is present');
verify(home.headers.get('x-content-type-options') === 'nosniff', 'MIME sniffing is disabled');
const release = await (await get('/release.json')).json();
verify(JSON.stringify(release) === JSON.stringify(expected), 'Public metadata matches committed release manifest');
for (const [target, item] of Object.entries(expected.downloads)) {
  const response = await get(item.url), bytes = new Uint8Array(await response.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  verify(hash === item.sha256, `${target} public bytes match committed SHA-256`);
  verify(bytes.length === item.bytes, `${target} public size matches release`);
  verify(response.headers.get('content-disposition')?.includes('attachment'), `${target} is an attachment download`);
  const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files['manifest.json']));
  verify(manifest.name.startsWith('Pipit') && manifest.version === expected.version, `${target} archive is the correct reader version`);
  verify(WebAssembly.validate(files['core.wasm']), `${target} has valid WASM`);
  verify(Object.keys(files).every(name => !name.startsWith('/') && !name.split('/').includes('..')), `${target} has safe archive paths`);
  const checksum = await (await get(`${item.url}.sha256`)).text();
  verify(checksum.trim() === `${hash}  ${item.url.split('/').pop()}`, `${target} public checksum companion matches`);
  writeFileSync(`${output}/${item.url.split('/').pop()}`, bytes);
  records.push({ target, url: new URL(item.url, base).href, bytes: bytes.length, sha256: hash, contentType: response.headers.get('content-type'), disposition: response.headers.get('content-disposition') });
}
const reader = await get('/reader/');
verify(reader.headers.get('content-security-policy')?.includes('wasm-unsafe-eval'), 'Reader CSP supports WASM');
const wasm = new Uint8Array(await (await get('/reader/core.wasm')).arrayBuffer());
verify(WebAssembly.validate(wasm), 'Hosted reader WASM is valid');
const missing = await fetch(new URL('/missing-public-verification-page', base));
verify(missing.status === 404, 'Public missing page returns 404');
for (const path of ['/.git/config', '/.env', '/reader/manifest.json']) {
  const response = await fetch(new URL(path, base));
  verify(response.status === 404 || response.status === 403, `${path} is not publicly exposed`);
}
const result = { checkedAt: new Date().toISOString(), base: base.href, passed: checks, downloads: records, output };
writeFileSync(`${output}/verification.json`, JSON.stringify(result, null, 2));
writeFileSync(`output/playwright/v${expected.version.replaceAll('.', '')}-public-downloads.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
