import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/research.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { buildDocumentMap, parseNumericCitationGroup, findNumericCitations, extractSelectionIdentifiers, extractDois, extractArxivIds, RESEARCH_LIMITS } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const line = (text, page = 1, y = 0.1, x = 0.1) => ({ text, page, x, y });

check('numeric lists, Unicode ranges and duplicates', () => {
  assert.deepEqual(parseNumericCitationGroup(' 1, 3–5; 5, 8 — 9, 11−12 '), [1, 3, 4, 5, 5, 8, 9, 11, 12]);
  assert.deepEqual(parseNumericCitationGroup('001, 2-2'), [1, 2]);
  for (const invalid of ['', '0', '3-1', '1,,2', '1 2', '-1', '1.2', 'Smith 2020', '1-', '1e2', '1000000', '1-999999', '1,', '1\n2', '1,\n2', '1'.repeat(257)]) assert.equal(parseNumericCitationGroup(invalid), null, invalid);
  assert.equal(parseNumericCitationGroup('1-256').length, 256);
  assert.equal(parseNumericCitationGroup('1-257'), null);
});

check('groups have exact UTF-16 offsets and no nested bracket matches', () => {
  const text = '😀 see [2,2] and [7–8]; not [[4]], [3-1] or [Smith].';
  const groups = findNumericCitations(text);
  assert.deepEqual(groups.map(group => group.numbers), [[2, 2], [7, 8]]);
  for (const group of groups) assert.equal(text.slice(group.start, group.end), group.raw);
});

check('document map, backlinks, page counts, unresolved edges and zero-citation pages', () => {
  const lines = [
    line('1 Introduction'), line('Prior work [1, 2–3] and again [1].', 1, 0.2),
    line('Further evidence [1,1].', 2), line('3 References', 3),
    line('[1] A. Author. First title (2020).', 3, 0.2),
    line('Continuation containing [99] is not a mention.', 3, 0.23),
    line('[2] B. Author. Second title.', 3, 0.3),
    line('Appendix A', 4), line('Compare [2] and [9].', 4, 0.2), line('No citations here.', 5),
  ];
  const frozen = lines.map(entry => Object.freeze(entry));
  const map = buildDocumentMap(Object.freeze(frozen));
  assert.equal(map.truncated, false);
  assert.deepEqual(map.references.map(reference => reference.label), ['[1]', '[2]']);
  assert.equal(map.references[0].id, 'reference:1');
  assert.equal(map.references[0].page, 3);
  assert.deepEqual(map.references[0].lineIndices, [4, 5]);
  assert.match(map.references[0].text, /Continuation/);
  assert.equal(map.references[0].mentions.length, 4);
  assert.equal(map.mentions.length, 8);
  assert.equal(new Set(map.mentions.map(mention => mention.id)).size, 8);
  assert.equal(map.mentions[4].start, map.mentions[5].start);
  assert.deepEqual(map.pages.map(page => [page.page, page.citationCount, page.uniqueReferenceCount]), [[1, 4, 3], [2, 2, 1], [3, 0, 0], [4, 2, 2], [5, 0, 0]]);
  assert.deepEqual(map.unresolvedReferenceIds, ['reference:3', 'reference:9']);
  assert.equal(map.edges.find(edge => edge.page === 2).count, 2);
  assert.deepEqual(map.sections.map(section => [section.title, section.endLineIndex]), [['1 Introduction', 3], ['3 References', 7], ['Appendix A', 10]]);
  assert.deepEqual(buildDocumentMap(lines), map);
});

check('headings nest and last section ends at the exclusive line count', () => {
  const map = buildDocumentMap([line('2 Methods'), line('2.1 Sampling'), line('Text'), line('2.2 Analysis'), line('3 Results')]);
  assert.deepEqual(map.sections.map(section => [section.depth, section.endLineIndex]), [[1, 4], [2, 3], [2, 4], [1, 5]]);
});

check('demo qualified bibliography has four definitions and only two body mentions', () => {
  const map = buildDocumentMap([
    line('The bibliography entry [1] is another place to begin.'),
    line('Open reference [1]', 1, 0.8),
    line('References & further reading', 6),
    line('[1] Bush, V. As We May Think. The Atlantic, 1945.', 6, 0.2),
    line('[2] Engelbart, D. C. Augmenting Human Intellect. SRI, 1962.', 6, 0.3),
    line('[3] Sioyek. Documentation: commands and reference navigation.', 6, 0.4),
    line('[4] Mozilla. PDF.js: a general-purpose platform for parsing PDFs.', 6, 0.5),
    line('Documentation also links to [1, 3–4].', 6, 0.53),
    line('This field guide is original demo content.', 6, 0.6),
  ]);
  assert.equal(map.references.length, 4);
  assert.deepEqual(map.references.map(reference => reference.label), ['[1]', '[2]', '[3]', '[4]']);
  assert.equal(map.mentions.length, 2);
  assert.ok(map.mentions.every(mention => mention.page === 1));
  assert.equal(map.sections[0].kind, 'bibliography');
  assert.equal(map.pages.find(page => page.page === 6).citationCount, 0);
  assert.deepEqual(map.unresolvedReferenceIds, []);
  assert.equal(map.edges.length, 1);
  assert.equal(map.edges[0].count, 2);
  assert.deepEqual(map.references[3].lineIndices, [6, 7, 8]);
});

check('qualified bibliography headings handle numbering, case, punctuation and conjunctions', () => {
  for (const title of ['References & further reading', '6. References and further reading:', 'VI Bibliography & Further Reading.', 'WORKS CITED AND FURTHER READING']) {
    const map = buildDocumentMap([line(title), line('[3] Sioyek. Documentation.')]);
    assert.equal(map.sections[0]?.kind, 'bibliography', title);
    assert.equal(map.references.length, 1, title);
    assert.equal(map.mentions.length, 0, title);
  }
  const prose = buildDocumentMap([line('References & further reading can help [4].')]);
  assert.equal(prose.sections.length, 0);
  assert.equal(prose.mentions.length, 1);
});

check('recognized trailing headings close bibliography, reset continuations and resume mentions', () => {
  for (const title of ['Appendix A', 'Acknowledgements', 'Author contributions', 'Data availability', 'Notes', '7.1 Additional experiments']) {
    const map = buildDocumentMap([
      line('6 References & further reading'), line('[4] Mozilla. PDF.js documentation.', 1, 0.2),
      line(title, 1, 0.22), line('We use [4] again.', 1, 0.24),
    ]);
    assert.equal(map.sections[0].endLineIndex, 2, title);
    assert.deepEqual(map.references[0].lineIndices, [1], title);
    assert.equal(map.references[0].text, '[4] Mozilla. PDF.js documentation.', title);
    assert.equal(map.mentions.length, 1, title);
    assert.equal(map.mentions[0].lineIndex, 3, title);
    assert.equal(map.references[0].mentions.length, 1, title);
  }
});

check('line-start mentions are not automatically definitions; unheaded metadata is recognized', () => {
  const map = buildDocumentMap([
    line('[1] demonstrates the result.'), line('We use [1].', 1, 0.2),
    line('[1] Schrödinger, E. A reference (1926).', 3),
    line('Journal continuation.', 3, 0.12), line('Now [1] is mentioned.', 4),
  ]);
  assert.equal(map.references.length, 1);
  assert.equal(map.references[0].mentions.length, 3);
  assert.equal(map.references[0].page, 3);
  assert.match(map.references[0].text, /Journal continuation/);
});

check('duplicate definition labels retain alternatives without merging mention locations', () => {
  const map = buildDocumentMap([line('See [7]'), line('References', 2), line('[7] First entry', 2, 0.2), line('[7] Alternate entry', 2, 0.3)]);
  assert.equal(map.references.length, 1);
  assert.equal(map.references[0].definitions.length, 2);
  assert.equal(map.references[0].text, '[7] First entry');
  assert.equal(map.references[0].mentions.length, 1);
});

check('empty and incomplete indexes keep unresolved mentions', () => {
  assert.deepEqual(buildDocumentMap([]).pages, []);
  const map = buildDocumentMap([line('[7]'), line('Again [7]', 2)]);
  assert.equal(map.references.length, 0);
  assert.equal(map.mentions.length, 2);
  assert.deepEqual(map.unresolvedReferenceIds, ['reference:7']);
});

check('separate groups and identical source locations remain separate mentions', () => {
  const map = buildDocumentMap([line('See [1][1]'), line('See [1][1]')]);
  assert.equal(map.mentions.length, 4);
  assert.equal(new Set(map.mentions.map(mention => mention.id)).size, 4);
  assert.deepEqual(map.mentions.map(mention => [mention.page, mention.x, mention.y]), Array.from({ length: 4 }, () => [1, 0.1, 0.1]));
  assert.equal(map.edges[0].count, 4);
});

check('hostile groups are skipped whole without losing later valid groups', () => {
  const map = buildDocumentMap([line('[1-999999] [1, broken, 2] [' + '1,'.repeat(160) + '1] [5]')]);
  assert.deepEqual(map.mentions.map(mention => mention.label), ['[5]']);
  assert.deepEqual(parseNumericCitationGroup('1\u00a0–\u00a03; 4'), [1, 2, 3, 4]);
});

check('line and bibliography clipping are bounded and signaled', () => {
  const map = buildDocumentMap([line('x'.repeat(RESEARCH_LIMITS.lineCharacters) + '[1]')]);
  assert.equal(map.truncated, true);
  assert.equal(map.mentions.length, 0);
  const bibliography = buildDocumentMap([line('References'), line('[1] ' + 'a'.repeat(8000)), line('b'.repeat(8000))]);
  assert.equal(bibliography.truncated, true);
  assert.equal(bibliography.references[0].text.length, RESEARCH_LIMITS.bibliographyCharacters);
  const input = Array.from({ length: RESEARCH_LIMITS.lines + 1 }, () => line(''));
  assert.equal(buildDocumentMap(input).truncated, true);
});

check('mention cap is exact, duplicates stay distinct and totals remain consistent', () => {
  const map = buildDocumentMap(Array.from({ length: 800 }, (_, index) => line('[1-256]', 1, index / 1000)));
  assert.equal(map.mentions.length, RESEARCH_LIMITS.mentions);
  assert.equal(map.truncated, true);
  assert.equal(map.pages[0].citationCount, RESEARCH_LIMITS.mentions);
  assert.equal(map.edges.reduce((total, edge) => total + edge.count, 0), RESEARCH_LIMITS.mentions);
});

check('excerpts are bounded and preserve the citation and source coordinates', () => {
  const text = 'prefix '.repeat(90) + '[42]' + ' suffix'.repeat(90);
  const mention = buildDocumentMap([line(text, 8, 0.73, 0.22)]).mentions[0];
  assert.ok(mention.text.length <= RESEARCH_LIMITS.excerptCharacters);
  assert.match(mention.text, /\[42\]/);
  assert.equal(mention.page, 8);
  assert.equal(mention.x, 0.22);
  assert.equal(mention.y, 0.73);
  assert.equal(text.slice(mention.start, mention.end), '[42]');
});

check('DOI and prefixed modern/legacy arXiv candidates are local and punctuation-aware', () => {
  const selection = 'See (https://doi.org/10.1234/AbC(foo)). DOI:10.1234/abc(foo); arXiv: 2401.12345v2 and https://arxiv.org/pdf/hep-th/9901001v3.pdf.';
  assert.deepEqual(extractDois(selection), ['10.1234/AbC(foo)']);
  assert.deepEqual(extractArxivIds(selection), ['2401.12345v2', 'hep-th/9901001v3']);
  for (const identifier of extractSelectionIdentifiers(selection)) assert.equal(selection.slice(identifier.start, identifier.end), identifier.id);
  assert.deepEqual(extractArxivIds('arXiv:2413.12345 arxiv:2400.12345 arxiv:2401.123456'), []);
  assert.deepEqual(extractDois('x'.repeat(RESEARCH_LIMITS.selectionCharacters) + ' 10.1234/late'), []);
  assert.deepEqual(extractDois('not 10.12/abc or 10.1234/.'), []);
});

console.log(`${checks} research unit checks passed.`);
