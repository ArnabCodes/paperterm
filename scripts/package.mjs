import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const files = {};
function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path);
    else files[relative('dist', path).replaceAll('\\', '/')] = new Uint8Array(readFileSync(path));
  }
}
collect('dist');
for (const required of ['manifest.json', 'index.html', 'background.js', 'core.wasm', 'sample.pdf', 'vendor/PDFJS-LICENSE']) {
  if (!files[required]) throw new Error(`Build is incomplete: ${required} is missing. Run npm run build first.`);
}
if (!WebAssembly.validate(files['core.wasm'])) throw new Error('The reference engine is not valid WebAssembly.');
files['LICENSE'] = new Uint8Array(readFileSync('LICENSE'));
files['INSTALL.txt'] = new TextEncoder().encode('Paperterm Chrome extension\n\n1. Extract this ZIP into a permanent folder.\n2. Open chrome://extensions and enable Developer mode.\n3. Click Load unpacked and select that folder.\n4. In extension Details, enable Allow access to file URLs for local PDFs.\n\nThe extension replaces normal top-level PDF navigations. Attachment downloads and embedded PDF widgets are not intercepted. PDFs are processed locally. The application is not published in the Chrome Web Store.\n');
mkdirSync('artifacts', { recursive: true });
const name = `artifacts/paperterm-${manifest.version}-chrome.zip`;
const archive = zipSync(files, { level: 6 });
writeFileSync(name, archive);
const hash = createHash('sha256').update(archive).digest('hex');
writeFileSync(`${name}.sha256`, `${hash}  ${name.split('/').pop()}\n`);
console.log(`${name}\n${archive.length} bytes\nSHA256 ${hash}`);
