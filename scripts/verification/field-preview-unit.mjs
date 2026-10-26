import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function module(file) {
  const source = readFileSync(new URL(`../../src/${file}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { workId, normalizeWork, assembleNetwork, networkLayout, OpenAlexClient, suggestPaperQuery, citationLayers, citationRate, safePdfUrl, matchPaperCandidates } = await module('citation-network');
const { detectColumns, previewCrop } = await module('preview-region');
const { extractTextLines } = await module('text-lines');
let checks = 0;
const check = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
const raw = (id, references = []) => ({ id: `https://openalex.org/${id}`, display_name: `Paper ${id}`, publication_year: 2020, cited_by_count: 5, referenced_works: references, related_works: [], authorships: [] });
const seed = normalizeWork(raw('W1', ['W2', 'W2', 'invalid']));
await check('Suggested metadata remains editable and does not need a network request', () => { assert.equal(suggestPaperQuery('A real paper title', 'file.pdf'), 'A real paper title'); assert.equal(suggestPaperQuery('', 'my_paper.pdf'), 'my paper'); });
await check('Missing PDF titles fall back to locally detected first-page title lines', () => {
  assert.equal(suggestPaperQuery('', 'file.pdf', [{ text: 'Trace-based just-in-time', size: 18, x: .1, y: .12 }, { text: 'type specialization', size: 18, x: .1, y: .15 }, { text: 'Authors', size: 11, x: .1, y: .2 }, { text: 'Header', size: 30, x: .1, y: .02 }]), 'Trace-based just-in-time type specialization');
});
const reference = normalizeWork(raw('W2')), citing = normalizeWork(raw('W3', ['W1'])), related = normalizeWork(raw('W4'));
await check('OpenAlex IDs are normalized and external hosts rejected', () => { assert.equal(workId('https://openalex.org/W123'), 'W123'); assert.equal(workId('https://evil.example/W123'), null); assert.equal(workId('W123<script>'), null); });
await check('Provider normalization rejects malformed records and unsafe links', () => { assert.equal(normalizeWork(null), null); assert.equal(normalizeWork({}), null); assert.equal(normalizeWork({ ...raw('W5'), doi: 'javascript:alert(1)' }).doi, ''); assert.deepEqual(seed.references, ['W2']); });
const network = assembleNetwork(seed, [reference], [citing], [related]);
await check('Citation arrows preserve direction and exclude similarity-only edges', () => { assert.deepEqual(network.edges, [{ from: 'W1', to: 'W2' }, { from: 'W3', to: 'W1' }]); assert.equal(network.works.length, 4); });
await check('Network layout is deterministic, bounded and seeded', () => { const positions = networkLayout(network); assert.deepEqual(positions, networkLayout(network)); assert.equal(positions[0].work.id, 'W1'); assert.ok(positions.every(node => node.x >= 0 && node.x <= 1000 && node.y >= 0 && node.y <= 610)); });
const requests = [];
const client = new OpenAlexClient(async (url, options) => { requests.push({ url, options }); return Response.json(url.includes('/works/W1?') || url.includes('doi.org') ? raw('W1') : { results: [raw('W2')] }); });
await check('Search is explicit, bounded, credential-free and DOI-aware', async () => { await client.search('A title & a query', new AbortController().signal); assert.equal(new URL(requests[0].url).searchParams.get('search'), 'A title & a query'); assert.equal(requests[0].options.credentials, 'omit'); assert.equal(requests[0].options.referrerPolicy, 'no-referrer'); const works = await client.search('doi:10.1234/example', new AbortController().signal); assert.equal(works[0].id, 'W1'); });
await check('Short searches do not send any request', async () => { const before = requests.length; await assert.rejects(client.search('a', new AbortController().signal)); assert.equal(requests.length, before); });
await check('Rate limits become an actionable error without a retry storm', async () => { let calls = 0; const limited = new OpenAlexClient(async () => { calls++; return new Response('', { status: 429 }); }); await assert.rejects(limited.search('test', new AbortController().signal), /rate-limiting/); assert.equal(calls, 1); });
await check('Partial neighborhood failures are surfaced, not silently complete', async () => { const partial = new OpenAlexClient(async () => new Response('', { status: 403 })); const result = await partial.neighborhood({ ...seed, related: ['W4'] }, new AbortController().signal); assert.equal(result.warnings.length, 3); assert.equal(result.works.length, 1); });
await check('Cancelled neighborhoods do not dispatch more requests', async () => { const abort = new AbortController(); abort.abort(); const before = requests.length; await assert.rejects(client.neighborhood(seed, abort.signal)); assert.equal(requests.length, before); });
const boxes = Array.from({ length: 10 }, (_, index) => [.08, .54].map(x => ({ x, y: .1 + index * .025, width: .34, height: .012, text: 'Substantial paragraph text on this line.' }))).flat();
await check('Column reading order tolerates equation labels close to the learned gutter', () => {
  const items = Array.from({ length: 5 }, (_, row) => [50, 323].map(x => ({ x, y: 80 + row * 20, width: 184, text: 'Substantial paragraph text within its column.' }))).flat();
  items.push({ x: 100, y: 250, width: 62, text: 'E = m c^2' }, { x: 270, y: 250, width: 13, text: '(1)' }, { x: 365, y: 250, width: 96, text: 'a^2 + b^2 = c^2' }, { x: 555, y: 250, width: 13, text: '(2)' });
  const lines = extractTextLines(items, 1, 612, 792).filter(line => line.y === 250 / 792);
  assert.equal(lines.length, 2); assert.match(lines[0].text, /\(1\)$/); assert.match(lines[1].text, /\(2\)$/);
});
await check('Two-column evidence requires sustained text on both sides', () => { assert.equal(detectColumns(boxes), true); assert.equal(detectColumns(boxes.filter(box => box.x < .5)), false); assert.equal(detectColumns(boxes.slice(0, 4)), false); });
const image = { width: 600, height: 800, data: new Uint8ClampedArray(600 * 800 * 4).fill(255) };
function rectangle(left, top, width, height) { for (let ypos = top; ypos < top + height; ypos++) for (let xpos = left; xpos < left + width; xpos++) { const offset = (ypos * image.width + xpos) * 4; image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 0; } }
rectangle(60, 395, 180, 10); rectangle(340, 395, 180, 10);
await check('Equation previews choose the target column and isolate a vertical block', () => { for (const [x, side] of [[.1, 'left'], [.8, 'right']]) { const crop = previewCrop(boxes, image, { x, y: .5, label: 'Equation (2)' }); assert.equal(crop.column, side); assert.ok(crop.width < .5 && crop.height < .15); assert.ok(crop.y <= .5 && crop.y + crop.height > .5); } });
await check('Unknown target columns and image-only pages do not guess a column', () => { assert.equal(previewCrop(boxes, image, { y: .5, label: 'Citation' }).column, 'full'); assert.equal(previewCrop([], image, { x: .8, y: .5, label: 'Citation' }).column, 'full'); });
await check('Full-width content crossing the gutter is not clipped to a column', () => { rectangle(250, 380, 110, 35); assert.equal(previewCrop(boxes, image, { x: .8, y: .5, label: 'Figure 1' }).column, 'full'); });
await check('Full-page override always restores complete source bounds', () => { assert.deepEqual(previewCrop(boxes, image, { x: .8, y: .5, label: 'Equation 2' }, true), { x: 0, y: 0, width: 1, height: 1, column: 'full', cropped: false }); });
await check('Three-hop layers respect citation direction and ignore similarity links', () => {
  const chain = { ...network, edges: [{ from: 'W1', to: 'W2' }, { from: 'W2', to: 'W5' }, { from: 'W5', to: 'W6' }, { from: 'W3', to: 'W1' }, { from: 'W7', to: 'W3' }, { from: 'W8', to: 'W7' }] };
  assert.equal(citationLayers(chain, 'references', 3).get('W6').depth, 3);
  assert.equal(citationLayers(chain, 'references', 3).has('W3'), false);
  assert.equal(citationLayers(chain, 'citations', 3).get('W8').depth, 3);
  assert.equal(citationLayers(chain, 'both', 1).has('W5'), false);
  assert.equal(citationLayers(chain, 'both', 3).has('W4'), false);
});
await check('Cycles retain shortest hop distances and never expand beyond three', () => {
  const chain = { ...network, edges: [{ from: 'W1', to: 'W2' }, { from: 'W2', to: 'W1' }, { from: 'W2', to: 'W5' }, { from: 'W5', to: 'W6' }, { from: 'W6', to: 'W7' }] };
  const layers = citationLayers(chain, 'references', 99);
  assert.equal(layers.get('W1').depth, 0); assert.equal(layers.get('W6').depth, 3); assert.equal(layers.has('W7'), false);
});
await check('Citation-rate proxy is consistent, age adjusted and finite', () => {
  assert.equal(citationRate({ ...seed, citations: 120, year: 2021 }, 2026), 20);
  assert.equal(citationRate({ ...seed, citations: 120, year: 2026 }, 2026), 120);
  assert.equal(citationRate({ ...seed, citations: 0, year: null }, 2026), 0);
});
await check('PDF links reject scripts, credentials and insecure URLs', () => {
  for (const value of ['javascript:alert(1)', 'http://example.org/paper.pdf', 'https://user:secret@example.org/p.pdf', null]) assert.equal(safePdfUrl(value), '');
  assert.equal(normalizeWork({ ...raw('W9'), best_oa_location: { pdf_url: 'https://arxiv.org/pdf/2205.01833' } }).pdfUrl, 'https://arxiv.org/pdf/2205.01833');
});
await check('Expansion is bounded, credential-free, and cancellation stops further hops', async () => {
  const calls = [];
  const expanding = new OpenAlexClient(async (url, options) => {
    calls.push({ url, options });
    const filter = new URL(url).searchParams.get('filter');
    return Response.json({ results: filter.startsWith('openalex:') ? [raw('W5', ['W6'])] : [raw('W7', ['W2'])] });
  });
  const initial = assembleNetwork({ ...seed, references: ['W2'] }, [{ ...reference, references: ['W5'] }], [], []);
  const result = await expanding.expand(initial, 'references', 3, new AbortController().signal);
  assert.ok(calls.length <= 2 && result.works.length <= 120);
  assert.ok(calls.every(call => new URL(call.url).searchParams.get('filter').startsWith('openalex:') && call.options.credentials === 'omit'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(expanding.expand(initial, 'both', 3, controller.signal));
});
await check('Exact matches and matching edition families can open without redundant confirmation', () => {
  const original = { ...seed, authors: ['A. Author', 'B. Author', 'C. Author'], citations: 200 };
  assert.equal(matchPaperCandidates([original], original.title).work.id, original.id);
  const duplicate = { ...original, id: 'W99', citations: 4 };
  assert.deepEqual(matchPaperCandidates([duplicate, original], original.title), { work: original, editions: true });
});
await check('Similar titles or conflicting authors and years still require confirmation', () => {
  const original = { ...seed, authors: ['A', 'B', 'C'] };
  assert.equal(matchPaperCandidates([original], 'A different title').work, undefined);
  assert.equal(matchPaperCandidates([original, { ...original, id: 'W99', year: 2025 }], original.title).work, undefined);
  assert.equal(matchPaperCandidates([original, { ...original, id: 'W99', authors: ['D', 'E', 'F'] }], original.title).work, undefined);
});
await check('Both-direction expansion balances earlier and citing frontier papers', async () => {
  const references = Array.from({ length: 20 }, (_, index) => normalizeWork(raw(`W${index + 10}`, ['W500'])));
  const citations = Array.from({ length: 20 }, (_, index) => normalizeWork(raw(`W${index + 100}`, ['W1'])));
  const calls = [];
  const expanding = new OpenAlexClient(async url => { calls.push(new URL(url)); return Response.json({ results: [] }); });
  await expanding.expand(assembleNetwork(seed, references, citations, []), 'both', 2, new AbortController().signal);
  const ids = calls.find(url => url.searchParams.get('filter').startsWith('cites:')).searchParams.get('filter');
  assert.ok(ids.includes('W10') && ids.includes('W100')); assert.ok(ids.split('|').length <= 16);
});
await check('Rate-limited expansion stops without exhausting remaining requests', async () => {
  let calls = 0;
  const expanding = new OpenAlexClient(async () => { calls++; return new Response('', { status: 429 }); });
  const result = await expanding.expand(assembleNetwork(seed, [{ ...reference, references: ['W9'] }], [], []), 'both', 3, new AbortController().signal);
  assert.equal(calls, 1); assert.ok(result.warnings[0].includes('rate-limiting'));
});
await check('Institutional PDF metadata is retained even when not open access', () => {
  const work = normalizeWork({ ...raw('W99'), primary_location: { is_oa: false, pdf_url: 'https://publisher.example/subscriber.pdf', landing_page_url: 'https://publisher.example/article/99' } });
  assert.equal(work.pdfUrl, 'https://publisher.example/subscriber.pdf'); assert.equal(work.landingUrl, 'https://publisher.example/article/99');
});
console.log(`${checks} field-network and preview-region checks passed.`);
