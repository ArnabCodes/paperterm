import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

async function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}
const { extractTextLines, TEXT_LINE_LIMITS } = await loadModule('../../src/text-lines.ts');
const { buildDocumentMap } = await loadModule('../../src/research.ts');
const item = (text, x, y, width) => ({ text, x, y, width });
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const columnItems = (offset = 0) => Array.from({ length: 4 }, (_, index) => [
  item(`Left column paragraph ${index}`, 50, offset + 100 + index * 14, 230),
  item(`Right column paragraph ${index}`, 320, offset + 100 + index * 14, 230),
]).flat();

check('aligned columns split and read left before right, preserving normalized coordinates', () => {
  const input = Object.freeze(columnItems().reverse().map(entry => Object.freeze(entry)));
  const lines = extractTextLines(input, 7, 600, 800);
  assert.deepEqual(lines.map(line => line.text), [0, 1, 2, 3].map(index => `Left column paragraph ${index}`).concat([0, 1, 2, 3].map(index => `Right column paragraph ${index}`)));
  assert.equal(lines[0].page, 7);
  assert.equal(lines[0].x, 50 / 600);
  assert.equal(lines[4].x, 320 / 600);
  assert.equal(lines[4].y, 100 / 800);
  assert.deepEqual(extractTextLines(input, 7, 600, 800), lines);
});

check('nonaligned baselines still detect columns without requiring matched rows', () => {
  const input = columnItems().map(entry => ({ ...entry, y: entry.y + (entry.x > 300 ? 6 : 0) }));
  const lines = extractTextLines(input, 1, 600, 800);
  assert.equal(lines.length, 8);
  assert.ok(lines.slice(0, 4).every(line => line.text.startsWith('Left')));
  assert.ok(lines.slice(4).every(line => line.text.startsWith('Right')));
});

check('full-width heading and figure-caption bands separate column reading order', () => {
  const input = [item('A full-width title', 50, 50, 500), ...columnItems(),
    item('Figure 1. A full-width figure caption', 50, 220, 500), ...columnItems(200),
    item('Concluding full-width text', 50, 500, 500)];
  const texts = extractTextLines(input, 1, 600, 800).map(line => line.text);
  assert.equal(texts[0], 'A full-width title');
  assert.equal(texts[8], 'Right column paragraph 3');
  assert.equal(texts[9], 'Figure 1. A full-width figure caption');
  assert.equal(texts[10], 'Left column paragraph 0');
  assert.equal(texts[18], 'Concluding full-width text');
});

check('single-column words and equation labels remain on their source lines', () => {
  const input = [item('Text across the center of a single-column page.', 50, 80, 500),
    item('Energy', 100, 100, 65), item('=', 175, 100.5, 10), item('mass', 195, 100, 55), item('(2)', 530, 100, 20),
    item('Another single-column text line', 50, 130, 500),
    item('Equation body', 120, 160, 200), item('(3)', 530, 160, 20)];
  assert.deepEqual(extractTextLines(input, 1, 600, 800).map(line => line.text), [
    'Text across the center of a single-column page.', 'Energy = mass (2)', 'Another single-column text line', 'Equation body (3)',
  ]);
  const equations = Array.from({ length: 8 }, (_, index) => [item('Long equation body here', 80, 200 + index * 20, 180), item(`(${index})`, 540, 200 + index * 20, 20)]).flat();
  assert.equal(extractTextLines(equations, 1, 600, 800).length, 8);
});

check('normal interword gaps near the center do not imply a gutter', () => {
  const input = Array.from({ length: 5 }, (_, index) => [item(`Left half of sentence ${index}`, 50, 100 + index * 14, 245), item(`right half of sentence ${index}`, 300, 100 + index * 14, 250)]).flat();
  const lines = extractTextLines(input, 1, 600, 800);
  assert.equal(lines.length, 5);
  assert.ok(lines.every(line => line.text.includes('Left half') && line.text.includes('right half')));
});

check('two-column bibliography keeps heading before all definitions and separates aligned labels', () => {
  const input = [item('References & further reading', 50, 80, 200)];
  for (let index = 0; index < 4; index++) {
    input.push(item(`[${index + 1}] Left software documentation`, 50, 100 + index * 15, 230));
    input.push(item(`[${index + 5}] Right software documentation`, 320, 100 + index * 15, 230));
  }
  const map = buildDocumentMap(extractTextLines(input, 4, 600, 800));
  assert.deepEqual(map.references.map(reference => reference.label), ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]', '[7]', '[8]']);
  assert.equal(map.mentions.length, 0);
});

check('invalid geometry, empty items and input/text limits are bounded', () => {
  assert.deepEqual(extractTextLines([], 1, 0, 800), []);
  assert.deepEqual(extractTextLines([], 1, 600, NaN), []);
  assert.deepEqual(extractTextLines([item(' ', 0, 0, 10), item('bad', NaN, 10, 10), item('bad', 10, 10, -1)], 1, 600, 800), []);
  assert.equal(extractTextLines([item('x'.repeat(9000), 0, 0, 500)], 1, 600, 800)[0].text.length, TEXT_LINE_LIMITS.characters);
  assert.deepEqual(extractTextLines([item(' '.repeat(TEXT_LINE_LIMITS.characters) + 'late', 0, 0, 500)], 1, 600, 800), []);
  const many = Array.from({ length: TEXT_LINE_LIMITS.items + 1 }, (_, index) => item(`${index}`, 50, index * 4, 20));
  assert.equal(extractTextLines(many, 1, 600, 800).length, TEXT_LINE_LIMITS.items);
});

const fixture = new URL('../../output/playwright/fixtures/tracemonkey.pdf', import.meta.url);
if (existsSync(fixture)) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(fixture)), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const lines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter(entry => 'str' in entry).map(entry => {
        const [x, y] = viewport.convertToViewportPoint(entry.transform[4], entry.transform[5]);
        return { text: entry.str, x, y, width: entry.width };
      });
      lines.push(...extractTextLines(items, pageNumber, viewport.width, viewport.height));
    }
    check('local TraceMonkey fixture has all nineteen bibliography labels, no definition mentions', () => {
      const map = buildDocumentMap(lines);
      assert.deepEqual(map.references.map(reference => reference.label), Array.from({ length: 19 }, (_, index) => `[${index + 1}]`));
      const bibliographyLine = map.sections.find(section => section.kind === 'bibliography').lineIndex;
      assert.ok(map.mentions.every(mention => mention.lineIndex < bibliographyLine));
      assert.ok(map.references.every(reference => !/\[\d+\]/.test(reference.text.slice(reference.label.length))));
      console.log(`TraceMonkey: ${pdf.numPages} pages, ${map.references.length} bibliography entries, ${map.mentions.length} mentions.`);
    });
  } finally {
    await task.destroy();
  }
} else {
  console.log('SKIP optional local TraceMonkey fixture (file not present).');
}
console.log(`${checks} text-line checks passed.`);
