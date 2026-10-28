import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { isDownloadBypass, isPdfResponse, viewerUrl } from '../../extension/policy.js';
import { manifestFor } from '../extension-targets.mjs';

const source = readFileSync(new URL('../../src/platform.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { validatePdfSource, isExtensionPage, closeCurrentExtensionTab } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
const schemes = ['chrome-extension:', 'moz-extension:', 'safari-web-extension:'];
await check('all extension schemes accept their own bundled PDF resources', () => {
  for (const scheme of schemes) assert.equal(validatePdfSource(`${scheme}//own/sample.pdf`, `${scheme}//own/index.html`).host, 'own');
});
await check('opaque extension origins cannot authorize another extension host', () => {
  for (const scheme of schemes) assert.throws(() => validatePdfSource(`${scheme}//other/sample.pdf`, `${scheme}//own/index.html`));
});
await check('web pages cannot fetch arbitrary extension URLs through the viewer', () => {
  for (const scheme of schemes) assert.throws(() => validatePdfSource(`${scheme}//own/sample.pdf`, 'https://reader.example/'));
});
await check('unsafe source schemes are rejected; web and file sources remain supported', () => {
  for (const source of ['javascript:alert(1)', 'data:application/pdf;base64,AA', 'about:blank']) assert.throws(() => validatePdfSource(source, 'https://reader.example'));
  for (const source of ['https://example.org/paper', 'http://localhost/paper', 'file:///papers/a.pdf']) assert.equal(validatePdfSource(source, 'https://reader.example').href, source);
});
await check('extension detection is scheme based, not user-agent based', () => {
  for (const scheme of schemes) assert.ok(isExtensionPage(`${scheme}//own/index.html`));
  assert.equal(isExtensionPage('https://reader.example'), false);
});
await check('browser Promise API closes only the current extension tab', async () => {
  globalThis.location = { href: 'moz-extension://own/index.html' };
  let removed;
  globalThis.browser = { tabs: { getCurrent: async () => ({ id: 17 }), remove: async id => { removed = id; } } };
  assert.equal(await closeCurrentExtensionTab(), true); assert.equal(removed, 17);
  delete globalThis.browser;
});
await check('Chrome Promise API works without the browser namespace', async () => {
  globalThis.location = { href: 'chrome-extension://own/index.html' };
  let removed;
  globalThis.chrome = { tabs: { getCurrent: async () => ({ id: 23 }), remove: async id => { removed = id; } } };
  assert.equal(await closeCurrentExtensionTab(), true); assert.equal(removed, 23); delete globalThis.chrome;
});
await check('web app never closes tabs through extension APIs', async () => {
  globalThis.location = { href: 'http://localhost/' }; assert.equal(await closeCurrentExtensionTab(), false); delete globalThis.location;
});
const details = { type: 'main_frame', method: 'GET', statusCode: 200, url: 'https://example.org/no-suffix?q=1#page=3', responseHeaders: [{ name: 'Content-Type', value: 'Application/PDF; charset=binary' }] };
await check('Firefox identifies successful PDF MIME responses without filename guessing', () => assert.ok(isPdfResponse(details)));
await check('HTML, subframes, POST, errors and bypass are not intercepted', () => {
  for (const change of [{ responseHeaders: [{ name: 'content-type', value: 'text/html' }] }, { type: 'sub_frame' }, { method: 'POST' }, { statusCode: 404 }, { url: 'https://example.org/a.pdf?pipit-download=1' }]) assert.equal(isPdfResponse({ ...details, ...change }), false);
});
await check('bypass requires the actual parameter, not a matching substring', () => {
  assert.ok(isDownloadBypass('https://example.org/paper?a=1&pipit-download=1#page=2'));
  assert.ok(isDownloadBypass('https://example.org/paper?pipit-download=1'));
  assert.equal(isDownloadBypass('https://example.org/paper?x=pipit-download=1'), false);
});
await check('viewer handoff preserves complete source queries and fragments', () => {
  const runtime = { getURL: file => `moz-extension://own/${file}` };
  assert.equal(viewerUrl(runtime, details.url), `moz-extension://own/index.html?source=${details.url}`);
  assert.throws(() => viewerUrl(runtime, 'javascript:alert(1)'));
});
const base = JSON.parse(readFileSync(new URL('../../public/manifest.json', import.meta.url), 'utf8'));
await check('Firefox uses event pages and blocking interception without Chrome DNR', () => {
  const result = manifestFor(base, 'firefox'); assert.ok(result.permissions.includes('webRequestBlocking')); assert.ok(!result.permissions.includes('declarativeNetRequestWithHostAccess'));
  assert.deepEqual(result.background.scripts, ['background.js']); assert.equal(result.minimum_chrome_version, undefined);
  assert.deepEqual(result.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
});
await check('Safari explicitly avoids unsupported blocking/header DNR permissions', () => {
  const result = manifestFor(base, 'safari'); assert.deepEqual(result.permissions, ['storage', 'activeTab', 'contextMenus']); assert.ok(!result.host_permissions.some(host => host.startsWith('file:')));
});
await check('browser manifests are isolated and unsupported targets fail closed', () => {
  assert.deepEqual(manifestFor(base, 'chrome'), base); assert.ok(base.background.service_worker); assert.throws(() => manifestFor(base, 'unknown'));
});

const callbacks = {}, opened = [], fetches = [];
globalThis.browser = {
  runtime: { getURL: file => `safari-web-extension://own/${file}`, onInstalled: { addListener: listener => { callbacks.install = listener; } } },
  action: { onClicked: { addListener: listener => { callbacks.action = listener; } } },
  contextMenus: { removeAll: async () => {}, create: async () => {}, onClicked: { addListener: listener => { callbacks.context = listener; } } },
  tabs: { create: async value => { opened.push(value.url); } },
};
const nativeFetch = globalThis.fetch;
const policy = `data:text/javascript;base64,${Buffer.from(readFileSync(new URL('../../extension/policy.js', import.meta.url), 'utf8')).toString('base64')}`;
const safari = readFileSync(new URL('../../extension/safari.js', import.meta.url), 'utf8').replace("'./extension-policy.js'", JSON.stringify(policy));
await import(`data:text/javascript;base64,${Buffer.from(safari).toString('base64')}`);
await check('Safari toolbar checks MIME using HEAD and opens the same reader', async () => {
  globalThis.fetch = async (url, options) => { fetches.push(options); return new Response(null, { headers: { 'content-type': 'application/pdf' } }); };
  await callbacks.action({ url: details.url }); assert.equal(fetches[0].method, 'HEAD'); assert.equal(fetches[0].credentials, 'include'); assert.equal(opened.at(-1), `safari-web-extension://own/index.html?source=${details.url}`);
});
await check('Safari sends HTML to article discovery rather than guessing PDF from a filename', async () => {
  globalThis.fetch = async () => new Response(null, { headers: { 'content-type': 'text/html' } });
  await callbacks.action({ url: 'https://example.org/html.pdf' }); assert.equal(opened.at(-1), 'safari-web-extension://own/index.html?article=https%3A%2F%2Fexample.org%2Fhtml.pdf');
});
await check('Safari link context menu provides explicit handoff without interception', () => {
  callbacks.context({ menuItemId: 'pipit-open-link', linkUrl: details.url }); assert.equal(opened.at(-1), `safari-web-extension://own/index.html?source=${details.url}`);
});
globalThis.fetch = nativeFetch; delete globalThis.browser;
for (const target of ['chrome', 'firefox']) await check(`${target} toolbar hands off article URLs and respects explicit downloads`, async () => {
  let action;
  const urls = [];
  const api = {
    runtime: { getURL: file => `${target === 'chrome' ? 'chrome' : 'moz'}-extension://own/${file}`, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    action: { onClicked: { addListener(listener) { action = listener; } } },
    contextMenus: { onClicked: { addListener() {} } },
    tabs: { create: async ({ url }) => { urls.push(url); } },
    declarativeNetRequest: { updateDynamicRules: async () => {} },
    webRequest: { onHeadersReceived: { addListener() {} } },
  };
  globalThis[target === 'chrome' ? 'chrome' : 'browser'] = api;
  const file = target === 'chrome' ? '../../public/background.js' : '../../extension/firefox.js';
  const background = readFileSync(new URL(file, import.meta.url), 'utf8').replace("'./extension-policy.js'", JSON.stringify(policy));
  await import(`data:text/javascript;base64,${Buffer.from(background).toString('base64')}`);
  const article = 'https://www.sciencedirect.com/science/article/pii/S0016236109004967?via%3Dihub';
  await action({ url: article }); assert.equal(new URL(urls.at(-1)).searchParams.get('article'), article);
  await action({ url: `${article}&pipit-download=1` }); assert.ok(!urls.at(-1).includes('?'));
  delete globalThis.chrome; delete globalThis.browser;
});
console.log(`${passed} platform checks passed.`);
