import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../src/annotation-sidecar.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parseNotebookSidecar, mergeNotebookEntries, notebookSidecar } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const entry = { id: 'note-1', excerpt: 'α <script>test</script>', note: 'A useful note', page: 2, offset: .32 };
const document = { id: 'pdf-fingerprint', name: 'Research paper.pdf' };
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
check('Notebook sidecar round trip preserves Unicode, anchors and literal text', () => assert.deepEqual(parseNotebookSidecar(notebookSidecar(document, [entry]), document.id, 3), [entry]));
check('Sidecar explicitly identifies non-embedded annotation mode', () => assert.equal(JSON.parse(notebookSidecar(document, [])).annotationMode, 'sidecar-only'));
check('Wrong-document imports are rejected', () => assert.throws(() => parseNotebookSidecar(notebookSidecar(document, [entry]), 'other')));
check('Out-of-range page anchors are rejected', () => assert.throws(() => parseNotebookSidecar(notebookSidecar(document, [entry]), document.id, 1)));
check('Duplicate IDs and excessive text are rejected atomically', () => {
  assert.throws(() => parseNotebookSidecar(notebookSidecar(document, [entry, entry]), document.id));
  assert.throws(() => parseNotebookSidecar(notebookSidecar(document, [{ ...entry, note: 'a'.repeat(8001) }]), document.id));
});
check('Repeated import is idempotent without replacing local notes', () => assert.deepEqual(mergeNotebookEntries([entry], [entry]), [entry]));
check('Edited local notes are not overwritten by backup conflicts', () => {
  const current = [{ ...entry, note: 'Edited locally' }];
  assert.throws(() => mergeNotebookEntries(current, [entry]));
  assert.equal(current[0].note, 'Edited locally');
});
check('New notes merge without mutating existing objects', () => {
  const result = mergeNotebookEntries([entry], [{ ...entry, id: 'note-2' }]);
  assert.equal(result.length, 2); assert.notEqual(result[0], entry);
});
console.log(`${checks} notebook sidecar checks passed.`);
