import 'pdfjs-dist/web/pdf_viewer.css';
import './style.css';
import { shell, icon } from './ui';
import { Reader, type Location, type OutlineEntry } from './reader';
import { ReferenceEngine } from './engine';
import { defaults, defaultReadingState, loadPreferences, readStored, saveStored } from './preferences';
import { clearBooks, listBooks, readBook, saveBook } from './library';
import { element, escapeHtml as esc, type ReferenceHit, type ReferenceKind, type ReadingState } from './types';

element('#app').innerHTML = shell();
let preferences = loadPreferences();
const reader = new Reader(element<HTMLDivElement>('#viewer-container'), preferences);
const engine = new ReferenceEngine();
let state: ReadingState = defaultReadingState();
let fingerprint = '';
let fileName = 'document.pdf';
let outline: OutlineEntry[] = [];
let navigationTab = 'outline';
let opening = false;
let loadSequence = 0;
let initialHashConsumed = false;
let indexed = false;
let hasText = false;
let toastTimer: ReturnType<typeof setTimeout>;
let portalTarget: { page: number; y: number; label: string } | null = null;
const backward: Location[] = [];
const forward: Location[] = [];
const palette = element<HTMLDialogElement>('#palette');
const paletteInput = element<HTMLInputElement>('#palette-input');
let paletteMode = 'commands';
let choices: { title: string; detail: string; key?: string; action: (jump: boolean) => void }[] = [];
let selected = 0;
let querySequence = 0;
let choiceUpdate: Promise<void> = Promise.resolve();
let returnFocus: HTMLElement | null = null;
let prefix = '';
let prefixTimer: ReturnType<typeof setTimeout>;
let hints: { label: string; action: () => void; button: HTMLElement }[] = [];
let hintPrefix = '';
let hintScrollTop = 0;
let hintScrollLeft = 0;

function toast(message: string) {
  clearTimeout(toastTimer);
  element('#toast').textContent = message;
  element('#toast').hidden = false;
  toastTimer = setTimeout(() => { element('#toast').hidden = true; }, 4200);
}

function fail(error: unknown) { console.error(error); toast(error instanceof Error ? error.message : String(error)); }
function saveState() {
  if (!fingerprint || opening || !reader.document) return;
  state.page = reader.viewer.currentPageNumber;
  state.offset = reader.offset;
  state.zoom = reader.viewer.currentScaleValue;
  if (!saveStored(`paperterm.reading.${fingerprint}`, state)) toast('Browser storage is full. This reading position could not be saved.');
}

function pushHistory() {
  if (!reader.document) return;
  const current = reader.location;
  const last = backward.at(-1);
  if (!last || last.page !== current.page || Math.abs(last.top - current.top) > 5) backward.push(current);
  if (backward.length > 100) backward.shift();
  forward.length = 0;
}

function goTo(page: number, ypos?: number) { pushHistory(); reader.goTo(page, ypos); saveState(); }

function historyMove(back: boolean) {
  const source = back ? backward : forward;
  const target = source.pop();
  if (!target) { toast(back ? 'You are at the beginning of your reading trail.' : 'No forward position yet.'); return; }
  (back ? forward : backward).push(reader.location);
  reader.restore(target); saveState();
}

async function openDocument(source: string | File | Blob, name = 'document.pdf', libraryId?: string) {
  clearTimeout(toastTimer); element('#toast').hidden = true;
  const sequence = ++loadSequence;
  saveState();
  opening = true; indexed = false; hasText = false;
  backward.length = forward.length = 0;
  engine.index([]);
  closePortal(); closeHints(); closeFind();
  element('#loading').hidden = false;
  element('#loading-label').textContent = 'Opening your document…';
  element('#welcome').hidden = true;
  element('#reader').hidden = false;
  element('#reader-toolbar').hidden = false;
  document.body.classList.add('has-document');
  element('#engine-status').textContent = 'Opening…';
  try {
    if (typeof source === 'string') {
      const url = new URL(source, location.href);
      if (!['http:', 'https:', 'file:', 'chrome-extension:'].includes(url.protocol)) throw new Error('Open a local PDF or an HTTP(S) PDF URL. This URL type is not supported.');
      if (url.protocol === 'chrome-extension:' && url.origin !== location.origin) throw new Error('Cannot open resources from another extension.');
    }
    const bytes = typeof source === 'string' ? source : new Uint8Array(await source.arrayBuffer());
    if (sequence !== loadSequence) return;
    const pdf = await reader.load(bytes, 'auto', 1);
    if (!pdf || sequence !== loadSequence) return;
    fingerprint = pdf.fingerprints[0] || name;
    state = readStored(`paperterm.reading.${fingerprint}`, defaultReadingState());
    if (!state || typeof state.page !== 'number' || !Array.isArray(state.bookmarks) || !state.marks) state = defaultReadingState();
    const requestedPage = initialHashConsumed ? 0 : Number(new URLSearchParams(location.hash.slice(1)).get('page'));
    initialHashConsumed = true;
    reader.viewer.currentScaleValue = state.zoom || 'auto';
    if (requestedPage > 0) reader.goTo(requestedPage);
    else reader.restoreFraction(state.page, state.offset);
    fileName = name;
    document.title = `${name.replace(/\.pdf$/i, '')} — Paperterm`;
    element('#document-name').textContent = name.replace(/\.pdf$/i, '');
    element('#document-detail').textContent = `${pdf.numPages} pages · Your private reading space`;
    element('#page-total').textContent = String(pdf.numPages);
    element('#page-current').textContent = String(reader.viewer.currentPageNumber);
    outline = await reader.outline();
    if (sequence !== loadSequence) return;
    renderNavigation();
    opening = false;
    saveState();
    reader.container.focus();
    if (source instanceof Blob) {
      try {
        const saved = await saveBook({ id: libraryId || fingerprint, name, blob: source, updated: Date.now() });
        if (!saved) toast('Opened. Files over 25 MB are not kept in the recent library.');
      } catch { toast('Opened. Browser storage could not keep a copy for the recent library.'); }
    }
  } catch (error) {
    if (sequence !== loadSequence) return;
    opening = false;
    element('#welcome').hidden = false; element('#reader').hidden = true; element('#reader-toolbar').hidden = true;
    document.body.classList.remove('has-document', 'focus-mode');
    element('#document-name').textContent = 'Your reading workspace';
    element('#document-detail').textContent = 'A little less interface. A little more focus.';
    document.title = 'Paperterm — a quiet PDF workspace';
    element('#exit-focus').hidden = true;
    const detail = typeof source === 'string' && source.startsWith('file:') ? ' Enable “Allow access to file URLs” in the extension details, or press O to choose the file.' : typeof source === 'string' && /^https?:/.test(source) ? ' The standalone app needs a CORS-enabled URL. Download the PDF and open it locally if access is denied.' : '';
    toast(`Could not open this PDF. ${error instanceof Error ? error.message : String(error)}${detail}`);
  } finally {
    if (sequence === loadSequence) element('#loading').hidden = true;
  }
}

reader.onProgress = percent => { if (percent > 0) element('#loading-label').textContent = `Opening your document… ${Math.min(100, percent)}%`; };
reader.onPage = page => {
  element('#page-current').textContent = String(page);
  updateBookmarkButton();
  saveState();
};
reader.onZoom = zoom => { element('#zoom-value').textContent = `${Math.round(zoom * 100)}%`; };
reader.onMatches = (current, total) => { element('#find-count').textContent = total ? `${current} of ${total}` : 'No matches'; };
reader.onIndex = (lines, complete) => {
  engine.index(lines); indexed = complete; hasText = lines.length > 0;
  element('#engine-status').textContent = complete ? hasText ? 'Local · Ready' : 'Image-only PDF' : 'Indexing references…';
  if (palette.open && ['equation', 'citation', 'figure'].includes(paletteMode)) void refreshChoices();
};
reader.onError = fail;
let passwordResolver: ((password: string | null) => void) | null = null;
reader.onPassword = wrong => new Promise(resolve => {
  passwordResolver = resolve;
  element('#password-error').textContent = wrong ? 'That password did not unlock the document. Try again.' : '';
  element<HTMLInputElement>('#password-input').value = '';
  element<HTMLDialogElement>('#password-dialog').showModal();
  element<HTMLInputElement>('#password-input').focus();
});
function finishPassword(password: string | null) { element<HTMLDialogElement>('#password-dialog').close(); passwordResolver?.(password); passwordResolver = null; }
element('#password-form').addEventListener('submit', event => { event.preventDefault(); finishPassword(element<HTMLInputElement>('#password-input').value); });
element('#password-dialog').addEventListener('cancel', event => { event.preventDefault(); finishPassword(null); });

function renderNavigation() {
  document.querySelectorAll('.sidebar-tabs button').forEach(tab => tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.action === navigationTab)));
  element('#sidebar-caption').textContent = navigationTab === 'bookmarks' ? 'YOUR READING TRAIL' : 'IN THIS DOCUMENT';
  if (navigationTab === 'bookmarks') {
    element('#navigation-list').innerHTML = state.bookmarks.length ? state.bookmarks.map((mark, index) => `<div class="bookmark-row"><button class="navigation-item" data-bookmark="${index}">${icon('mark')}<span>${esc(mark.name)}</span><small>${mark.page}</small></button><button class="delete-bookmark" data-delete-bookmark="${index}" aria-label="Remove bookmark on page ${mark.page}">×</button></div>`).join('') : '<p class="empty-state">Leave a little breadcrumb.<br/>Press <kbd>B</kbd> to bookmark a page.</p>';
  } else {
    element('#navigation-list').innerHTML = outline.length ? outline.map((entry, index) => `<button class="navigation-item" data-outline="${index}" style="--depth:${Math.min(entry.depth, 5)}"><span>${esc(entry.title)}</span></button>`).join('') : `<p class="empty-state">This PDF has no embedded outline.</p>${Array.from({ length: Math.min(reader.document?.numPages || 0, 100) }, (_, index) => `<button class="navigation-item" data-page="${index + 1}"><span>Page ${index + 1}</span></button>`).join('')}`;
  }
}
function updateBookmarkButton() {
  const active = state.bookmarks.some(mark => mark.page === reader.viewer.currentPageNumber);
  document.querySelector('[data-action="bookmark"]')?.setAttribute('aria-pressed', String(active));
}
function bookmark() {
  const page = reader.viewer.currentPageNumber;
  const existing = state.bookmarks.findIndex(mark => mark.page === page);
  if (existing >= 0) { state.bookmarks.splice(existing, 1); toast(`Bookmark removed from page ${page}`); }
  else { state.bookmarks.push({ page, name: `Page ${page}`, y: reader.offset }); state.bookmarks.sort((left, right) => left.page - right.page); toast(`Bookmarked page ${page}`); }
  saveState(); updateBookmarkButton(); renderNavigation();
}

function closePortal() {
  reader.cancelPreview(); element('#portal').hidden = true; document.body.classList.remove('has-portal'); portalTarget = null;
  resizeViewer();
}
async function showPortal(target: { page: number; y: number; label: string }) {
  portalTarget = target;
  element('#portal').setAttribute('aria-busy', 'true');
  element('#portal').hidden = false; document.body.classList.add('has-portal');
  element('#portal-title').textContent = target.label;
  element('#portal-page').textContent = `Page ${target.page}`;
  resizeViewer();
  try {
    const canvas = element<HTMLCanvasElement>('#portal-canvas');
    const rendered = await reader.preview(target, canvas);
    if (!rendered || portalTarget !== target) return;
    element('#portal').setAttribute('aria-busy', 'false');
    element('#portal-scroll').scrollTop = Math.max(0, canvas.clientHeight * target.y - 140);
    element('#portal-location').style.top = `${canvas.clientHeight * target.y + 8}px`;
    element('#portal-scroll').focus();
  } catch (error) { fail(error); }
}
function resizeViewer() {
  requestAnimationFrame(() => {
    if (!reader.document) return;
    const zoom = reader.viewer.currentScaleValue;
    if (['auto', 'page-width', 'page-fit'].includes(zoom)) reader.viewer.currentScaleValue = zoom;
    reader.viewer.update();
  });
}
new ResizeObserver(resizeViewer).observe(element('#reading-stage'));
const compactScreen = window.matchMedia('(max-width: 720px)');
if (compactScreen.matches) element('#sidebar').hidden = true;
compactScreen.addEventListener('change', event => { if (event.matches) element('#sidebar').hidden = true; });

function closeFind() { element('#find-bar').hidden = true; reader.bus.dispatch('findbarclose', { source: reader }); }
function openFind() { element('#find-bar').hidden = false; element<HTMLInputElement>('#find-input').focus(); element<HTMLInputElement>('#find-input').select(); }
function findNext(previous = false) { const query = element<HTMLInputElement>('#find-input').value; if (query.trim()) reader.find(query, previous, true); else openFind(); }
element('#find-input').addEventListener('input', () => { reader.find(element<HTMLInputElement>('#find-input').value); });
element('#find-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findNext(event.shiftKey); } });

const commands = [
  { title: 'Open a PDF', detail: 'Choose a document from your computer', key: 'O', action: 'open', global: true },
  { title: 'Open recent document', detail: 'Your locally saved reading library', key: 'Shift O', action: 'recent', global: true },
  { title: 'Explore the field guide', detail: 'A real PDF to try the reader', key: '', action: 'demo', global: true },
  { title: 'Find in document', detail: 'Search selectable text', key: '/', action: 'search' },
  { title: 'Find equation', detail: 'Look up a number and preview its definition', key: 'E', action: 'equation' },
  { title: 'Find citation', detail: 'Search reference numbers, author names, or titles', key: 'C', action: 'citation' },
  { title: 'Find figure or table', detail: 'Find captions in the document', key: 'V', action: 'figure' },
  { title: 'Go to page', detail: 'Jump to a page number', key: ':', action: 'page' },
  { title: 'Follow a link', detail: 'Type the hint shown over a visible PDF link', key: 'F', action: 'links' },
  { title: 'Preview a linked reference', detail: 'Keep your reading position in a split view', key: 'Shift F', action: 'preview-links' },
  { title: 'Smart reference hints', detail: 'Label visible equation and citation numbers, even without PDF links', key: 'S', action: 'smart-hints' },
  { title: 'Document contents', detail: 'Show the embedded outline', key: 'T', action: 'sidebar' },
  { title: 'Bookmark this page', detail: 'Toggle a bookmark at the current page', key: 'B', action: 'bookmark' },
  { title: 'Show bookmarks', detail: 'Return to your reading trail', key: 'Shift B', action: 'bookmarks' },
  { title: 'Return to previous position', detail: 'Back through jumps and references', key: 'Alt ←', action: 'history-back' },
  { title: 'Go forward', detail: 'Forward through your reading trail', key: 'Alt →', action: 'history-forward' },
  { title: 'Focus mode', detail: 'Hide the interface and stay with the page', key: 'Z', action: 'focus' },
  { title: 'Reading ruler', detail: 'A movable line to guide your eyes', key: 'R', action: 'ruler' },
  { title: 'Fit page width', detail: 'Make the text comfortable to read', key: 'W', action: 'fit-width' },
  { title: 'Fit whole page', detail: 'See the page in context', key: 'A', action: 'fit-page' },
  { title: 'Rotate clockwise', detail: 'Rotate every page by 90 degrees', key: 'Shift R', action: 'rotate' },
  { title: 'Two-page spread', detail: 'Toggle single and facing pages', key: '', action: 'spread' },
  { title: 'Reading settings', detail: 'Themes, page colors, and palette replacements', key: ',', action: 'settings', global: true },
  { title: 'Cycle reading theme', detail: 'Paper → Sepia → Night', key: 'D', action: 'theme', global: true },
  { title: 'Download original PDF', detail: 'Save an unmodified copy', key: '', action: 'download' },
  { title: 'Keyboard guide', detail: 'A shortcut to everywhere', key: '?', action: 'help', global: true },
];

function showDialog(id: string) {
  returnFocus = document.activeElement as HTMLElement;
  element<HTMLDialogElement>(id).showModal();
}
function closeDialog(dialog: HTMLDialogElement) { dialog.close(); (returnFocus?.isConnected ? returnFocus : reader.container).focus(); }

function openPalette(mode: string) {
  paletteMode = mode; selected = 0; closeHints();
  const titles: Record<string, string> = { commands: 'Find a command', page: 'Go to page', equation: 'Find an equation', citation: 'Find a citation', figure: 'Find a figure or table', recent: 'Your recent reading' };
  const placeholders: Record<string, string> = { commands: 'What would you like to do?', page: `Page number (1–${reader.document?.numPages || 1})`, equation: 'Equation number, e.g. 2 or A.1', citation: 'Reference number, author, or title…', figure: 'Figure or table number…', recent: 'Find a document…' };
  element('#palette-title').textContent = titles[mode];
  paletteInput.placeholder = placeholders[mode]; paletteInput.setAttribute('aria-label', titles[mode]);
  paletteInput.value = ''; paletteInput.inputMode = mode === 'page' ? 'numeric' : 'text';
  paletteInput.setAttribute('role', 'combobox'); paletteInput.setAttribute('aria-controls', 'palette-results'); paletteInput.setAttribute('aria-expanded', 'true');
  element('#palette-foot').innerHTML = ['equation', 'citation', 'figure'].includes(mode) ? '↑ ↓ to navigate <span>↵ preview · Shift ↵ jump</span>' : '↑ ↓ to navigate <span>↵ to select</span>';
  if (!palette.open) showDialog('#palette');
  paletteInput.focus();
  void refreshChoices();
}

function refreshChoices(): Promise<void> {
  choices = []; selected = 0;
  element('#palette-results').innerHTML = '<p class="empty-state">Looking up…</p>';
  choiceUpdate = computeChoices();
  return choiceUpdate;
}

async function computeChoices() {
  const generation = ++querySequence;
  const query = paletteInput.value.trim();
  const terms = query.toLowerCase().split(/\s+/);
  try {
    if (paletteMode === 'commands') {
      choices = commands.filter(command => (reader.document || command.global) && terms.every(term => `${command.title} ${command.detail}`.toLowerCase().includes(term))).map(command => ({ ...command, action: () => runAction(command.action) }));
    } else if (paletteMode === 'page') {
      const number = Number(query);
      choices = Number.isInteger(number) && number > 0 && number <= (reader.document?.numPages || 0) ? [{ title: `Go to page ${number}`, detail: 'Your current position will be kept in the reading trail', action: () => goTo(number) }] : [];
    } else if (paletteMode === 'recent') {
      const books = await listBooks();
      if (generation !== querySequence) return;
      choices = books.filter(book => terms.every(term => book.name.toLowerCase().includes(term))).map(book => ({ title: book.name, detail: 'Saved on this device · resume your reading', action: () => { void openDocument(book.blob, book.name, book.id); } }));
    } else {
      const hits = await engine.lookup(query, paletteMode as ReferenceKind);
      if (generation !== querySequence) return;
      choices = hits.map((hit: ReferenceHit) => ({ title: `${hit.kind === 'equation' ? 'Equation' : hit.kind === 'citation' ? 'Reference' : ''} ${hit.kind === 'equation' ? `(${hit.label})` : hit.kind === 'citation' ? `[${hit.label}]` : hit.label}`.trim(), detail: `Page ${hit.page} · ${hit.text}`, action: jump => { if (jump) goTo(hit.page, hit.y); else void showPortal({ ...hit, label: hit.kind === 'equation' ? `Equation (${hit.label})` : hit.kind === 'citation' ? `Reference [${hit.label}]` : hit.label }); } }));
    }
    selected = 0; renderChoices();
  } catch (error) { if (generation !== querySequence) return; choices = []; element('#palette-results').innerHTML = `<p class="empty-state">${esc(String(error))}</p>`; }
}

function renderChoices() {
  let empty = 'No matches. Try a different phrase.';
  if (paletteMode === 'page') empty = 'Enter a page number within this document.';
  if (['equation', 'citation', 'figure'].includes(paletteMode) && !indexed) empty = 'Indexing the document… Results will appear as pages are read.';
  else if (['equation', 'citation', 'figure'].includes(paletteMode) && !hasText) empty = 'No selectable text was found. This PDF may need OCR before references can be located.';
  else if (paletteMode === 'recent') empty = 'Open a local PDF to start your reading library.';
  element('#palette-results').innerHTML = choices.length ? choices.map((choice, index) => `<button id="choice-${index}" class="palette-option ${index === selected ? 'selected' : ''}" role="option" aria-selected="${index === selected}" data-choice="${index}" tabindex="-1"><span><strong>${esc(choice.title)}</strong><small>${esc(choice.detail)}</small></span>${choice.key ? `<kbd>${esc(choice.key)}</kbd>` : icon('arrow')}</button>`).join('') : `<p class="empty-state">${empty}</p>`;
  if (choices.length) paletteInput.setAttribute('aria-activedescendant', `choice-${selected}`);
  else paletteInput.removeAttribute('aria-activedescendant');
}

function choose(index: number, jump = false) {
  const choice = choices[index];
  if (!choice) return;
  closeDialog(palette); querySequence++;
  choice.action(jump);
}
paletteInput.addEventListener('input', () => { void refreshChoices(); });
paletteInput.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); selected = Math.max(0, Math.min(choices.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)));
    renderChoices(); document.getElementById(`choice-${selected}`)?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const pending = choiceUpdate;
    void pending.then(() => { if (palette.open && pending === choiceUpdate) choose(selected, event.shiftKey); });
  }
});

function applyPreferences() {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.style.setProperty('--pdf-background', preferences.recolor ? preferences.background : '#ffffff');
  reader.applyPreferences(preferences);
  saveStored('paperterm.preferences.v2', preferences);
  element<HTMLInputElement>('#background-color').value = preferences.background;
  element<HTMLInputElement>('#foreground-color').value = preferences.foreground;
  element<HTMLInputElement>('#recolor-toggle').checked = preferences.recolor;
  document.querySelectorAll<HTMLElement>('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === preferences.theme)));
}
function chooseTheme(theme: 'paper' | 'sepia' | 'night') {
  preferences.theme = theme; preferences.recolor = theme !== 'paper';
  [preferences.background, preferences.foreground] = theme === 'night' ? ['#202823', '#d8dfd5'] : theme === 'sepia' ? ['#f1e5cf', '#493d2e'] : [defaults.background, defaults.foreground];
  applyPreferences();
}
function renderMappings() {
  element('#palette-mappings').innerHTML = preferences.palette.map((entry, index) => `<div class="mapping"><label>From<input type="color" value="${entry.from}" data-mapping="${index}" data-channel="from" aria-label="Source color ${index + 1}"/></label><span>→</span><label>To<input type="color" value="${entry.to}" data-mapping="${index}" data-channel="to" aria-label="Replacement color ${index + 1}"/></label><button class="icon-button" data-remove-mapping="${index}" aria-label="Remove color replacement ${index + 1}">${icon('close')}</button></div>`).join('');
}

async function download() {
  if (!reader.document) return;
  const bytes = await reader.document.getData();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function runAction(action: string) {
  const global = ['open', 'demo', 'commands', 'settings', 'help', 'close-dialog', 'cancel-password', 'reset-theme', 'add-color', 'theme', 'recent', 'clear-library'];
  if ((!reader.document || opening) && !global.includes(action)) { toast('Open a PDF to use this command.'); return; }
  switch (action) {
    case 'open': element<HTMLInputElement>('#file-input').click(); break;
    case 'demo': void openDocument(new URL('sample.pdf', document.baseURI).href, 'The art of following an idea.pdf'); break;
    case 'commands': case 'page': case 'equation': case 'citation': case 'figure': case 'recent': openPalette(action); break;
    case 'search': openFind(); break;
    case 'find-next': findNext(); break;
    case 'find-prev': findNext(true); break;
    case 'close-find': closeFind(); reader.container.focus(); break;
    case 'zoom-in': reader.viewer.currentScale = Math.min(5, reader.viewer.currentScale * 1.15); saveState(); break;
    case 'zoom-out': reader.viewer.currentScale = Math.max(.2, reader.viewer.currentScale / 1.15); saveState(); break;
    case 'fit-width': reader.viewer.currentScaleValue = 'page-width'; saveState(); break;
    case 'fit-page': reader.viewer.currentScaleValue = 'page-fit'; saveState(); break;
    case 'rotate': reader.viewer.pagesRotation = (reader.viewer.pagesRotation + 90) % 360; closeHints(); break;
    case 'spread': reader.viewer.spreadMode = reader.viewer.spreadMode ? 0 : 1; break;
    case 'sidebar': element('#sidebar').hidden = !element('#sidebar').hidden; resizeViewer(); break;
    case 'outline': case 'bookmarks': navigationTab = action; element('#sidebar').hidden = false; renderNavigation(); resizeViewer(); break;
    case 'bookmark': bookmark(); break;
    case 'history-back': historyMove(true); break;
    case 'history-forward': historyMove(false); break;
    case 'focus': document.body.classList.toggle('focus-mode'); element('#exit-focus').hidden = !document.body.classList.contains('focus-mode'); resizeViewer(); break;
    case 'ruler': element('#reading-ruler').hidden = !element('#reading-ruler').hidden; break;
    case 'close-portal': closePortal(); reader.container.focus(); break;
    case 'portal-jump': if (portalTarget) { const target = portalTarget; closePortal(); goTo(target.page, target.y); reader.container.focus(); } break;
    case 'settings': renderMappings(); showDialog('#settings-dialog'); break;
    case 'help': showDialog('#help-dialog'); break;
    case 'close-dialog': { const dialog = document.querySelector<HTMLDialogElement>('dialog[open]'); if (dialog) closeDialog(dialog); break; }
    case 'download': void download().catch(fail); break;
    case 'theme': chooseTheme(({ paper: 'sepia', sepia: 'night', night: 'paper' } as const)[preferences.theme]); break;
    case 'reset-theme': preferences = structuredClone(defaults); applyPreferences(); renderMappings(); break;
    case 'add-color': if (preferences.palette.length < 12) { preferences.palette.push({ from: '#0000ff', to: '#5a8a76' }); renderMappings(); applyPreferences(); } break;
    case 'links': showHints(false); break;
    case 'preview-links': showHints(true); break;
    case 'smart-hints': showSmartHints(); break;
    case 'cancel-password': finishPassword(null); break;
    case 'clear-library': void clearBooks().then(() => { toast('Local document copies cleared.'); return renderRecent(); }).catch(fail); break;
  }
}

async function previewLink(anchor: HTMLAnchorElement) {
  if (!reader.document) return;
  const section = anchor.closest<HTMLElement>('[data-annotation-id]');
  const pageElement = anchor.closest<HTMLElement>('.page');
  if (!section || !pageElement) { toast('This link has no internal PDF destination to preview.'); return; }
  const page = await reader.document.getPage(Number(pageElement.dataset.pageNumber));
  const annotations = await page.getAnnotations();
  const annotation = annotations.find(item => item.id === section.dataset.annotationId);
  if (!annotation?.dest) { toast('This is an external link. Use F to open it in a new tab.'); return; }
  const target = await reader.resolveDestination(annotation.dest);
  if (target) void showPortal({ ...target, label: 'Linked passage' });
}

function closeHints() { hints = []; hintPrefix = ''; element('#link-hints').innerHTML = ''; }
function showHints(preview: boolean) {
  closeHints();
  hintScrollTop = reader.container.scrollTop; hintScrollLeft = reader.container.scrollLeft;
  const bounds = reader.container.getBoundingClientRect();
  const stage = element('#reading-stage').getBoundingClientRect();
  const alphabet = 'asdfghjklqwertyuiopzxcvbnm';
  const anchors = [...reader.container.querySelectorAll<HTMLAnchorElement>('.annotationLayer a[href]')].filter(anchor => {
    const box = anchor.getBoundingClientRect(); return box.width && box.height && box.bottom > bounds.top && box.top < bounds.bottom && box.right > bounds.left && box.left < bounds.right;
  });
  const double = anchors.length > alphabet.length;
  anchors.forEach((anchor, index) => {
    const label = double ? alphabet[Math.floor(index / alphabet.length)] + alphabet[index % alphabet.length] : alphabet[index];
    if (!label || index >= alphabet.length ** 2) return;
    const rectangle = anchor.getBoundingClientRect();
    const button = document.createElement('span'); button.className = 'link-hint'; button.textContent = label;
    button.style.left = `${rectangle.left - stage.left}px`; button.style.top = `${rectangle.top - stage.top}px`;
    element('#link-hints').append(button); hints.push({ label, button, action: () => { if (preview) void previewLink(anchor).catch(fail); else anchor.click(); } });
  });
  if (!hints.length) toast('No embedded PDF links are visible here. Try E or C for text-based lookup.');
  else toast(`Type a hint to ${preview ? 'preview' : 'follow'} a link. Escape cancels.`);
}

function showSmartHints() {
  closeHints();
  hintScrollTop = reader.container.scrollTop; hintScrollLeft = reader.container.scrollLeft;
  const bounds = reader.container.getBoundingClientRect();
  const stage = element('#reading-stage').getBoundingClientRect();
  const candidates: { box: DOMRect; query: string; kind: ReferenceKind }[] = [];
  for (const span of reader.container.querySelectorAll<HTMLElement>('.textLayer span')) {
    const text = span.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) continue;
    const pattern = /\(((?:[A-Z]\.?)?\d+(?:[.\-]\d+)*[a-z]?)\)|\[(\d+)\]|(?:Fig\.?|Figure|Table)\s+(\d+(?:\.\d+)*)/g;
    for (const match of span.textContent!.matchAll(pattern)) {
      const range = document.createRange(); range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length);
      const box = range.getBoundingClientRect();
      if (box.bottom < bounds.top || box.top > bounds.bottom || box.right < bounds.left || box.left > bounds.right) continue;
      candidates.push({ box, query: match[1] || match[2] || match[3], kind: match[1] ? 'equation' : match[2] ? 'citation' : 'figure' });
    }
  }
  const alphabet = 'asdfghjklqwertyuiopzxcvbnm';
  candidates.slice(0, alphabet.length ** 2).forEach((candidate, index) => {
    const label = candidates.length > alphabet.length ? alphabet[Math.floor(index / alphabet.length)] + alphabet[index % alphabet.length] : alphabet[index];
    const button = document.createElement('span'); button.className = 'link-hint'; button.textContent = label;
    button.style.left = `${candidate.box.left - stage.left}px`; button.style.top = `${candidate.box.top - stage.top}px`;
    element('#link-hints').append(button);
    hints.push({ label, button, action: () => {
      void engine.lookup(candidate.query, candidate.kind).then(hits => {
        if (!hits.length) { toast('No definition found for this reference. Try a manual lookup.'); return; }
        const hit = hits[0]; void showPortal({ ...hit, label: `${hit.kind === 'equation' ? 'Equation' : hit.kind === 'citation' ? 'Reference' : ''} ${hit.label}`.trim() });
      }).catch(fail);
    } });
  });
  toast(hints.length ? 'Type a hint to peek at the reference. Escape cancels.' : 'No equation numbers or numeric citations are visible. Try E or C.');
}
reader.container.addEventListener('scroll', () => {
  if (reader.container.scrollTop !== hintScrollTop || reader.container.scrollLeft !== hintScrollLeft) closeHints();
}, { passive: true });
reader.container.addEventListener('click', event => {
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('.annotationLayer a');
  if (!anchor) return;
  if (event.shiftKey) { event.preventDefault(); event.stopPropagation(); void previewLink(anchor).catch(fail); }
  else pushHistory();
}, true);

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button');
  if (!target) return;
  if (target.dataset.action) runAction(target.dataset.action);
  if (target.dataset.choice !== undefined) choose(Number(target.dataset.choice), event.shiftKey);
  if (target.dataset.outline !== undefined) {
    const entry = outline[Number(target.dataset.outline)];
    if (entry.dest) { pushHistory(); void reader.links.goToDestination(entry.dest as string | unknown[]).catch(fail); }
    else if (entry.url && /^https?:\/\//i.test(entry.url)) window.open(entry.url, '_blank', 'noopener,noreferrer');
  }
  if (target.dataset.page) goTo(Number(target.dataset.page));
  if (target.dataset.bookmark !== undefined) { const mark = state.bookmarks[Number(target.dataset.bookmark)]; pushHistory(); reader.restoreFraction(mark.page, mark.y); }
  if (target.dataset.deleteBookmark !== undefined) { state.bookmarks.splice(Number(target.dataset.deleteBookmark), 1); saveState(); renderNavigation(); updateBookmarkButton(); }
  if (target.dataset.theme) chooseTheme(target.dataset.theme as 'paper' | 'sepia' | 'night');
  if (target.dataset.removeMapping !== undefined) { preferences.palette.splice(Number(target.dataset.removeMapping), 1); renderMappings(); applyPreferences(); }
  if (target.dataset.recent) void readBook(target.dataset.recent).then(book => { if (book) void openDocument(book.blob, book.name, book.id); }).catch(fail);
});

document.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'file-input') { const file = target.files?.[0]; if (file) void openDocument(file, file.name); target.value = ''; }
  if (target.id === 'background-color') { preferences.background = target.value; preferences.recolor = true; applyPreferences(); }
  if (target.id === 'foreground-color') { preferences.foreground = target.value; preferences.recolor = true; applyPreferences(); }
  if (target.id === 'recolor-toggle') { preferences.recolor = target.checked; applyPreferences(); }
  if (target.dataset.mapping !== undefined) { const entry = preferences.palette[Number(target.dataset.mapping)]; entry[target.dataset.channel as 'from' | 'to'] = target.value; applyPreferences(); }
});

function startPrefix(value: string) {
  prefix = value; clearTimeout(prefixTimer); prefixTimer = setTimeout(() => { prefix = ''; }, 1800);
  if (value === 'm') toast('Set mark: press a letter a–z');
  if (value === "'") toast('Go to mark: press a letter a–z');
}

document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const target = event.target as HTMLElement;
  const typing = target.matches('input, textarea, select') || target.isContentEditable;
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === 'Escape') {
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault(); prefix = ''; closeHints();
    if (!element('#find-bar').hidden) closeFind(); else if (portalTarget) closePortal(); else if (document.body.classList.contains('focus-mode')) runAction('focus');
    reader.container.focus(); return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); runAction('commands'); return; }
  if (modifier && event.key.toLowerCase() === 'f' && reader.document) { event.preventDefault(); openFind(); return; }
  if (typing || (target.tagName === 'BUTTON' && [' ', 'Enter'].includes(event.key))) return;
  if (hints.length && !modifier && !event.altKey && event.key.length === 1) {
    event.preventDefault(); hintPrefix += event.key.toLowerCase();
    const exact = hints.find(hint => hint.label === hintPrefix);
    if (exact) { const action = exact.action; closeHints(); action(); }
    else { hints.forEach(hint => { hint.button.hidden = !hint.label.startsWith(hintPrefix); }); if (!hints.some(hint => hint.label.startsWith(hintPrefix))) closeHints(); }
    return;
  }
  if (prefix && !modifier && !event.altKey) {
    const pending = prefix; prefix = ''; clearTimeout(prefixTimer);
    if (pending === 'g' && event.key === 'g') { event.preventDefault(); goTo(1); return; }
    if (/^[a-z]$/.test(event.key) && pending === 'm') { event.preventDefault(); state.marks[event.key] = { page: reader.viewer.currentPageNumber, y: reader.offset }; saveState(); toast(`Mark ${event.key} → page ${reader.viewer.currentPageNumber}`); return; }
    if (/^[a-z]$/.test(event.key) && pending === "'") { event.preventDefault(); const mark = state.marks[event.key]; if (typeof mark === 'number') goTo(mark); else if (mark) { pushHistory(); reader.restoreFraction(mark.page, mark.y); } else toast(`Mark ${event.key} has not been set.`); return; }
  }
  if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key) && reader.document) { event.preventDefault(); historyMove(event.key === 'ArrowLeft'); return; }
  if (modifier && ['d', 'u'].includes(event.key.toLowerCase()) && reader.document) { event.preventDefault(); reader.container.scrollBy({ top: reader.container.clientHeight * (event.key.toLowerCase() === 'd' ? .5 : -.5), behavior: 'instant' }); return; }
  if (modifier || event.altKey) return;
  const actions: Record<string, string> = { o: 'open', O: 'recent', '?': 'help', ',': 'settings', d: 'theme', '/': 'search', ':': 'page', e: 'equation', c: 'citation', v: 'figure', t: 'sidebar', b: 'bookmark', B: 'bookmarks', z: 'focus', r: 'ruler', R: 'rotate', w: 'fit-width', a: 'fit-page', f: 'links', F: 'preview-links', s: 'smart-hints', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out' };
  if (actions[event.key]) { event.preventDefault(); runAction(actions[event.key]); return; }
  if (!reader.document) return;
  const scrollContainer = target.closest('#portal') ? element('#portal-scroll') : reader.container;
  if (['j', 'k', 'h', 'l', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' ', 'PageDown', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    const down = ['j', 'ArrowDown'].includes(event.key), up = ['k', 'ArrowUp'].includes(event.key);
    const pageDown = [' ', 'PageDown'].includes(event.key);
    const horizontal = ['h', 'l', 'ArrowLeft', 'ArrowRight'].includes(event.key);
    scrollContainer.scrollBy({ top: horizontal ? 0 : down ? 65 : up ? -65 : scrollContainer.clientHeight * (pageDown && !event.shiftKey ? .85 : -.85), left: horizontal ? ['h', 'ArrowLeft'].includes(event.key) ? -65 : 65 : 0, behavior: 'instant' });
  } else if (event.key === 'g' || event.key === 'm' || event.key === "'") { event.preventDefault(); startPrefix(event.key); }
  else if (event.key === 'G') { event.preventDefault(); goTo(reader.document.numPages); }
  else if (event.key === 'n' || event.key === 'N') { event.preventDefault(); findNext(event.key === 'N'); }
  else if (event.key === ']' || event.key === '[') { event.preventDefault(); const ruler = element('#reading-ruler'); ruler.hidden = false; const position = parseFloat(ruler.style.top || '40'); ruler.style.top = `${Math.min(95, Math.max(5, position + (event.key === ']' ? 3 : -3)))}%`; }
});

document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target === dialog && dialog.id !== 'password-dialog') { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog); } });
  dialog.addEventListener('close', () => { if (dialog.id === 'palette') { querySequence++; paletteInput.setAttribute('aria-expanded', 'false'); } });
});

let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; element('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) element('#drop-overlay').hidden = true; });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; element('#drop-overlay').hidden = true; const file = event.dataTransfer?.files[0]; if (file) void openDocument(file, file.name); });
window.addEventListener('beforeunload', saveState);

element('#help-keys').innerHTML = `<div class="help-group"><h3>Move through a document</h3>${[['J / K', 'Scroll down / up'], ['H / L', 'Scroll horizontally'], ['Space / Shift Space', 'Move a viewport'], ['Ctrl D / Ctrl U', 'Move half a viewport'], ['gg / G', 'First / last page'], ['m + letter / \' + letter', 'Set / jump to a named mark'], ['[ / ]', 'Move the reading ruler']].map(([key, text]) => `<div><span>${esc(text)}</span><kbd>${esc(key)}</kbd></div>`).join('')}</div><div class="help-group"><h3>Follow the idea</h3>${commands.filter(command => command.key).map(command => `<div><span>${esc(command.title)}</span><kbd>${esc(command.key)}</kbd></div>`).join('')}</div>`;
async function renderRecent() {
  try {
    const books = await listBooks();
    element('#recent-documents').innerHTML = books.length ? `<div class="recent-heading"><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><button class="text-button" data-action="clear-library">Clear local copies</button></div><div class="recent-grid">${books.slice(0, 3).map(book => `<button class="recent-book" data-recent="${esc(book.id)}">${icon('document')}<span>${esc(book.name)}</span>${icon('arrow')}</button>`).join('')}</div>` : '';
  } catch { element('#recent-documents').innerHTML = ''; }
}

applyPreferences();
void renderRecent();
const parameters = new URLSearchParams(location.search);
if (parameters.has('demo')) runAction('demo');
else if (location.search.startsWith('?source=')) {
  const raw = location.search.slice('?source='.length);
  let name = 'document.pdf';
  try { name = decodeURIComponent(new URL(raw).pathname.split('/').pop() || 'document.pdf'); } catch {}
  void openDocument(raw, name);
} else if (parameters.has('file')) {
  const source = parameters.get('file')!;
  void openDocument(source, source.split('/').pop()?.split('?')[0] || 'document.pdf');
}
