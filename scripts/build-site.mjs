import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { pages } from '../site/content.mjs';

const root = resolve('.'), output = resolve('site-dist');
if (dirname(output) !== root || output === root) throw new Error('Unsafe website output path');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const built = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
if (built.version !== version || !built.name.startsWith('Pipit')) throw new Error('Build Pipit before building the website');
if (!existsSync('site/assets/pip.png')) throw new Error('The mascot artwork is missing');
const release = { name: 'Pipit', version, channel: 'alpha', release: 'Alpha 01', downloads: {} };
for (const [target, suffix] of [['chrome', 'chrome.zip'], ['firefox', 'firefox.xpi'], ['safari', 'safari-source.zip']]) {
  const filename = `pipit-${version}-${suffix}`, path = `artifacts/${filename}`;
  const bytes = readFileSync(path), checksum = createHash('sha256').update(bytes).digest('hex');
  if (!readFileSync(`${path}.sha256`, 'utf8').startsWith(checksum + '  ')) throw new Error(`Checksum mismatch: ${filename}`);
  const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files['manifest.json']));
  if (manifest.version !== version || !manifest.name.startsWith('Pipit')) throw new Error(`Stale archive: ${filename}`);
  release.downloads[target] = { url: `/downloads/${filename}`, sha256: checksum, bytes: bytes.length, status: target === 'safari' ? 'source-only' : target === 'firefox' ? 'unsigned-temporary' : 'unpacked' };
}
rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'assets'), { recursive: true });
mkdirSync(join(output, 'downloads'), { recursive: true });
for (const filename of ['index.html', 'style.css', 'app.js', 'detection.js', '_headers']) cpSync(`site/${filename}`, join(output, filename));
cpSync('site/assets/pip.png', join(output, 'assets/pip.png'));
cpSync('public/mark.svg', join(output, 'assets/mark.svg'));
for (const name of ['InterVariable.woff2', 'OFL.txt']) cpSync(`public/fonts/${name}`, join(output, `assets/${name}`));
cpSync('LICENSE', join(output, 'LICENSE.txt'));
const reader = join(output, 'reader');
mkdirSync(reader);
for (const entry of readdirSync('dist')) {
  if (['manifest.json', 'background.js', 'extension-policy.js'].includes(entry)) continue;
  cpSync(join('dist', entry), join(reader, entry), { recursive: true });
}
let html = readFileSync(join(output, 'index.html'), 'utf8');
for (const [target, item] of Object.entries(release.downloads)) {
  const name = item.url.split('/').pop();
  cpSync(`artifacts/${name}`, join(output, item.url));
  cpSync(`artifacts/${name}.sha256`, join(output, `${item.url}.sha256`));
  html = html.replace(`data-target="${target}" href="#installation"`, `data-target="${target}" href="${item.url}" download="${name}"`);
  html = html.replace(`data-checksum="${target}" href="#release"`, `data-checksum="${target}" href="${item.url}.sha256"`);
}
html = html.replace('<div id="install-content"></div>', '<div id="install-content"><noscript><p>JavaScript is disabled. Chromium: extract ZIP, enable Developer mode in chrome://extensions, Load unpacked. Firefox: about:debugging → Load Temporary Add-on → select XPI; unsigned installs end at restart. Safari: source only; convert on a Mac with Xcode, sign and enable the host app. See release notes for limitations.</p></noscript></div>');
writeFileSync(join(output, 'index.html'), html);
writeFileSync(join(output, 'release.json'), JSON.stringify(release, null, 2) + '\n');
for (const [filename, page] of Object.entries(pages)) writeFileSync(join(output, filename), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Pipit alpha — ${page.title}"><link rel="icon" href="/assets/mark.svg"><link rel="stylesheet" href="/style.css"><title>${page.title} — Pipit</title></head><body><header class="site-header wrap"><a href="/" class="brand"><img src="/assets/mark.svg" width="34" height="34" alt="">pipit.</a><a class="text-link" href="/#download">Downloads ↗</a></header><main class="document wrap"><a href="/">← Back to Pipit</a><h1>${page.title}</h1>${page.body}</main></body></html>\n`);
writeFileSync(join(output, '404.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Page not found — Pipit</title></head><body><main class="document wrap"><h1>A small detour.</h1><p>That page is not here. Your next idea might be.</p><a href="/">Return to Pipit →</a></main></body></html>');
let count = 0;
function audit(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry), stat = statSync(path);
    if (stat.isDirectory()) audit(path);
    else { if (stat.size >= 25 * 1024 * 1024) throw new Error(`Asset exceeds Pages per-file limit: ${path}`); count++; }
  }
}
audit(output);
console.log(JSON.stringify({ output, files: count, release }, null, 2));
