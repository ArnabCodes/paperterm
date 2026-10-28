import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('site-dist/docs/index.html', 'utf8');
const home = readFileSync('site-dist/index.html', 'utf8');
const sections = ['tutor', 'start', 'install', 'reading', 'references', 'appearance', 'notes', 'page-editing', 'files', 'citations', 'keyboard', 'troubleshooting'];
for (const id of sections) {
  assert.ok(html.includes(`section id="${id}"`));
  assert.ok(html.includes(`href="#${id}"`));
}
assert.equal((html.match(/class="docs-key-group"/g) || []).length, 8);
assert.ok((html.match(/<tr>/g) || []).length > 80);
assert.ok(home.includes('href="/docs/">Docs</a>'));
assert.ok(html.includes('Highlights and notes are local sidecar data, not embedded in the PDF'));
assert.ok(html.includes('Page editing &amp; visual selection'));
assert.ok(html.includes('View edit history'));
assert.ok(html.includes('notebook notes and highlights'));
assert.ok(html.includes('Ctrl/Cmd+↑/↓ moves the selection'));
assert.ok(html.includes('No access controls are bypassed'));
assert.ok(html.includes('unsigned'));
assert.ok(html.includes('Safari does not automatically replace'));
assert.ok(html.includes('class="docs-search" hidden'));
assert.ok(readFileSync('site-dist/docs.js', 'utf8').includes('aria-current'));
assert.doesNotMatch(readFileSync('site-dist/docs.js', 'utf8'), /fetch\(|XMLHttpRequest|sendBeacon/);
assert.ok(html.includes('/reader/?tutor=1') && home.includes('/reader/?tutor=1'));
assert.ok(readFileSync('site-dist/reader/tutor.pdf').subarray(0,5).toString() === '%PDF-');
console.log('Documentation checks passed: 12 section anchors, 8 shortcut groups, page editing guide, Tutor links and bundled PDF.');
