import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';

const built = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
mkdirSync('artifacts', { recursive: true });
for (const target of ['chrome', 'firefox', 'safari']) {
  const root = `artifacts/unpacked/${target}`;
  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
  if (manifest.version !== built.version) throw new Error('Stale extension staging. Run npm run build first.');
  const files = {};
  function collect(directory) {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) collect(path);
      else files[relative(root, path).split(sep).join('/')] = new Uint8Array(readFileSync(path));
    }
  }
  collect(root);
  for (const required of ['manifest.json', 'index.html', 'background.js', 'extension-policy.js', 'core.wasm', 'sample.pdf', 'vendor/PDFJS-LICENSE', 'vendor/LUCIDE-LICENSE.txt', 'fonts/InterVariable.woff2', 'fonts/OFL.txt', 'mark.svg', 'icon32.png', 'INSTALL.txt', 'LICENSE']) {
    if (!files[required]) throw new Error(`Build is incomplete: ${target}/${required} is missing.`);
  }
  if (!WebAssembly.validate(files['core.wasm'])) throw new Error('The reference engine is not valid WebAssembly.');
  const suffix = target === 'firefox' ? 'firefox.xpi' : target === 'safari' ? 'safari-source.zip' : 'chrome.zip';
  const name = `artifacts/pipit-${manifest.version}-${suffix}`;
  const archive = zipSync(files, { level: 6 });
  writeFileSync(name, archive);
  const hash = createHash('sha256').update(archive).digest('hex');
  writeFileSync(`${name}.sha256`, `${hash}  ${name.split('/').pop()}\n`);
  console.log(`${name}\n${archive.length} bytes\nSHA256 ${hash}`);
}
