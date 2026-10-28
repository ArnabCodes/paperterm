import 'pdfjs-dist/web/pdf_viewer.css';
import './style.css';
import { closeCurrentExtensionTab, isExtensionPage, validatePdfSource } from './platform';
import './help.css';
import { displayShortcut, leaderActions, shortcutSections } from './shortcuts';
import './chrome.css';
import './research.css';
import { applyThemeTokens, getTheme, themes } from './themes';
import { collapseControls, initializeChrome, showDock, toggleSidebar } from './chrome';
import { shell, icon } from './ui';
import { Reader, type Location, type OutlineEntry } from './reader';
import { ReferenceEngine } from './engine';
import { defaults, defaultReadingState, loadPreferences, readStored, saveStored } from './preferences';
import { clearBooks, listBooks, readBook, saveBook } from './library';
import { element, escapeHtml as esc, type ReferenceHit, type ReferenceKind, type ReadingState, type TextLine } from './types';
import { initializeNotebook } from './notebook';
import { buildDocumentMap } from './research';
import { initializeResearch } from './research-panel';
import { initializeFieldMap } from './field-panel';
import './field.css';
import './dock.css';
import { initializeDock } from './dock';
import { suggestPaperQuery } from './citation-network';
import { initializeFileBrowser } from './file-browser';
import { discoverPublisherPdfs, publisherPage } from './publisher-pdf';
import { initializeTutor } from './tutor';
import { initializeHardMode } from './hard-mode';

element('#app').innerHTML = shell();
const hardMode = initializeHardMode();
const openFileBrowser = initializeFileBrowser((blob, name) => openDocument(blob, name));
const previewMenu = document.createElement('div');
previewMenu.className = 'preview-context'; previewMenu.popover = 'auto';
previewMenu.innerHTML = '<button data-action="portal-jump">Follow passage · Enter</button><button data-action="pin-portal">Pin / unpin · Shift P</button><button data-action="preview-page">Content / full page · g P</button><button data-action="close-portal">Close · Escape</button>';
document.body.append(previewMenu);
function openPreviewMenu(xpos: number, ypos: number) {
  previewMenu.style.inset = 'auto'; previewMenu.style.margin = '0';
  previewMenu.style.left = `${Math.max(8, Math.min(innerWidth - 270, xpos))}px`;
  previewMenu.style.top = `${Math.max(8, Math.min(innerHeight - 200, ypos))}px`;
  previewMenu.showPopover(); previewMenu.querySelector('button')!.focus();
}
element('#portal-scroll').addEventListener('contextmenu', event => { event.preventDefault(); openPreviewMenu(event.clientX, event.clientY); });
element('#portal-scroll').addEventListener('keydown', event => { if (event.shiftKey && event.key === 'F10') { event.preventDefault(); openPreviewMenu(innerWidth / 2, innerHeight / 2); } });
previewMenu.addEventListener('click', () => previewMenu.hidePopover());
previewMenu.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); previewMenu.hidePopover(); element('#portal-scroll').focus(); } });
let preferences = loadPreferences();
const reader = new Reader(element<HTMLDivElement>('#viewer-container'), preferences);
const engine = new ReferenceEngine();
let state: ReadingState = defaultReadingState();
let fingerprint = '';
let fileName = 'document.pdf';
let originalPdfUrl = '';
let outline: OutlineEntry[] = [];
let navigationTab = 'outline';
let opening = false;
let loadSequence = 0;
let initialHashConsumed = false;
let indexed = false;
let hasText = false;
let toastTimer: ReturnType<typeof setTimeout>;
type PreviewTarget = { page: number; y: number; x?: number; label: string; citation?: string };
let portalTarget: PreviewTarget | null = null;
let previewItems: PreviewTarget[] = [];
let previewIndex = -1;
let previewPinned = false;
let previewZoom = 1;
let previewFullPage = false;
let documentMap = buildDocumentMap([]);
const research = initializeResearch({
  map: () => documentMap,
  ready: () => indexed,
  show: showDialog,
  close: closeDialog,
  peek: target => { void showPortal(target); },
  jump: (page, ypos) => { closePortal(); goTo(page, ypos); },
  toast,
});
const fieldMap = initializeFieldMap({ show: showDialog, local: () => research.open(), documentId: () => fingerprint, doi: async () => {
  const pdf = reader.document;
  if (!pdf) return '';
  const text = await (await pdf.getPage(1)).getTextContent();
  if (pdf !== reader.document) return '';
  const value = text.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ').slice(0, 20000);
  const matches = [...new Set([...value.matchAll(/\b10\.\d{4,9}\/[^\s<>"\]]+/gi)].map(match => match[0].replace(/[.,;:)]+$/, '')))];
  return matches.length === 1 ? matches[0] : '';
}, suggestion: async () => {
  const pdf = reader.document;
  if (!pdf) return '';
  const metadata = await pdf.getMetadata().catch(() => null);
  if (pdf !== reader.document) return '';
  const title = (metadata?.info as { Title?: string } | undefined)?.Title;
  const first = await pdf.getPage(1);
  const viewport = first.getViewport({ scale: 1 });
  const content = await first.getTextContent();
  if (pdf !== reader.document) return '';
  return suggestPaperQuery(title, fileName, content.items.flatMap(item => 'str' in item ? [{ text: item.str, size: item.height, x: item.transform[4] / viewport.width, y: viewport.convertToViewportPoint(item.transform[4], item.transform[5])[1] / viewport.height }] : []));
} });
function openResearch(label?: string) { if (label) research.open(label); else void fieldMap.open(); }
const notebook = initializeNotebook({
  getDocument: () => reader.document && !opening && fingerprint ? { id: fingerprint, name: fileName, page: reader.viewer.currentPageNumber, offset: reader.offset, pageCount: reader.document.numPages } : null,
  goTo,
  toast,
});
const backward: Location[] = [];
const forward: Location[] = [];
let pendingPortalJump: { queuedHistory: boolean[] } | null = null;
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
let selectedPdfText = '';
let indexedLines: readonly TextLine[] = [];
function tutorSavedNotes() {
  const notes = readStored<unknown>(`paperterm.notebook.v1:${fingerprint}`, []);
  return Array.isArray(notes) ? notes.filter(note => note && typeof note === 'object' && ((typeof note.note === 'string' && note.note.trim()) || (typeof note.excerpt === 'string' && note.excerpt.trim()))).length : 0;
}
const tutor = initializeTutor({
  hard: hardMode,
  resetInput: () => { prefix = ''; clearTimeout(prefixTimer); closeHints(); },
  prepare: async () => {
    reader.viewer.scrollMode = 0; reader.viewer.spreadMode = 0;
    reader.viewer.currentScaleValue = 'auto'; reader.goTo(1);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    reader.container.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  },
  needsMissionSetup: id => (id === 'pin' || id === 'trail') && (!portalTarget || portalTarget.page !== 3 || previewPinned !== (id === 'trail')),
  prepareMission: async (id, isCurrent) => {
    const hits = await engine.lookup('2', 'equation');
    const hit = hits.find(candidate => candidate.label === '2' && candidate.page === 3);
    if (!hit) throw new Error('Equation (2) is not ready yet. Press e, type 2 and press Enter to reopen it.');
    if (!isCurrent()) return;
    if (reader.viewer.currentPageNumber !== 2) reader.goTo(2);
    previewPinned = id === 'trail';
    setPanelWidth(panelWidth);
    const target = previewForHit(hit);
    await showPortal(target, [target]);
    // Pinning changes the reader width and can trigger a delayed PDF.js reflow.
    // Establish the source position only after that layout has settled.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!isCurrent()) return;
    reader.goTo(2);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  },
  move: direction => {
    const before = reader.container.scrollTop;
    reader.container.scrollTo({ top: Math.max(0, before + direction * 65), behavior: 'instant' });
    return direction > 0 ? reader.container.scrollTop > before : reader.container.scrollTop < before;
  },
  canPause: () => !portalTarget && element('#find-bar').hidden,
  open: async () => {
    await openDocument(new URL('tutor.pdf', document.baseURI).href, 'The Coherence Atlas.pdf');
    const sequence = loadSequence;
    for (let attempt = 0; attempt < 300 && !indexed && sequence === loadSequence && reader.document; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    if (sequence === loadSequence && reader.document) { reader.viewer.spreadMode = 0; reader.viewer.pagesRotation = 0; reader.viewer.currentScaleValue = 'auto'; reader.goTo(1); }
  },
  snapshot: () => ({
    ready: !!reader.document && !opening && indexed && fileName === 'The Coherence Atlas.pdf',
    page: reader.viewer.currentPageNumber,
    query: element<HTMLInputElement>('#find-input').value,
    matches: Number(/of\s+(\d+)/.exec(element('#find-count').textContent || '')?.[1] || 0),
    preview: !!portalTarget && !element('#portal').hidden && element<HTMLCanvasElement>('#portal-canvas').width > 0,
    previewPage: portalTarget?.page || 0, pinned: previewPinned, theme: preferences.theme,
    bookmarked: state.bookmarks.some(mark => mark.page === reader.viewer.currentPageNumber),
    notes: tutorSavedNotes(),
    ruler: !element('#reading-ruler').hidden, spread: reader.viewer.spreadMode,
    rulerPosition: parseFloat(element('#reading-ruler').style.top || '40'), focus: document.body.classList.contains('focus-mode'),
    quickmarkPage: typeof state.marks.a === 'number' ? state.marks.a : state.marks.a?.page,
  }),
  jump: page => goTo(page), command: () => openPalette('commands'), focus: () => reader.container.focus(),
});

function toast(message: string) {
  clearTimeout(toastTimer);
  element('#toast').textContent = message;
  element('#toast').hidden = false;
  toastTimer = setTimeout(() => { element('#toast').hidden = true; }, 4200);
}

function fail(error: unknown) { console.error(error); toast(error instanceof Error ? error.message : String(error)); }
let saveStateTimer: ReturnType<typeof setTimeout>;
function saveState() {
  clearTimeout(saveStateTimer);
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
  if (!last || last.page !== current.page || Math.abs(last.top - current.top) > 5 || Math.abs(last.left - current.left) > 5 || last.zoom !== current.zoom || last.rotation !== current.rotation) backward.push(current);
  if (backward.length > 100) backward.shift();
  forward.length = 0;
}

function goTo(page: number, ypos?: number) { pendingPortalJump = null; pushHistory(); reader.goTo(page, ypos); saveState(); }

function historyMove(back: boolean) {
  if (pendingPortalJump) { pendingPortalJump.queuedHistory.push(back); return; }
  const source = back ? backward : forward;
  const target = source.pop();
  if (!target) { toast(back ? 'You are at the beginning of your reading trail.' : 'No forward position yet.'); return; }
  (back ? forward : backward).push(reader.location);
  reader.restore(target); saveState();
  // PDF.js may report another visible page after a reflow. Check the actual
  // scroll position against the restored history entry, not its current-page heuristic.
  const view = reader.viewer.getPageView(target.page - 1);
  const wanted = view?.div && Number.isFinite(target.offset) ? view.div.offsetTop + target.offset! * view.div.clientHeight : target.top;
  const clamped = Math.max(0, Math.min(wanted, reader.container.scrollHeight - reader.container.clientHeight));
  if (back && Math.abs(reader.container.scrollTop - clamped) <= 3) tutor.returned(target.page);
}

async function openDocument(source: string | File | Blob, name = 'document.pdf', libraryId?: string, resolvePublisher = false) {
  pendingPortalJump = null;
  originalPdfUrl = '';
  tutor.documentChanging();
  const originalSource = typeof source === 'string' ? source : '';
  document.querySelector('#publisher-recovery')?.remove();
  collapseControls();
  clearTimeout(toastTimer); element('#toast').hidden = true;
  const sequence = ++loadSequence;
  saveState();
  opening = true; indexed = false; hasText = false;
  selectedPdfText = '';
  documentMap = buildDocumentMap([]); notebook.reset(); research.reset(); fieldMap.reset();
  indexedLines = [];
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
      validatePdfSource(source);
      if (resolvePublisher || publisherPage(source)) {
        element('#loading-label').textContent = 'Finding the publisher’s PDF…';
        const links = await discoverPublisherPdfs(source);
        source = links[0].url;
        if (name === 'document.pdf' || !/\.pdf$/i.test(name)) name = 'Publisher paper.pdf';
      }
      if (/^https?:\/\//i.test(source)) originalPdfUrl = source;
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
    await new Promise<void>(resolve => {
      if (document.hidden) setTimeout(resolve, 0);
      else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    if (sequence !== loadSequence) return;
    if (requestedPage > 0) reader.goTo(requestedPage);
    else reader.restoreFraction(state.page, state.offset);
    fileName = name;
    document.title = `${name.replace(/\.pdf$/i, '')} — Pipit`;
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
    document.title = 'Pipit — a quiet PDF workspace';
    element('#exit-focus').hidden = true;
    const detail = typeof source === 'string' && source.startsWith('file:') ? ' Local-file URL permissions vary by browser; press o to choose the file instead.' : typeof source === 'string' && /^https?:/.test(source) ? (isExtensionPage() ? ' Check Pipit’s site access. Institutional sign-in, cookies, or publisher access checks may require opening the publisher’s own PDF link first.' : ' The standalone app needs a CORS-enabled URL; use the extension for publisher links or open a local PDF.') : '';
    toast(`Could not open this PDF. ${error instanceof Error ? error.message : String(error)}${detail}`);
    if (/^https?:/.test(originalSource)) {
      const recovery = document.createElement('p');
      recovery.id = 'publisher-recovery'; recovery.setAttribute('role', 'status');
      const message = document.createElement('span');
      message.textContent = `${error instanceof Error ? error.message : 'Could not open this PDF.'} `;
      const link = document.createElement('a');
      link.href = originalSource; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open publisher / source page ↗';
      recovery.append(message, link); element('#welcome').append(recovery);
    }
  } finally {
    if (sequence === loadSequence) element('#loading').hidden = true;
  }
}

reader.onProgress = percent => { if (percent > 0) element('#loading-label').textContent = `Opening your document… ${Math.min(100, percent)}%`; };
reader.onPage = page => {
  element('#page-current').textContent = String(page);
  updateBookmarkButton();
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(saveState, 250);
};
reader.onZoom = zoom => { element('#zoom-value').textContent = `${Math.round(zoom * 100)}%`; schedulePreview(); };
reader.onMatches = (current, total) => { element('#find-count').textContent = total ? `${current} of ${total}` : 'No matches'; };
reader.onIndex = (lines, complete) => {
  indexedLines = lines;
  documentMap = buildDocumentMap(lines); research.update();
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
  if (previewMenu.matches(':popover-open')) previewMenu.hidePopover();
  const wasPinned = previewPinned;
  clearTimeout(previewRenderTimer);
  reader.cancelPreview(); element('#portal').hidden = true; element('#preview-backdrop').hidden = true; element('#reading-stage').inert = false; document.body.classList.remove('has-portal'); portalTarget = null;
  previewItems = []; previewIndex = -1; previewPinned = false; previewZoom = 1; previewFullPage = false;
  if (wasPinned) resizeViewer();
}
async function showPortal(target: PreviewTarget, items?: PreviewTarget[], navigating = false) {
  const needsFocus = portalTarget !== target || element('#portal').hidden;
  if (needsFocus) element('#portal').dataset.opening = 'true';
  if (portalTarget !== target) previewFullPage = false;
  if (items) { previewItems = items; previewIndex = Math.max(0, items.findIndex(item => item.page === target.page && item.y === target.y)); }
  else if (!navigating) { previewItems = [...previewItems.slice(0, previewIndex + 1), target].slice(-50); previewIndex = previewItems.length - 1; }
  portalTarget = target;
  element('#portal').setAttribute('aria-busy', 'true');
  element('#portal').hidden = false; document.body.classList.toggle('has-portal', previewPinned);
  element('#preview-backdrop').hidden = previewPinned;
  element('#reading-stage').inert = !previewPinned;
  element<HTMLButtonElement>('[data-action="pin-portal"]').setAttribute('aria-pressed', String(previewPinned));
  element('#portal-title').textContent = target.label;
  element('#portal').setAttribute('aria-label', `${target.label}, page ${target.page}. Escape closes, Enter follows, Shift P pins. Right-click for preview commands.`);
  element('#portal-page').textContent = `Page ${target.page}`;
  sizePreview();
  await renderPreview(needsFocus);
}
let previewRenderTimer: ReturnType<typeof setTimeout>;
function schedulePreview() {
  clearTimeout(previewRenderTimer);
  if (portalTarget) previewRenderTimer = setTimeout(() => { void renderPreview(); }, 140);
}
function sizePreview() {
  const factor = Math.min(.88, 1440 / innerWidth, 980 / innerHeight);
  const panel = element('#portal');
  panel.style.setProperty('--preview-width', `${innerWidth * factor}px`);
  panel.style.setProperty('--preview-height', `${innerHeight * factor}px`);
}
async function renderPreview(focus = false) {
  const target = portalTarget;
  if (!target || element('#portal').hidden) return;
  element('#portal').setAttribute('aria-busy', 'true');
  try {
    const canvas = element<HTMLCanvasElement>('#portal-canvas');
    const scroll = element('#portal-scroll');
    const positionAtTarget = focus || element('#portal').dataset.opening === 'true';
    const previousPosition = canvas.clientHeight ? (scroll.scrollTop + scroll.clientHeight / 2) / canvas.clientHeight : 0;
    const rendered = await reader.preview(target, canvas, previewZoom, previewFullPage);
    if (!rendered || portalTarget !== target) return;
    element('#portal').setAttribute('aria-busy', 'false');
    const crop = JSON.parse(canvas.dataset.crop || '{}');
    if (!previewPinned && crop.cropped) element('#portal').style.setProperty('--preview-height', `${Math.max(90, Math.min(innerHeight * .88, canvas.clientHeight * crop.height))}px`);
    scroll.scrollTop = !positionAtTarget ? Math.max(0, canvas.clientHeight * previousPosition - scroll.clientHeight / 2) : crop.cropped && crop.height < .8 ? canvas.clientHeight * crop.y : Math.max(0, canvas.clientHeight * Number(canvas.dataset.targetY || target.y) - scroll.clientHeight * .42);
    scroll.scrollLeft = Math.max(0, (canvas.clientWidth - scroll.clientWidth) / 2);
    element('#portal-location').style.top = `${canvas.clientHeight * target.y + 8}px`;
    delete element('#portal').dataset.opening;
    if (positionAtTarget && document.activeElement !== resizer) scroll.focus({ preventScroll: true });
  } catch (error) { fail(error); }
}
function movePreview(direction: number) {
  const next = previewIndex + direction;
  if (next < 0 || next >= previewItems.length) return;
  previewIndex = next; void showPortal(previewItems[next], undefined, true);
}
function pinPreview() {
  if (!portalTarget) return;
  previewPinned = !previewPinned;
  setPanelWidth(panelWidth);
  void showPortal(portalTarget, undefined, true);
}
const storedPanelWidth = readStored<number>('paperterm.preview-width', 520);
let panelWidth = typeof storedPanelWidth === 'number' && Number.isFinite(storedPanelWidth) ? storedPanelWidth : 520;
const resizer = element('#portal-resizer');
resizer.title = 'Drag to resize; Left and Right arrows adjust the width';
function panelLimits() {
  const maximum = Math.max(120, Math.min(920, innerWidth - (innerWidth < 720 ? 24 : 292)));
  return { minimum: Math.min(240, maximum), maximum };
}
function setPanelWidth(width: number) {
  const { minimum, maximum } = panelLimits();
  panelWidth = Math.min(maximum, Math.max(minimum, width));
  document.documentElement.style.setProperty('--portal-width', `${panelWidth}px`);
  resizer.setAttribute('aria-valuemin', String(minimum));
  resizer.setAttribute('aria-valuemax', String(maximum));
  resizer.setAttribute('aria-valuenow', String(Math.round(panelWidth)));
  resizer.setAttribute('aria-valuetext', `${Math.round(panelWidth)} pixels wide`);
}
let panelDrag: { pointer: number; start: number; width: number } | null = null;
resizer.addEventListener('pointerdown', event => {
  if (!previewPinned || event.button !== 0) return;
  event.preventDefault(); panelDrag = { pointer: event.pointerId, start: event.clientX, width: panelWidth };
  resizer.setPointerCapture(event.pointerId); document.body.classList.add('resizing-preview');
});
resizer.addEventListener('pointermove', event => {
  if (!panelDrag || panelDrag.pointer !== event.pointerId) return;
  setPanelWidth(panelDrag.width + panelDrag.start - event.clientX); schedulePreview();
});
function finishPanelDrag() {
  panelDrag = null; document.body.classList.remove('resizing-preview');
  saveStored('paperterm.preview-width', panelWidth); schedulePreview();
}
resizer.addEventListener('pointerup', finishPanelDrag);
resizer.addEventListener('pointercancel', finishPanelDrag);
resizer.addEventListener('lostpointercapture', () => { if (panelDrag) finishPanelDrag(); });
resizer.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const { minimum, maximum } = panelLimits();
  setPanelWidth(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : panelWidth + (event.key === 'ArrowLeft' ? 32 : -32));
  saveStored('paperterm.preview-width', panelWidth); schedulePreview();
});
window.addEventListener('resize', () => { sizePreview(); setPanelWidth(panelWidth); schedulePreview(); });
setPanelWidth(panelWidth);
let zoomSaveTimer: ReturnType<typeof setTimeout>;
document.addEventListener('wheel', event => {
  if (!event.ctrlKey || !reader.document || opening) return;
  event.preventDefault();
  if (document.querySelector('dialog[open]') || !event.deltaY) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
  const factor = Math.exp(-Math.max(-120, Math.min(120, delta)) * .002);
  if ((event.target as HTMLElement).closest('#portal') && portalTarget) {
    previewZoom = Math.max(.6, Math.min(2.5, previewZoom * factor));
    void showPortal(portalTarget, undefined, true);
    return;
  }
  closeHints();
  const current = reader.viewer.currentScale;
  reader.viewer.updateScale({ scaleFactor: Math.max(.2, Math.min(5, current * factor)) / current, drawingDelay: 120, origin: [event.clientX, event.clientY] });
  clearTimeout(zoomSaveTimer); zoomSaveTimer = setTimeout(saveState, 200);
}, { passive: false, capture: true });
function resizeViewer() {
  requestAnimationFrame(() => {
    if (!reader.document) return;
    const zoom = reader.viewer.currentScaleValue;
    if (['auto', 'page-width', 'page-fit'].includes(zoom)) reader.viewer.currentScaleValue = zoom;
    reader.viewer.update();
  });
}
new ResizeObserver(resizeViewer).observe(element('#reading-stage'));

function closeFind() { element('#find-bar').hidden = true; reader.bus.dispatch('findbarclose', { source: reader }); }
function openFind() { element('#find-bar').hidden = false; element<HTMLInputElement>('#find-input').focus(); element<HTMLInputElement>('#find-input').select(); }
function findNext(previous = false) { const query = element<HTMLInputElement>('#find-input').value; if (query.trim()) reader.find(query, previous, true); else openFind(); }
element('#find-input').addEventListener('input', () => { reader.find(element<HTMLInputElement>('#find-input').value); });
element('#find-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findNext(event.shiftKey); } });

const commands = [
  { title: 'Capture passage by text', detail: 'Find a PDF text line and save its anchored quote without selecting with a mouse', key: 'g q', action: 'passage' },
  { title: 'Set colors by hex', detail: 'Type background and foreground hex colors without a native color picker', key: ': Set colors by hex', action: 'colors', global: true },
  { title: 'Add palette mapping by hex', detail: 'Type a source and replacement hex color', key: ': Add palette mapping by hex', action: 'mapping', global: true },
  { title: 'HardMode', detail: 'Toggle keyboard-only mode; Ctrl Shift F12 always exits. Resets on reload', key: 'Ctrl Shift F12', action: 'hard-mode', global: true },
  { title: 'Focus reference preview', detail: 'Move keyboard focus into the reference lens', key: 'g i', action: 'focus-preview' },
  { title: 'Focus document', detail: 'Return keyboard focus to the main paper', key: 'g m', action: 'focus-document' },
  { title: 'Tutor', detail: 'Start or resume a guided PDF expedition with missions, hints and local progress', key: ':Tutor', action: 'tutor', global: true },
  { title: 'All commands', detail: 'Search every action, setting, and reading theme', key: ':', action: 'commands', global: true },
  { title: 'Show reading dock', detail: 'Reveal controls and move keyboard focus to the dock', key: 'F6', action: 'dock' },
  { title: 'Print PDF', detail: 'Open this PDF in your browser’s built-in viewer for direct, crisp printing without saving a copy first', key: 'Ctrl P', action: 'print' },
  { title: 'Open original PDF for Zotero', detail: 'Open the source PDF in your browser viewer so Zotero Connector can capture it', key: '', action: 'open-original' },
  { title: 'Zoom in', detail: 'Increase the PDF magnification', key: '+', action: 'zoom-in' },
  { title: 'Zoom out', detail: 'Decrease the PDF magnification', key: '-', action: 'zoom-out' },
  { title: 'Toggle frosted panels', detail: 'Switch between transparent glass and solid controls', key: '', action: 'glass', global: true },
  { title: 'Toggle document recoloring', detail: 'Preserve original colors or apply reading colors', key: '', action: 'recolor', global: true },
  { title: 'Change page background', detail: 'Choose a custom page color', key: '', action: 'background', global: true },
  { title: 'Change text foreground', detail: 'Choose a custom text color', key: '', action: 'foreground', global: true },
  { title: 'Edit palette replacements', detail: 'Map source colors to your own palette', key: '', action: 'palette-settings', global: true },
  { title: 'Reset reading appearance', detail: 'Restore original Paper settings', key: '', action: 'reset-theme', global: true },
  { title: 'Clear local document copies', detail: 'Remove cached PDFs from the recent library', key: '', action: 'clear-library', global: true },
  { title: 'Close reference preview', detail: 'Return to the main reading view', key: '', action: 'close-portal' },
  { title: 'Open PDF from URL', detail: 'Read a web PDF directly, without saving a file first', key: 'g o', action: 'url', global: true },
  { title: 'Open a PDF', detail: 'Browse local folders and recent papers · arrows / h j k l · / filter', key: 'o', action: 'open', global: true },
  { title: 'Open recent document', detail: 'Your locally saved reading library', key: 'Shift O', action: 'recent', global: true },
  { title: 'Explore the field guide', detail: 'A real PDF to try the reader', key: '', action: 'demo', global: true },
  { title: 'Find in document', detail: 'Search selectable text', key: '/', action: 'search' },
  { title: 'Find equation', detail: 'Look up a number and preview its definition', key: 'e', action: 'equation' },
  { title: 'Find citation', detail: 'Search reference numbers, author names, or titles', key: 'c', action: 'citation' },
  { title: 'Find figure or table', detail: 'Find captions in the document', key: 'v', action: 'figure' },
  { title: 'Peek at selected reference', detail: 'Select an equation, citation, or figure number for a floating quick look', key: 'Alt Enter', action: 'peek-selection' },
  { title: 'Jump to selected reference', detail: 'Follow the selected equation, citation, or figure and keep a return point', key: 'Alt Shift Enter', action: 'jump-selection' },
  { title: 'Pin reference preview', detail: 'Keep the quick look beside the paper while reading', key: 'Shift P', action: 'pin-portal' },
  { title: 'Jump to previewed passage', detail: 'Follow the preview and keep a return point', key: '', action: 'portal-jump' },
  { title: 'Previous preview result', detail: 'Inspect the previous lookup result', key: 'Alt ↑', action: 'portal-back' },
  { title: 'Next preview result', detail: 'Inspect the next lookup result', key: 'Alt ↓', action: 'portal-forward' },
  { title: 'Previous preview page', detail: 'Browse the paper independently inside the lens', key: 'Alt PageUp', action: 'preview-previous-page' },
  { title: 'Next preview page', detail: 'Continue to the next page without moving the main document', key: 'Alt PageDown', action: 'preview-next-page' },
  { title: 'Show preview citation mentions', detail: 'Find passages that cite the previewed bibliography entry', key: '', action: 'portal-backlinks' },
  { title: 'Field citation map', detail: 'Search OpenAlex for references, citing papers and related work; confirm before fetching', key: 'g c', action: 'graph' },
  { title: 'Local reference backlinks', detail: 'Within-PDF bibliography entries and citing passages; no network', key: '', action: 'local-graph' },
  { title: 'Toggle full-page preview', detail: 'Switch between detected content/column and the complete source page', key: '', action: 'preview-page' },
  { title: 'Capture selected passage', detail: 'Save a quote with its page and your notes on this device', key: 'q', action: 'capture' },
  { title: 'Research notebook', detail: 'Review saved passages, add notes, jump back, or export Markdown', key: 'Shift Q', action: 'notebook' },
  { title: 'Next equation', detail: 'Jump to the next equation definition', key: 'g e', action: 'next-equation' },
  { title: 'Previous equation', detail: 'Return to the previous equation definition', key: 'g E', action: 'previous-equation' },
  { title: 'Search document contents', detail: 'Filter embedded section titles and jump directly', key: 'g t', action: 'contents' },
  { title: 'Next section', detail: 'Move to the next embedded outline destination', key: 'g s', action: 'next-section' },
  { title: 'Previous section', detail: 'Move to the previous embedded outline destination', key: 'g S', action: 'previous-section' },
  { title: 'Search Google Scholar', detail: 'Search selected text, or type a query; sends that text to Google Scholar in a new tab', key: '', action: 'scholar' },
  { title: 'Go to page', detail: 'Jump to a page number; or type a number in the command menu', key: 'p', action: 'page' },
  { title: 'Follow a link', detail: 'Type the hint shown over a visible PDF link', key: 'f', action: 'links' },
  { title: 'Reference lens', detail: 'Peek at visible equations, figures, tables, citations and internal links; scroll for surrounding context', key: 'Shift F', action: 'preview-links' },
  { title: 'Document contents', detail: 'Show the embedded outline', key: 't', action: 'sidebar' },
  { title: 'Bookmark this page', detail: 'Toggle a bookmark at the current page', key: 'b', action: 'bookmark' },
  { title: 'Show bookmarks', detail: 'Return to your reading trail', key: 'Shift B', action: 'bookmarks' },
  { title: 'Return to previous position', detail: 'Back through jumps and references', key: 'Alt ←', action: 'history-back' },
  { title: 'Go forward', detail: 'Forward through your reading trail', key: 'Alt →', action: 'history-forward' },
  { title: 'Focus mode', detail: 'Hide the interface and stay with the page', key: 'z', action: 'focus' },
  { title: 'Reading ruler', detail: 'A movable line to guide your eyes', key: 'r', action: 'ruler' },
  { title: 'Fit page width', detail: 'Make the text comfortable to read', key: 'w / =', action: 'fit-width' },
  { title: 'Smart width', detail: 'Fit the current page’s text bounds, excluding outer margins; scans use page width', key: 'Shift W', action: 'smart-width' },
  { title: 'Toggle Vimium compatibility', detail: 'Leave plain navigation and tab keys to Vimium; use Ctrl K for PDF commands', key: '', action: 'vimium', global: true },
  { title: 'Fit whole page', detail: 'See the page in context', key: 'a', action: 'fit-page' },
  { title: 'Rotate clockwise', detail: 'Rotate every page by 90 degrees', key: 'Shift R', action: 'rotate' },
  { title: 'Two-page spread', detail: 'Toggle single and facing pages', key: '', action: 'spread' },
  { title: 'Reading settings', detail: 'Themes, page colors, and palette replacements', key: ',', action: 'settings', global: true },
  { title: 'Cycle reading theme', detail: 'Move through the full light and dark theme collection', key: 'g d', action: 'theme', global: true },
  { title: 'Download original PDF', detail: 'Save an unmodified copy', key: '', action: 'download' },
  { title: 'Keyboard guide', detail: 'A shortcut to everywhere', key: '?', action: 'help', global: true },
  ...themes.map(theme => ({ title: `Theme: ${theme.name}`, detail: `${theme.mode === 'light' ? 'Light' : 'Dark'} reading palette`, key: '', action: `theme:${theme.id}`, global: true })),
].map(command => ({ ...command, global: 'global' in command && command.global, key: displayShortcut(command.action, command.key) }));

function actionAvailable(action: string) {
  if (action === 'open-original') return !!originalPdfUrl;
  if (action === 'focus-preview') return !!portalTarget;
  if (action === 'history-back') return backward.length > 0;
  if (action === 'history-forward') return forward.length > 0;
  if (action === 'portal-back') return previewIndex > 0;
  if (action === 'portal-forward') return previewIndex + 1 < previewItems.length;
  if (action === 'preview-previous-page') return !!portalTarget && portalTarget.page > 1;
  if (action === 'preview-next-page') return !!portalTarget && portalTarget.page < (reader.document?.numPages || 0);
  if (action === 'portal-backlinks') return !!portalTarget?.citation;
  if (['portal-jump', 'pin-portal', 'close-portal', 'preview-page'].includes(action)) return !!portalTarget;
  return true;
}
initializeDock(commands, runAction, actionAvailable);

function showDialog(id: string) {
  if (id === '#help-dialog') { element<HTMLInputElement>('#help-filter').value = ''; renderShortcutGuide(); }
  returnFocus = document.activeElement as HTMLElement;
  element<HTMLDialogElement>(id).showModal();
}
function closeDialog(dialog: HTMLDialogElement) { dialog.close(); (returnFocus?.isConnected ? returnFocus : reader.container).focus(); }

function openPalette(mode: string) {
  rememberSelection();
  paletteMode = mode; selected = 0; closeHints();
  const titles: Record<string, string> = { commands: 'Find a command', url: 'Open PDF from URL', page: 'Go to page', equation: 'Find an equation', citation: 'Find a citation', figure: 'Find a figure or table', recent: 'Your recent reading', contents: 'Search document contents', passage:'Capture passage by text', colors:'Set background and foreground', mapping:'Add palette mapping' };
  const placeholders: Record<string, string> = { commands: 'What would you like to do?', url: 'https://example.org/paper.pdf', page: `Page number (1–${reader.document?.numPages || 1})`, equation: 'Equation number, e.g. 2 or A.1', citation: 'Reference number, author, or title…', figure: 'Figure or table number…', recent: 'Find a document…', contents: 'Find a section…' };
  element('#palette-title').textContent = titles[mode];
  if (mode === 'scholar-query') titles[mode] = 'Search Google Scholar';
  element('#palette-title').textContent = titles[mode];
  paletteInput.placeholder = mode === 'scholar-query' ? 'Type a research query…' : mode === 'passage' ? 'Find a phrase (at least two characters)…' : ['colors','mapping'].includes(mode) ? '#243f35 #f5f2e9 — two hex colors' : placeholders[mode]; paletteInput.setAttribute('aria-label', titles[mode]);
  paletteInput.value = ''; paletteInput.inputMode = mode === 'page' ? 'numeric' : mode === 'url' ? 'url' : 'text';
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
      choices = commands.filter(command => (reader.document || command.global) && actionAvailable(command.action) && terms.every(term => `${command.title} ${command.detail}`.toLowerCase().includes(term))).map(command => ({ ...command, action: () => runAction(command.action) }));
      const page = Number(query);
      if (/^\d+$/.test(query) && reader.document && page >= 1 && page <= reader.document.numPages) choices.unshift({ title: `Go to page ${page}`, detail: 'Your reading trail is preserved', action: () => goTo(page) });
    } else if (paletteMode === 'scholar-query') {
      choices = query ? [{title:'Search Google Scholar',detail:'Sends this query to Google Scholar in a new tab',action:()=>window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(query.slice(0,2000))}`,'_blank','noopener,noreferrer')}] : [];
    } else if (paletteMode === 'passage') {
      choices = query.length < 2 ? [] : indexedLines.filter(line => terms.every(term => line.text.toLowerCase().includes(term))).slice(0,60).map(line => ({ title:line.text, detail:`Page ${line.page} · save this text line as an anchored quote`, action:()=>notebook.captureText(line.text,line.page,line.y) }));
    } else if (['colors','mapping'].includes(paletteMode)) {
      const colors = query.split(/\s+/);
      const valid = colors.length === 2 && colors.every(color => /^#[\da-f]{6}$/i.test(color));
      choices = valid ? [{ title:paletteMode === 'colors' ? 'Apply paper and text colors' : 'Add color replacement', detail:colors.join(' → '), action:()=>{
        if (paletteMode === 'colors') { preferences.background=colors[0]; preferences.foreground=colors[1]; preferences.theme='custom'; }
        else { if(preferences.palette.length>=12) { toast('Maximum 12 palette mappings; remove one in Settings first.'); return; } preferences.palette.push({from:colors[0],to:colors[1]}); }
        applyPreferences();
      } }] : [];
    } else if (paletteMode === 'url') {
      let url: URL | undefined;
      try { url = new URL(query); } catch { url = undefined; }
      choices = url && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? [{ title: 'Read this PDF', detail: url.href, action: () => { void openDocument(url!.href, url!.pathname.split('/').pop() || 'document.pdf'); } }] : [];
    } else if (paletteMode === 'contents') {
      choices = outline.filter(entry => terms.every(term => entry.title.toLowerCase().includes(term))).map(entry => ({ title: entry.title, detail: 'Document contents', action: () => { if (entry.dest) { pushHistory(); void reader.links.goToDestination(entry.dest as string | unknown[]).catch(fail); } } }));
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
      const previews = hits.map(previewForHit);
      choices = hits.map((hit: ReferenceHit, index: number) => ({ title: previews[index].label, detail: `Page ${hit.page} · ${hit.text}`, action: jump => { if (jump) goTo(hit.page, hit.y); else void showPortal(previews[index], previews); } }));
    }
    selected = 0; renderChoices();
  } catch (error) { if (generation !== querySequence) return; choices = []; element('#palette-results').innerHTML = `<p class="empty-state">${esc(String(error))}</p>`; }
}

function renderChoices() {
  let empty = 'No matches. Try a different phrase.';
  if (paletteMode === 'url') empty = 'Paste a direct HTTP(S) PDF link. No copy is saved to Downloads. The web app requires a CORS-enabled source; the extension can access permitted sites.';
  if (paletteMode === 'page') empty = 'Enter a page number within this document.';
  if (['equation', 'citation', 'figure'].includes(paletteMode) && !indexed) empty = 'Indexing the document… Results will appear as pages are read.';
  else if (['equation', 'citation', 'figure'].includes(paletteMode) && !hasText) empty = 'No selectable text was found. This PDF may need OCR before references can be located.';
  else if (paletteMode === 'recent') empty = 'Open a local PDF to start your reading library.';
  else if (paletteMode === 'contents' && !outline.length) empty = 'This PDF has no embedded outline. Use the page menu or text search.';
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
  applyThemeTokens(preferences.theme);
  document.documentElement.dataset.glass = String(preferences.glass);
  const paper = preferences.palette.find(entry => entry.from.toLowerCase() === '#ffffff')?.to || (preferences.recolor ? preferences.background : '#ffffff');
  document.documentElement.style.setProperty('--pdf-background', paper);
  reader.applyPreferences(preferences);
  saveStored('paperterm.preferences.v2', preferences);
  element<HTMLInputElement>('#background-color').value = preferences.background;
  element<HTMLInputElement>('#foreground-color').value = preferences.foreground;
  element<HTMLInputElement>('#recolor-toggle').checked = preferences.recolor;
  element<HTMLInputElement>('#glass-toggle').checked = preferences.glass;
  document.querySelectorAll<HTMLElement>('button[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === preferences.theme)));
}
function chooseTheme(id: string) {
  const theme = getTheme(id);
  preferences.theme = theme.id; preferences.recolor = theme.id !== 'paper';
  [preferences.background, preferences.foreground] = [theme.background, theme.foreground];
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

async function openPrintPdf() {
  if (!reader.document) return;
  // Open synchronously from the user gesture so popup blockers do not discard
  // the PDF tab while PDF.js serializes the source bytes.
  const printTab = window.open('about:blank', '_blank');
  if (!printTab) { toast('Allow pop-ups for Pipit to open the print-ready PDF.'); return; }
  try {
    const bytes = await reader.document.getData();
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    printTab.location.replace(url);
    const cleanup = window.setInterval(() => {
      if (printTab.closed) { clearInterval(cleanup); URL.revokeObjectURL(url); }
    }, 5000);
    window.addEventListener('pagehide', () => { clearInterval(cleanup); URL.revokeObjectURL(url); }, { once: true });
  } catch (error) {
    printTab.close();
    throw error;
  }
}

function openOriginalPdfForZotero() {
  if (!originalPdfUrl) { toast('This PDF was opened from a local file; there is no browser URL to hand off.'); return; }
  const url = new URL(originalPdfUrl);
  // This one-navigation bypass lets Firefox's native PDF viewer and Zotero
  // Connector see the publisher response without disabling Pipit globally.
  url.searchParams.set('pipit-download', '1');
  window.open(url.href, '_blank', 'noopener,noreferrer');
}

function textLineCenters() {
  const stage = element('#reading-stage').getBoundingClientRect();
  const viewport = reader.container.getBoundingClientRect();
  const centers: number[] = [];
  for (const span of reader.container.querySelectorAll<HTMLElement>('.textLayer span')) {
    const box = span.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0 || box.bottom <= stage.top || box.top >= stage.bottom || box.bottom <= viewport.top || box.top >= viewport.bottom) continue;
    centers.push(box.top + box.height / 2 - stage.top);
  }
  centers.sort((a, b) => a - b);
  const lines: number[] = [];
  for (const center of centers) {
    const previous = lines.at(-1);
    if (previous !== undefined && center - previous <= 4) lines[lines.length - 1] = (previous + center) / 2;
    else lines.push(center);
  }
  return { height: stage.height, lines };
}

function placeRulerAt(center: number, stageHeight: number) {
  const ruler = element('#reading-ruler');
  ruler.hidden = false;
  const top = Math.max(0, Math.min(stageHeight - ruler.offsetHeight, center - ruler.offsetHeight / 2));
  ruler.style.top = `${(top / Math.max(1, stageHeight)) * 100}%`;
}

function moveRuler(direction: -1 | 1) {
  const ruler = element('#reading-ruler');
  ruler.hidden = false;
  const { height, lines } = textLineCenters();
  if (!height || !lines.length) { toast('The visible page has no selectable text lines for the reading ruler.'); return; }
  const currentTop = parseFloat(ruler.style.top || '40');
  const center = height * currentTop / 100 + ruler.offsetHeight / 2;
  const next = direction > 0 ? lines.find(line => line > center + 3) : lines.slice().reverse().find(line => line < center - 3);
  if (next !== undefined) { placeRulerAt(next, height); return; }
  const gaps = lines.slice(1).map((line, index) => line - lines[index]).filter(gap => gap >= 8 && gap <= 64);
  const lineHeight = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 20;
  const before = reader.container.scrollTop;
  reader.container.scrollBy({ top: direction * lineHeight, behavior: 'instant' });
  if (Math.abs(reader.container.scrollTop - before) < 1) { toast(direction > 0 ? 'You are at the last visible text line.' : 'You are at the first visible text line.'); return; }
  requestAnimationFrame(() => {
    const updated = textLineCenters();
    if (!updated.lines.length) return;
    placeRulerAt(direction > 0 ? updated.lines.at(-1)! : updated.lines[0], updated.height);
  });
}

function previewForHit(hit: ReferenceHit): PreviewTarget {
  return { page: hit.page, y: hit.y, x: hit.x, label: hit.kind === 'equation' ? `Equation (${hit.label})` : hit.kind === 'citation' ? `Reference [${hit.label}]` : hit.label, citation: hit.kind === 'citation' ? hit.label : undefined };
}
const referencePattern = /\(((?:[A-Z]\.?)?\d+(?:[.\-]\d+)*[a-z]?)\)|\[(\d+)(?:\s*[,–-]\s*\d+)*\]|(?:Eq(?:uation)?s?\.?|Fig(?:ure)?s?\.?|Table)\s*\(?((?:[A-Z]\.?)?\d+(?:\.\d+)*)\)?/gi;
function referenceQuery(text: string): { query: string; kind: ReferenceKind } | null {
  const match = [...text.matchAll(referencePattern)][0];
  if (!match) return /^\d+(?:\.\d+)*$/.test(text.trim()) ? { query: text.trim(), kind: 'equation' } : null;
  return { query: match[1] || match[2] || match[3], kind: match[1] || /^Eq/i.test(match[0]) ? 'equation' : match[2] ? 'citation' : 'figure' };
}
async function followReference(text: string, jump = false) {
  const request = referenceQuery(text);
  if (!request) { toast('Select an equation number, [citation], or figure label first.'); return; }
  const sequence = loadSequence;
  const hits = await engine.lookup(request.query, request.kind);
  if (sequence !== loadSequence) return;
  if (!hits.length) { toast(indexed ? 'No reference target found. Try E, C, or V to search manually.' : 'References are still indexing. Try again in a moment.'); return; }
  if (jump) goTo(hits[0].page, hits[0].y);
  else void showPortal(previewForHit(hits[0]), hits.map(previewForHit));
}
function selectedReference() {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  return node && reader.container.contains(node) && !selection!.isCollapsed ? selection!.toString().slice(0, 2000) : selectedPdfText;
}
function rememberSelection() {
  const selection = window.getSelection();
  if (selection?.anchorNode && reader.container.contains(selection.anchorNode) && !selection.isCollapsed) selectedPdfText = selection.toString().slice(0, 2000);
  notebook.rememberSelection();
}
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (selection?.anchorNode && reader.container.contains(selection.anchorNode) && !selection.isCollapsed) selectedPdfText = selection.toString().slice(0, 2000);
});
document.addEventListener('pointerdown', event => {
  const target = event.target as HTMLElement;
  if (reader.container.contains(target)) selectedPdfText = '';
  else if (target.closest('#reader-toolbar, [data-action="commands"]')) rememberSelection();
}, true);
async function nextEquation(direction: number) {
  const sequence = loadSequence;
  const hits = await engine.lookup('', 'equation');
  if (sequence !== loadSequence) return;
  const ordered = hits.filter(hit => /^\s*\(/.test(hit.text) || hit.x > .6 || /[=∝≈≤≥].*\([A-Z]?\.?\d+(?:[.\-]\d+)*[a-z]?\)\s*$/.test(hit.text)).sort((left, right) => left.page - right.page || left.y - right.y);
  const view = reader.viewer.getPageView(reader.viewer.currentPageNumber - 1);
  const ypos = view?.div ? (reader.container.scrollTop - view.div.offsetTop + reader.container.clientHeight / 2) / view.div.clientHeight : 0;
  const position = reader.viewer.currentPageNumber + ypos;
  const target = direction > 0 ? ordered.find(hit => hit.page + hit.y > position + .01) : ordered.slice().reverse().find(hit => hit.page + hit.y < position - .01);
  if (target) goTo(target.page, target.y); else toast(direction > 0 ? 'No later equation definition found.' : 'No earlier equation definition found.');
}
async function nextSection(direction: number) {
  const sequence = loadSequence;
  const resolved = await Promise.all(outline.filter(entry => entry.dest).map(async entry => ({ entry, target: await reader.resolveDestination(entry.dest!) })));
  if (sequence !== loadSequence) return;
  const position = reader.viewer.currentPageNumber + Math.max(0, reader.offset);
  const sections = resolved.filter(item => item.target).sort((left, right) => left.target!.page + left.target!.y - right.target!.page - right.target!.y);
  const found = direction > 0 ? sections.find(item => item.target!.page + item.target!.y > position + .02) : sections.slice().reverse().find(item => item.target!.page + item.target!.y < position - .02);
  if (found?.target) goTo(found.target.page, found.target.y); else toast(outline.length ? 'No further section in this direction.' : 'This PDF has no embedded outline.');
}

function runAction(action: string) {
  if (action === 'hard-mode') { hardMode.toggle(); return; }
  if (action.startsWith('theme:')) { chooseTheme(action.slice(6)); return; }
  const global = ['open', 'url', 'demo', 'tutor', 'commands', 'settings', 'help', 'close-dialog', 'cancel-password', 'reset-theme', 'add-color', 'theme', 'recent', 'clear-library', 'glass', 'recolor', 'background', 'foreground', 'palette-settings', 'colors', 'mapping'];
  if ((!reader.document || opening) && !global.includes(action)) { toast('Open a PDF to use this command.'); return; }
  switch (action) {
    case 'focus-preview': if (portalTarget) element('#portal-scroll').focus(); break;
    case 'focus-document': reader.container.focus(); break;
    case 'tutor': tutor.open(); break;
    case 'open': void openFileBrowser(); break;
    case 'demo': void openDocument(new URL('sample.pdf', document.baseURI).href, 'The art of following an idea.pdf'); break;
    case 'commands': case 'url': case 'page': case 'equation': case 'citation': case 'figure': case 'recent': case 'contents': case 'passage': case 'colors': case 'mapping': openPalette(action); break;
    case 'peek-selection': case 'jump-selection': void followReference(selectedReference(), action === 'jump-selection').catch(fail); break;
    case 'next-equation': case 'previous-equation': void nextEquation(action === 'next-equation' ? 1 : -1).catch(fail); break;
    case 'next-section': case 'previous-section': void nextSection(action === 'next-section' ? 1 : -1).catch(fail); break;
    case 'graph': openResearch(); break;
    case 'local-graph': research.open(); break;
    case 'preview-page': if (portalTarget) { previewFullPage = !previewFullPage; sizePreview(); void renderPreview(); } break;
    case 'portal-backlinks': if (portalTarget?.citation) openResearch(portalTarget.citation); else toast('Preview a bibliography entry to see its mentions.'); break;
    case 'capture': notebook.capture(); break;
    case 'notebook': notebook.open(); break;
    case 'scholar': { const text = selectedReference().trim(); if (text) window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(text.slice(0, 2000))}`, '_blank', 'noopener,noreferrer'); else openPalette('scholar-query'); break; }
    case 'search': openFind(); break;
    case 'find-next': findNext(); break;
    case 'find-prev': findNext(true); break;
    case 'close-find': closeFind(); reader.container.focus(); break;
    case 'zoom-in':
    case 'zoom-out': {
      const factor = action === 'zoom-in' ? 1.15 : 1 / 1.15;
      if (portalTarget && element('#portal').contains(document.activeElement)) {
        previewZoom = Math.max(.6, Math.min(2.5, previewZoom * factor)); void showPortal(portalTarget, undefined, true);
      } else { reader.viewer.currentScale = Math.max(.2, Math.min(5, reader.viewer.currentScale * factor)); saveState(); }
      break;
    }
    case 'fit-width': reader.viewer.currentScaleValue = 'page-width'; saveState(); break;
    case 'smart-width': void reader.smartWidth().then(saveState).catch(fail); break;
    case 'vimium': vimiumMode = !vimiumMode; saveStored('paperterm.vimium', vimiumMode); element<HTMLInputElement>('#vimium-toggle').checked = vimiumMode; toast(vimiumMode ? 'Vimium owns plain navigation keys. Use Ctrl+K for PDF commands; Backspace returns through the paper.' : 'Reader keyboard shortcuts enabled. x and X remain reserved for browser tabs.'); break;
    case 'fit-page': reader.viewer.currentScaleValue = 'page-fit'; saveState(); break;
    case 'rotate': reader.viewer.pagesRotation = (reader.viewer.pagesRotation + 90) % 360; closeHints(); break;
    case 'spread': reader.viewer.spreadMode = reader.viewer.spreadMode ? 0 : 1; break;
    case 'dock': showDock(); break;
    case 'sidebar': toggleSidebar(); break;
    case 'outline': case 'bookmarks': navigationTab = action; toggleSidebar(true); renderNavigation(); break;
    case 'bookmark': bookmark(); break;
    case 'history-back': historyMove(true); break;
    case 'history-forward': historyMove(false); break;
    case 'focus': collapseControls(); document.body.classList.toggle('focus-mode'); element('#exit-focus').hidden = !document.body.classList.contains('focus-mode'); resizeViewer(); break;
    case 'ruler': element('#reading-ruler').hidden = !element('#reading-ruler').hidden; break;
    case 'close-portal': closePortal(); reader.container.focus(); break;
    case 'pin-portal': pinPreview(); break;
    case 'portal-back': movePreview(-1); break;
    case 'portal-forward': movePreview(1); break;
    case 'preview-next-page': case 'preview-previous-page': {
      if (!portalTarget || !reader.document) break;
      const page = portalTarget.page + (action === 'preview-next-page' ? 1 : -1);
      if (page < 1 || page > reader.document.numPages) { toast('No further page in this direction.'); break; }
      void showPortal({ page, y: 0, x: portalTarget.x, label: `Page ${page} context` });
      break;
    }
    case 'portal-jump': if (portalTarget) {
      const target = portalTarget, wasPinned = previewPinned, origin = reader.viewer.currentPageNumber;
      pushHistory(); closePortal(); reader.container.focus({ preventScroll: true });
      const pending = { queuedHistory: [] as boolean[] }; pendingPortalJump = pending;
      const finish = () => {
        if (pendingPortalJump !== pending || !reader.document) return;
        pendingPortalJump = null; tutor.followed(target.page, origin);
        reader.goTo(target.page, target.y); saveState(); reader.container.focus();
        pending.queuedHistory.forEach(historyMove);
      };
      if (!wasPinned) finish();
      else {
        // Wait for the wider reader's adaptive zoom before resolving PDF coords.
        // Queue rapid back/forward keys instead of losing them during reflow.
        requestAnimationFrame(() => requestAnimationFrame(finish));
        setTimeout(finish, 200);
      }
    } break;
    case 'settings': renderMappings(); showDialog('#settings-dialog'); break;
    case 'glass': preferences.glass = !preferences.glass; applyPreferences(); break;
    case 'recolor': preferences.recolor = !preferences.recolor; applyPreferences(); break;
    case 'background': case 'foreground': case 'palette-settings': renderMappings(); showDialog('#settings-dialog'); element(action === 'palette-settings' ? '[data-action="add-color"]' : `#${action}-color`).focus(); break;
    case 'help': showDialog('#help-dialog'); break;
    case 'close-dialog': { const dialog = document.querySelector<HTMLDialogElement>('dialog[open]'); if (dialog) closeDialog(dialog); break; }
    case 'download': void download().catch(fail); break;
    case 'print': void openPrintPdf().catch(fail); break;
    case 'open-original': openOriginalPdfForZotero(); break;
    case 'theme': chooseTheme(themes[(themes.findIndex(theme => theme.id === preferences.theme) + 1) % themes.length].id); break;
    case 'reset-theme': preferences = structuredClone(defaults); applyPreferences(); renderMappings(); break;
    case 'add-color': if (preferences.palette.length < 12) { preferences.palette.push({ from: '#0000ff', to: '#5a8a76' }); renderMappings(); applyPreferences(); } break;
    case 'links': showHints(false); break;
    case 'preview-links': case 'smart-hints': showSmartHints(); break;
    case 'cancel-password': finishPassword(null); break;
    case 'clear-library': if (window.confirm('Clear locally saved PDF copies? Original files, notes, and bookmarks are not deleted.')) void clearBooks().then(() => { toast('Local document copies cleared.'); return renderRecent(); }).catch(fail); break;
  }
}

async function previewLink(anchor: HTMLAnchorElement, jump = false) {
  if (!reader.document) return;
  const section = anchor.closest<HTMLElement>('[data-annotation-id]');
  const pageElement = anchor.closest<HTMLElement>('.page');
  if (!section || !pageElement) { toast('This link has no internal PDF destination to preview.'); return; }
  const page = await reader.document.getPage(Number(pageElement.dataset.pageNumber));
  const annotations = await page.getAnnotations();
  const annotation = annotations.find(item => item.id === section.dataset.annotationId);
  if (!annotation?.dest) { toast('External links are not loaded in the lens. Use f to follow the link.'); return; }
  const target = await reader.resolveDestination(annotation.dest);
  if (target) { if (jump) goTo(target.page, target.y); else void showPortal({ ...target, label: 'Linked passage' }); }
}

function referenceUnderPointer(event: MouseEvent): string | null {
  const span = (event.target as HTMLElement).closest<HTMLElement>('.textLayer span');
  const text = span?.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return null;
  for (const match of (text.textContent || '').matchAll(referencePattern)) {
    const range = document.createRange(); range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length);
    const box = range.getBoundingClientRect();
    if (event.clientX >= box.left - 4 && event.clientX <= box.right + 4 && event.clientY >= box.top - 4 && event.clientY <= box.bottom + 4) return match[0];
  }
  return null;
}
reader.container.addEventListener('contextmenu', event => {
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('.annotationLayer a');
  const reference = referenceUnderPointer(event);
  if (!anchor && !reference) return;
  event.preventDefault(); event.stopPropagation();
  if (anchor) void previewLink(anchor).catch(fail); else void followReference(reference!).catch(fail);
}, true);
reader.container.addEventListener('mousedown', event => {
  if (event.button !== 1) return;
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('.annotationLayer a');
  if (anchor || referenceUnderPointer(event)) event.preventDefault();
}, true);
reader.container.addEventListener('auxclick', event => {
  if (event.button !== 1) return;
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('.annotationLayer a');
  const reference = referenceUnderPointer(event);
  if (!anchor && !reference) return;
  event.preventDefault(); event.stopPropagation();
  if (anchor) void previewLink(anchor, true).catch(fail); else void followReference(reference!, true).catch(fail);
}, true);

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
  const candidates: { box: DOMRect; action: () => void }[] = [];
  const sequence = loadSequence;
  for (const span of reader.container.querySelectorAll<HTMLElement>('.textLayer span')) {
    const text = span.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) continue;
    for (const match of span.textContent!.matchAll(referencePattern)) {
      const range = document.createRange(); range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length);
      const box = range.getBoundingClientRect();
      if (box.bottom < bounds.top || box.top > bounds.bottom || box.right < bounds.left || box.left > bounds.right) continue;
      candidates.push({ box, action: () => { if (sequence === loadSequence) void followReference(match[0]).catch(fail); } });
    }
  }
  for (const anchor of reader.container.querySelectorAll<HTMLAnchorElement>('.annotationLayer a[href]')) {
    const box = anchor.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom < bounds.top || box.top > bounds.bottom || box.right < bounds.left || box.left > bounds.right) continue;
    if (candidates.some(candidate => candidate.box.left < box.right && candidate.box.right > box.left && candidate.box.top < box.bottom && candidate.box.bottom > box.top)) continue;
    if (!anchor.classList.contains('internalLink')) continue;
    candidates.push({ box, action: () => { if (sequence === loadSequence) void previewLink(anchor).catch(fail); } });
  }
  const alphabet = 'asdfghjklqwertyuiopzxcvbnm';
  candidates.slice(0, alphabet.length ** 2).forEach((candidate, index) => {
    const label = candidates.length > alphabet.length ? alphabet[Math.floor(index / alphabet.length)] + alphabet[index % alphabet.length] : alphabet[index];
    const button = document.createElement('span'); button.className = 'link-hint'; button.textContent = label;
    button.style.left = `${candidate.box.left - stage.left}px`; button.style.top = `${candidate.box.top - stage.top}px`;
    element('#link-hints').append(button);
    hints.push({ label, button, action: candidate.action });
  });
  toast(hints.length ? 'Type a hint to peek. Scroll inside for context; Enter follows. Escape cancels.' : 'No references visible here. Try e, c, or v for a manual lookup.');
}
reader.container.addEventListener('scroll', () => {
  if (hints.length && (reader.container.scrollTop !== hintScrollTop || reader.container.scrollLeft !== hintScrollLeft)) closeHints();
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
  if (target.dataset.theme) chooseTheme(target.dataset.theme);
  if (target.dataset.themeFilter) {
    document.querySelectorAll<HTMLElement>('[data-theme-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    document.querySelectorAll<HTMLElement>('.theme-options [data-theme]').forEach(button => { button.hidden = target.dataset.themeFilter !== 'all' && getTheme(button.dataset.theme!).mode !== target.dataset.themeFilter; });
  }
  if (target.dataset.removeMapping !== undefined) { preferences.palette.splice(Number(target.dataset.removeMapping), 1); renderMappings(); applyPreferences(); }
  if (target.dataset.recent) void readBook(target.dataset.recent).then(book => { if (book) void openDocument(book.blob, book.name, book.id); }).catch(fail);
});

document.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'file-input') { const file = target.files?.[0]; if (file) void openDocument(file, file.name); target.value = ''; }
  if (target.id === 'background-color') { preferences.background = target.value; preferences.recolor = true; applyPreferences(); }
  if (target.id === 'foreground-color') { preferences.foreground = target.value; preferences.recolor = true; applyPreferences(); }
  if (target.id === 'recolor-toggle') { preferences.recolor = target.checked; applyPreferences(); }
  if (target.id === 'glass-toggle') { preferences.glass = target.checked; applyPreferences(); }
  if (target.dataset.mapping !== undefined) { const entry = preferences.palette[Number(target.dataset.mapping)]; entry[target.dataset.channel as 'from' | 'to'] = target.value; applyPreferences(); }
});

function startPrefix(value: string) {
  prefix = value; clearTimeout(prefixTimer);
  if (!tutor.active()) prefixTimer = setTimeout(() => { prefix = ''; }, 1800);
  if (value === 'm') toast('Set mark: press a letter a–z');
  if (value === "'") toast('Go to mark: press a letter a–z');
}

let vimiumMode = readStored<boolean>('paperterm.vimium', false);
element<HTMLInputElement>('#vimium-toggle').checked = vimiumMode;
element('#vimium-toggle').addEventListener('change', () => runAction('vimium'));
window.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const target = event.target instanceof HTMLElement ? event.target : document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  const typing = !(tutor.active() && (target.matches('#tutor-keyboard, #tutor-preview-keyboard') || !!target.closest('#tutor-panel'))) && (target.matches('input, textarea, select') || target.isContentEditable);
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === 'Escape') {
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault(); prefix = ''; closeHints(); collapseControls();
    if (!element('#find-bar').hidden) closeFind(); else if (portalTarget) closePortal(); else if (document.body.classList.contains('focus-mode')) runAction('focus');
    reader.container.focus(); return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Tab' && portalTarget && !previewPinned) {
    const controls = [...element('#portal').querySelectorAll<HTMLElement>('button:not([disabled]), #portal-scroll')].filter(control => control.getClientRects().length);
    const index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus(); return;
    }
  }
  if (event.key === 'F6' && reader.document) { event.preventDefault(); runAction('dock'); return; }
  if (event.key === 'F1') { event.preventDefault(); runAction('help'); return; }
  if (modifier && event.key.toLowerCase() === 'o') { event.preventDefault(); runAction('open'); return; }
  if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); runAction('commands'); return; }
  if (modifier && event.key.toLowerCase() === 'f' && reader.document) { event.preventDefault(); openFind(); return; }
  if (modifier && event.key.toLowerCase() === 'p' && reader.document && !typing) { event.preventDefault(); runAction('print'); return; }
  if (typing || (target.tagName === 'BUTTON' && [' ', 'Enter'].includes(event.key))) return;
  if (event.altKey && event.key === 'Enter' && reader.document) { event.preventDefault(); runAction(event.shiftKey ? 'jump-selection' : 'peek-selection'); return; }
  if (event.key === 'x' && !modifier && !event.altKey) {
    if (isExtensionPage()) { event.preventDefault(); saveState(); void closeCurrentExtensionTab().catch(fail); }
    return;
  }
  if (event.key === 'X' && !modifier && !event.altKey) return;
  if (vimiumMode && !hardMode.enabled() && !modifier && !event.altKey && ![':', ',', 'Backspace'].includes(event.key)) return;
  if (hints.length && event.key === 'Backspace' && !modifier && !event.altKey) {
    event.preventDefault(); hintPrefix = hintPrefix.slice(0, -1);
    hints.forEach(hint => { hint.button.hidden = !hint.label.startsWith(hintPrefix); }); return;
  }
  if (hints.length && !modifier && !event.altKey && event.key.length === 1) {
    event.preventDefault(); hintPrefix += event.key.toLowerCase();
    const exact = hints.find(hint => hint.label === hintPrefix);
    if (exact) { const action = exact.action; closeHints(); action(); }
    else { hints.forEach(hint => { hint.button.hidden = !hint.label.startsWith(hintPrefix); }); if (!hints.some(hint => hint.label.startsWith(hintPrefix))) closeHints(); }
    return;
  }
  // Pressing Shift to enter an uppercase leader must not consume the prefix.
  if (prefix && ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(event.key)) return;
  if (prefix && !modifier && !event.altKey) {
    const pending = prefix; prefix = ''; clearTimeout(prefixTimer);
    if (pending === 'g' && event.key === 'g') { event.preventDefault(); goTo(1); return; }
    if (pending === 'g' && leaderActions[event.key]) { event.preventDefault(); runAction(leaderActions[event.key]); return; }
    if (/^[a-z]$/.test(event.key) && pending === 'm') { event.preventDefault(); state.marks[event.key] = { page: reader.viewer.currentPageNumber, y: reader.offset }; saveState(); toast(`Mark ${event.key} → page ${reader.viewer.currentPageNumber}`); return; }
    if (/^[a-z]$/.test(event.key) && pending === "'") { event.preventDefault(); const mark = state.marks[event.key]; if (typeof mark === 'number') goTo(mark); else if (mark) { pushHistory(); reader.restoreFraction(mark.page, mark.y); } else toast(`Mark ${event.key} has not been set.`); return; }
  }
  if (event.key === 'Backspace' && !modifier && !event.altKey && reader.document) { event.preventDefault(); historyMove(!event.shiftKey); return; }
  if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key) && reader.document) { event.preventDefault(); historyMove(event.key === 'ArrowLeft'); return; }
  if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key) && portalTarget) { event.preventDefault(); movePreview(event.key === 'ArrowUp' ? -1 : 1); return; }
  if (event.altKey && ['PageUp', 'PageDown'].includes(event.key) && portalTarget) { event.preventDefault(); runAction(event.key === 'PageUp' ? 'preview-previous-page' : 'preview-next-page'); return; }
  if (event.key === 'Enter' && portalTarget && !target.closest('button, summary, a, [role="button"]') && !modifier && !event.altKey) { event.preventDefault(); runAction('portal-jump'); return; }
  if (modifier || event.altKey) return;
  if (['d', 'u'].includes(event.key) && reader.document) { event.preventDefault(); const container = (portalTarget && !previewPinned) || target.closest('#portal') ? element('#portal-scroll') : reader.container; container.scrollBy({ top: container.clientHeight * (event.key === 'd' ? .5 : -.5), behavior: 'instant' }); return; }
  const actions: Record<string, string> = { o: 'open', O: 'recent', '?': 'help', ',': 'settings', '/': 'search', ':': 'commands', p: 'page', P: 'pin-portal', e: 'equation', c: 'citation', v: 'figure', q: 'capture', Q: 'notebook', t: 'sidebar', b: 'bookmark', B: 'bookmarks', z: 'focus', r: 'ruler', R: 'rotate', w: 'fit-width', W: 'smart-width', a: 'fit-page', f: 'links', F: 'preview-links', s: 'smart-hints', '+': 'zoom-in', '=': 'fit-width', '-': 'zoom-out' };
  if (actions[event.key]) { event.preventDefault(); runAction(actions[event.key]); return; }
  if (event.key === 'g') { event.preventDefault(); startPrefix('g'); return; }
  if (!reader.document) return;
  const scrollContainer = (portalTarget && !previewPinned) || target.closest('#portal') ? element('#portal-scroll') : reader.container;
  if (['j', 'k', 'h', 'l', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' ', 'PageDown', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    const down = ['j', 'ArrowDown'].includes(event.key), up = ['k', 'ArrowUp'].includes(event.key);
    const pageDown = [' ', 'PageDown'].includes(event.key);
    const horizontal = ['h', 'l', 'ArrowLeft', 'ArrowRight'].includes(event.key);
    const before = scrollContainer.scrollTop;
    scrollContainer.scrollBy({ top: horizontal ? 0 : down ? 65 : up ? -65 : scrollContainer.clientHeight * (pageDown && !event.shiftKey ? .85 : -.85), left: horizontal ? ['h', 'ArrowLeft'].includes(event.key) ? -65 : 65 : 0, behavior: 'instant' });
    if (scrollContainer === reader.container) tutor.moved(event.key, before, scrollContainer.scrollTop);
  } else if (event.key === 'g' || event.key === 'm' || event.key === "'") { event.preventDefault(); startPrefix(event.key); }
  else if (event.key === 'G') { event.preventDefault(); goTo(reader.document.numPages); }
  else if (event.key === 'n' || event.key === 'N') { event.preventDefault(); findNext(event.key === 'N'); }
  else if (event.key === ']' || event.key === '[') { event.preventDefault(); moveRuler(event.key === ']' ? 1 : -1); }
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

function renderShortcutGuide() {
  const query = element<HTMLInputElement>('#help-filter').value.trim().toLowerCase();
  let count = 0;
  element('#help-keys').innerHTML = shortcutSections(commands).map(section => {
    const rows = section.rows.filter(([title, key]) => `${section.title} ${title} ${key}`.toLowerCase().includes(query));
    count += rows.length;
    return rows.length ? `<section class="help-group" aria-label="${esc(section.title)}"><h3>${esc(section.title)}</h3><dl>${rows.map(([title, key]) => `<div><dt>${esc(title)}</dt><dd><kbd>${esc(key)}</kbd></dd></div>`).join('')}</dl></section>` : '';
  }).join('') || '<p class="empty-state">No matching shortcuts. Try an action, section, or key.</p>';
  element('#help-count').textContent = `${count} shortcuts${query ? ' found' : ' · 8 sections'}`;
}
element('#help-filter').addEventListener('input', renderShortcutGuide);
renderShortcutGuide();
async function renderRecent() {
  try {
    const books = await listBooks();
    element('#recent-documents').innerHTML = books.length ? `<div class="recent-heading"><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><button class="text-button" data-action="clear-library">Clear local copies</button></div><div class="recent-grid">${books.slice(0, 3).map(book => `<button class="recent-book" data-recent="${esc(book.id)}">${icon('document')}<span>${esc(book.name)}</span>${icon('arrow')}</button>`).join('')}</div>` : '';
  } catch { element('#recent-documents').innerHTML = ''; }
}

initializeChrome();
applyPreferences();
void renderRecent();
const parameters = new URLSearchParams(location.search);
if (parameters.has('tutor')) runAction('tutor');
else if (parameters.has('demo')) runAction('demo');
else if (parameters.has('article')) void openDocument(parameters.get('article')!, 'Publisher paper.pdf', undefined, true);
else if (location.search.startsWith('?source=')) {
  const raw = location.search.slice('?source='.length);
  let name = 'document.pdf';
  try { name = decodeURIComponent(new URL(raw).pathname.split('/').pop() || 'document.pdf'); } catch {}
  void openDocument(raw, name);
} else if (parameters.has('file')) {
  const source = parameters.get('file')!;
  void openDocument(source, source.split('/').pop()?.split('?')[0] || 'document.pdf');
}
