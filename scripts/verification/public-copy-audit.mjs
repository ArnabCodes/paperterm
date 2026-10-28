import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const copy = new Map();
for (const path of ['index.html', 'docs/index.html', 'privacy.html', 'release-notes.html', 'licenses.html', 'app.js', 'showcase.js', 'docs.js']) {
  let html;
  if (process.argv[2]) {
    const response = await fetch(new URL(path, process.argv[2]), { signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, `${path} loads`);
    html = await response.text();
  } else html = readFileSync(`site-dist/${path}`, 'utf8');
  copy.set(path, html);
  assert.doesNotMatch(html, /paperterm/i, `${path}: obsolete product name must not appear in public copy`);
  assert.doesNotMatch(html, /blinking text caret|caret-browsing|browser-wide accessibility|\bF7\b|reported ScienceDirect|private development repository|runtime validation remains open|Generated from the reader’s current command definitions/i, path);
}
const docs = copy.get('docs/index.html');
for (const phrase of ['unsigned', 'system folder-permission picker', 'not embedded in the PDF', 'No access controls are bypassed', 'no built-in OCR']) assert.ok(docs.includes(phrase), `Relevant user limit retained: ${phrase}`);
console.log('Public copy audit passes for all five pages and three text-bearing scripts; product limits are retained.');
