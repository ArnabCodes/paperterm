import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const endpoint = process.env.GECKODRIVER_URL || 'http://127.0.0.1:4444';
const artifactPrefix = process.env.PIPIT_VERIFY_PREFIX || 'v090';
const binary = process.env.FIREFOX_BINARY || resolve('output/browser-tools/firefox/core/firefox.exe');
const downloads = resolve(`output/playwright/firefox-downloads-${Date.now()}`);
mkdirSync(downloads, { recursive: true });
let session;
const checks = [];
async function request(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = (await response.json()).value;
  if (!response.ok || result?.error) throw new Error(`${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
const call = (method, path, body) => request(method, `/session/${session}${path}`, body);
const execute = (script, ...args) => call('POST', '/execute/sync', { script, args });
const navigate = url => call('POST', '/url', { url });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function wait(expression, label) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await execute(`return Boolean(${expression})`)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function key(value) {
  const special = { Escape: '\uE00C', Enter: '\uE007', F1: '\uE031', F6: '\uE036' };
  const actual = special[value] || value;
  await call('POST', '/actions', { actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: actual }, { type: 'keyUp', value: actual }] }] });
}
async function fill(selector, value) {
  await execute('const input=document.querySelector(arguments[0]);input.value=arguments[1];input.dispatchEvent(new Event("input",{bubbles:true}));', selector, value);
}
function check(value, label) { assert.ok(value, label); checks.push(label); }

try {
  const created = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': { binary, args: ['-headless', '--remote-allow-system-access'], prefs: {
    'browser.download.dir': downloads, 'browser.download.folderList': 2, 'browser.download.alwaysOpenPanel': false,
    'browser.helperApps.neverAsk.saveToDisk': 'application/pdf,application/octet-stream',
    'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.enabled': false, 'app.update.auto': false,
  } } } } });
  session = created.sessionId;
  writeFileSync(`output/playwright/${artifactPrefix}-firefox-active-session.json`, JSON.stringify({ session }));
  await call('POST', '/window/rect', { width: 1440, height: 960 });
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const addon = await call('POST', '/moz/addon/install', { path: resolve(`artifacts/pipit-${version}-firefox.xpi`), temporary: true });
  check(addon === 'pipit@arnabcodes', 'Unsigned Firefox development XPI installs temporarily');
  await navigate('http://127.0.0.1:4180/paper?first=one&second=two#page=3');
  await wait('document.querySelector("#page-total")?.textContent === "6" && document.querySelector("#engine-status")?.textContent.includes("Ready") && document.querySelector("#loading")?.hidden && document.querySelector("#page-current")?.textContent === "3"', 'PDF interception and initial page restoration');
  const url = await execute('return location.href');
  check(url.startsWith('moz-extension://'), 'Firefox MIME-based default viewer redirects into the extension');
  check(url.includes('first=one&second=two') && await execute('return document.querySelector("#page-current").textContent') === '3', 'Queries and PDF page fragments survive the redirect');
  await key('e'); await fill('#palette-input', '2'); await wait('document.querySelector("[role=option]")', 'equation result'); await key('Enter');
  await wait('document.querySelector("#portal")?.getAttribute("aria-busy") === "false"', 'equation preview');
  check((await execute('return document.querySelector("#portal-title").textContent')).includes('Equation (2)'), 'Rust WASM lookup and original-page previews work under Firefox CSP');
  check(await execute('const node=document.querySelector("#portal-scroll");return node.scrollWidth<=node.clientWidth+1'), 'Firefox quick look shows complete line width');
  await key('Escape'); await key(','); await execute('document.querySelector("[data-theme=dracula]").click()'); await key('Escape');
  await wait('document.querySelector("canvas[data-color-backend]") && !document.querySelector("canvas[data-recoloring], canvas[data-color-pending]")', 'themed raster');
  const color = await execute('const canvas=document.querySelector(".canvasWrapper canvas");return {backend:canvas.dataset.colorBackend,pixel:Array.from(canvas.getContext("2d").getImageData(5,5,1,1).data)}');
  check(color.pixel.slice(0, 3).join(',') === '40,42,54', 'Firefox applies real theme pixels with local GPU/CPU capability selection');
  await key('g'); await key('2'); await wait('document.querySelector(".pdfViewer .spread")', 'spread');
  check(true, 'Keyboard two-page spreads work in Firefox'); await key('g'); await key('2');
  await key('F1'); check(await execute('return document.querySelectorAll("#help-keys .help-group").length') === 8, 'Shared keyboard guide renders all eight sections in Firefox');
  await key('Escape');
  const input = await call('POST', '/element', { using: 'css selector', value: '#file-input' });
  await call('POST', `/element/${input['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: resolve('output/playwright/fixtures/tracemonkey.pdf') });
  await wait('document.querySelector("#page-total")?.textContent === "14" && document.querySelector("#engine-status")?.textContent.includes("Ready")', 'real local PDF');
  check(true, 'Local file picker opens and indexes the 14-page research fixture');
  await key('/'); await fill('#find-input', 'JavaScript'); await wait('document.querySelector(".textLayer .highlight")', 'real PDF search');
  check(true, 'Research-paper search highlights work in Firefox'); await key('Escape');
  const columnInput = await call('POST', '/element', { using: 'css selector', value: '#file-input' });
  await call('POST', `/element/${columnInput['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: resolve('output/playwright/fixtures/column-previews.pdf') });
  await wait('document.querySelector("#page-total")?.textContent === "1" && document.querySelector("#engine-status")?.textContent.includes("Ready")', 'column fixture');
  await key('e'); await fill('#palette-input', '2'); await wait('document.querySelector("[role=option]")', 'column equation'); await key('Enter');
  await wait('document.querySelector("#portal")?.getAttribute("aria-busy") === "false"', 'cropped column');
  check(await execute('return document.querySelector("#portal-canvas").dataset.column === "right" && getComputedStyle(document.querySelector(".portal-heading")).display === "none"'), 'Firefox renders a content-only right-column equation crop');
  check(await execute('const scroll=document.querySelector("#portal-scroll");return scroll.scrollTop > 0 && scroll.scrollHeight > scroll.clientHeight + 100'), 'Firefox object preview keeps independently scrollable page context');
  const mainScroll = await execute('return document.querySelector("#viewer-container").scrollTop');
  await key('j');
  check(await execute('return document.querySelector("#viewer-container").scrollTop') === mainScroll, 'Firefox preview scrolling preserves main reading position');
  await key('g'); await key('P'); await wait('document.querySelector("#portal-canvas")?.dataset.column === "full" && document.querySelector("#portal")?.getAttribute("aria-busy") === "false"', 'full-page override');
  check(true, 'Firefox full-page preview override remains keyboard-accessible');
  await key('Escape'); await key('F');
  check(await execute('return document.querySelectorAll(".link-hint").length > 0'), 'Firefox unified F lens includes unlinked text references');
  await key('Escape'); await key('F6');
  const coreBefore = await execute('return document.querySelector(".dock-core").getBoundingClientRect().x');
  await execute('document.querySelector("[data-dock-group=layout]").click()');
  check(await execute('return !document.querySelector("#dock-details").hidden && document.querySelector(".dock-core").getBoundingClientRect().x') === coreBefore, 'Firefox grouped dock never shifts core controls');
  await execute('document.querySelector("[data-dock-run=spread]").click()');
  check(await execute('return !!document.querySelector(".spread")'), 'Firefox grouped dock executes reading commands');
  await key('g'); await key('2'); await key('Escape');
  await key('Q'); await execute('document.querySelector(".notebook-add").click()');
  await execute('const input=[...document.querySelectorAll(".notebook-note")].at(-1);input.value="Firefox portable note";input.dispatchEvent(new Event("input",{bubbles:true}));');
  const noteCount = await execute('return document.querySelectorAll(".notebook-card").length');
  await execute('[...document.querySelectorAll(".notebook-delete")].at(-1).click();document.querySelector(".notebook-undo").click()');
  check(await execute('return document.querySelectorAll(".notebook-card").length') === noteCount, 'Firefox notebook undo restores deleted notes');
  await execute('document.querySelector(".notebook-backup").click()');
  for (let attempt = 0; attempt < 100; attempt++) {
    const file = readdirSync(downloads).find(name => name.endsWith('.json'));
    try { if (file && JSON.parse(readFileSync(resolve(downloads, file), 'utf8')).annotationMode === 'sidecar-only') break; } catch { /* Browser may create the destination before completing the download. */ }
    await pause(100);
  }
  const backupPath = resolve(downloads, readdirSync(downloads).find(name => name.endsWith('.json')) || 'missing-backup.json');
  check(existsSync(backupPath) && JSON.parse(readFileSync(backupPath, 'utf8')).annotationMode === 'sidecar-only', 'Firefox exports a real portable notebook sidecar');
  await execute('[...document.querySelectorAll(".notebook-delete")].at(-1).click()');
  const backupInput = await call('POST', '/element', { using: 'css selector', value: '.notebook-import-file' });
  await call('POST', `/element/${backupInput['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: backupPath });
  await wait(`document.querySelectorAll(".notebook-card").length === ${noteCount}`, 'sidecar restored');
  check(await execute('return [...document.querySelectorAll(".notebook-note")].at(-1).value') === 'Firefox portable note', 'Firefox annotation backup round trip restores literal anchored notes');
  await key('Escape'); await execute('const input=document.querySelector("#field-auto");input.checked=false;input.dispatchEvent(new Event("change"));'); await key('g'); await key('c');
  await wait('document.querySelector("#field-dialog")?.open', 'field map');
  check(await execute('return document.querySelector("#field-status").textContent.includes("No network request")'), 'Firefox field map waits for explicit metadata search');
  await fill('#field-query', '10.1145/1542476.1542528'); await execute('document.querySelector("#field-search button").click()');
  await wait('document.querySelector(".field-match")', 'live OpenAlex match');
  await execute('document.querySelector(".field-match").click()');
  await wait('!document.querySelector("#field-map").hidden && document.querySelectorAll(".field-node").length > 3', 'live field network');
  check(await execute('return document.querySelectorAll(".field-node.citation").length > 0 && document.querySelectorAll(".field-node.reference").length > 0'), 'Firefox extension loads real OpenAlex citation neighbors under its CSP');
  await execute('document.querySelector("#field-direction").value="citations";document.querySelector("#field-direction").dispatchEvent(new Event("change"));');
  check(await execute('return document.querySelectorAll(".field-node.reference").length === 0 && document.querySelectorAll(".field-node.citation").length > 0'), 'Firefox can isolate papers citing the selected paper');
  await execute('const input=document.querySelector("#field-depth");input.value="3";input.dispatchEvent(new Event("change"));');
  await wait('document.querySelector("#field-status").textContent.includes("Up to 3 hops")', 'live three-hop citations');
  check(await execute('return Array.from(document.querySelectorAll(".field-node")).some(node => node.dataset.depth === "2")'), 'Firefox fetches actual higher-order citing works');
  await execute('document.querySelector("#field-view").click()');
  check(await execute('return !document.querySelector("#field-list").hidden && document.querySelector("#field-svg").hasAttribute("hidden")'), 'Firefox offers an accessible paper list without duplicate visible graph');
  await key('Escape');
  writeFileSync(`output/playwright/${artifactPrefix}-firefox-reader.png`, Buffer.from(await call('GET', '/screenshot'), 'base64'));
  await key(':'); await fill('#palette-input', 'Tutor'); await key('Enter');
  await wait('document.querySelector("#tutor-intro")?.open', 'Tutor command');
  check(true, 'Firefox :Tutor opens the shared tutorial intro');
  await key('Enter');
  await wait('JSON.parse(window.render_game_to_text()).mode === "tutor"', 'LaTeX tutorial ready');
  check(await execute('return document.querySelector("#page-total").textContent') === '6', 'Firefox loads the bundled LaTeX paper under extension CSP');
  check(await execute('return JSON.parse(window.render_game_to_text()).hardMode && !document.querySelector(".tutor-hint").hidden'), 'Firefox beginner training shows steps and enables hard mode');
  await key('j'); await key('k');
  await wait('JSON.parse(window.render_game_to_text()).completed.includes("move")', 'keyboard movement lesson');
  await key('Enter');
  await key('p'); await fill('#palette-input', '2'); await key('Enter');
  await wait('JSON.parse(window.render_game_to_text()).completed.includes("navigate")', 'tutorial navigation award');
  check(await execute('return JSON.parse(window.render_game_to_text()).xp') === 35, 'Firefox Tutor awards actual keyboard movement and navigation');
  await execute("document.querySelector('[data-mission=\"5\"]').click()");
  await wait('document.querySelector("#tutor-panel")?.dataset.preparing === "false" && !document.querySelector("#portal").hidden && document.querySelector("#portal").getAttribute("aria-busy") === "false"', 'restore equation preview for selected lesson six');
  await wait('document.querySelector("#page-current").textContent === "2"', 'lesson six origin');
  await key('Enter'); await wait('document.querySelector("#page-current").textContent === "3"', 'follow equation');
  await key('g'); await key('h');
  try { await wait('JSON.parse(window.render_game_to_text()).completed.includes("trail") && document.querySelector("#page-current").textContent === "2"', 'home-row history return'); }
  catch (error) { console.error('History diagnostic:', await execute('return {state:window.render_game_to_text(),page:document.querySelector("#page-current").textContent,top:document.querySelector("#viewer-container").scrollTop,active:document.activeElement.id,toast:document.querySelector("#toast").textContent}')); throw error; }
  check(true, 'Firefox direct lesson six restores the preview and returns to its source using g h');
  await key('Escape');
  check(await execute('return JSON.parse(window.render_game_to_text()).mode === "paused" && !JSON.parse(window.render_game_to_text()).hardMode'), 'Firefox Escape opens a safe pause screen and restores pointer input');
  await key('Enter');
  check(await execute('return JSON.parse(window.render_game_to_text()).mode === "tutor" && JSON.parse(window.render_game_to_text()).hardMode'), 'Firefox Enter resumes the game from pause');
  await navigate(`${url.split("?")[0]}?tutor=1`);
  await wait('document.querySelector("#tutor-intro")?.open', 'reopen course selection');
  await execute('document.querySelector("[data-tutor=advanced]").click()');
  await wait('JSON.parse(window.render_game_to_text()).mission === "quickmark"', 'advanced course');
  await key('m'); await key('a'); await key('p'); await fill('#palette-input', '3'); await key('Enter');
  await wait('document.querySelector("#page-current").textContent === "3"', 'advanced waypoint destination');
  await key("'"); await key('a'); await wait('JSON.parse(window.render_game_to_text()).completed.includes("quickmark")', 'advanced quickmark return');
  await key('Enter'); await key(']'); await wait('JSON.parse(window.render_game_to_text()).completed.includes("ruler-adjust")', 'advanced ruler');
  await key('Enter'); await key('z'); await wait('JSON.parse(window.render_game_to_text()).completed.includes("focus")', 'advanced focus mode');
  check(true, 'Firefox advanced course verifies quickmark, ruler and focus with real keys');
  await navigate(`${url.split("?")[0]}?tutor=1`);
  await wait('document.querySelector("#tutor-intro")?.open', 'relay selection');
  await execute('document.querySelector("[data-tutor=relay]").click()');
  await wait('JSON.parse(window.render_game_to_text()).route === "relay" && JSON.parse(window.render_game_to_text()).mode === "tutor"', 'relay starts');
  check(await execute('return JSON.parse(window.render_game_to_text()).course.length') === 5, 'Firefox opens a five-challenge Feather Relay');
  await navigate('http://127.0.0.1:4180/html.pdf');
  check(await execute('return document.querySelector("h1")?.textContent') === 'Not a PDF', 'An HTML page named pdf is not hijacked');
  await navigate('http://127.0.0.1:4180/attachment');
  await wait('document.querySelector("#page-total")?.textContent === "6"', 'inline attachment');
  check(!readdirSync(downloads).some(name => name.endsWith('.pdf')), 'Attachment PDF opens inline without creating a PDF download');
  await key('g'); await key('D');
  for (let attempt = 0; attempt < 100 && !readdirSync(downloads).some(name => name.endsWith('.pdf')); attempt++) await pause(100);
  check(readdirSync(downloads).some(name => name.endsWith('.pdf')), 'Explicit download still saves the original PDF');
  await navigate('http://127.0.0.1:4180/paper?pipit-download=1');
  check((await execute('return location.href')).startsWith('http:'), 'Download bypass leaves the browser in control');
  await navigate(pathToFileURL(resolve('dist/sample.pdf')).href);
  await pause(1000);
  const fileUrlHandoff = await execute('return {url:location.href,reader:!!document.querySelector("#page-total"),pages:document.querySelector("#page-total")?.textContent,toast:document.querySelector("#toast")?.textContent}');
  const viewer = url.split('?')[0];
  await call('POST', '/window/new', { type: 'tab' });
  const handles = await call('GET', '/window/handles');
  await call('POST', '/window', { handle: handles.at(-1) });
  await navigate(`${viewer}?demo=1`); await wait('document.querySelector("#page-total")?.textContent === "6"', 'same-extension sample');
  const before = handles.length;
  await key('x').catch(() => {});
  check((await call('GET', '/window/handles')).length === before - 1, 'x closes only the current Firefox extension tab');
  const result = { passed: checks.length, checks, browser: created.capabilities.browserVersion, colorBackend: color.backend, downloads, fileUrlHandoff };
  writeFileSync(`output/playwright/${artifactPrefix}-firefox-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  const diagnostic = { error: String(error), completedChecks: checks };
  try { diagnostic.page = await execute('const container=document.querySelector("#viewer-container"), page=[...document.querySelectorAll(".page")].find(node=>node.dataset.pageNumber==="3");return {url:location.href,text:document.body.innerText.slice(0,2000),current:document.querySelector("#page-current")?.textContent,ready:document.querySelector("#engine-status")?.textContent,loading:document.querySelector("#loading")?.hidden,top:container?.scrollTop,pageTop:page?.offsetTop,parent:page?.offsetParent?.id,rect:page?.getBoundingClientRect().toJSON()}'); } catch {}
  writeFileSync(`output/playwright/${artifactPrefix}-firefox-error.json`, JSON.stringify(diagnostic, null, 2));
  throw error;
} finally {
  if (session) await request('DELETE', `/session/${session}`).catch(() => {});
}
