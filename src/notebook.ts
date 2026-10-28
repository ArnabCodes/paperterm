import { icon } from './icons';
import { readStored, saveStored } from './preferences';
import { escapeHtml } from './types';
import { mergeNotebookEntries, notebookSidecar, parseNotebookSidecar, notebookLimits, type NotebookEntry } from './annotation-sidecar';

interface NotebookDocument { id: string; name: string; page: number; offset: number; pageCount?: number }
export interface NotebookHooks {
  getDocument(): NotebookDocument | null;
  goTo(page: number, offset?: number): void;
  toast(message: string): void;
  recordActivity?(action: string): void;
  closePreview?(): void;
}
export interface NotebookController { open(): void; capture(): void; highlight(): void; captureText(excerpt:string,page:number,offset:number): void; reset(): void; rememberSelection(): void; refreshHighlights(): void }

const entryLimit = 200;
const excerptLimit = 8000;
const noteLimit = 8000;
const storageKey = (id: string) => `pipit.notebook.v1:${id}`;
const markdownText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#!|~+\-]/g, '\\$&');
const validTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Date.now() + 86_400_000;
const formatTimestamp = (value: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function selectedExcerpt(): Pick<NotebookEntry, 'excerpt' | 'page' | 'offset'> | null {
  const viewer = document.querySelector<HTMLElement>('#viewer-container');
  const selection = window.getSelection();
  if (!viewer || !selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!viewer.contains(range.startContainer) || !viewer.contains(range.endContainer)) return null;
  const excerpt = selection.toString().trim();
  if (!excerpt) return null;
  const textRect = Array.from(range.getClientRects()).find(rect => rect.width > 0 && rect.height > 0);
  if (!textRect) return null;
  const startElement = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const pageElement = startElement?.closest<HTMLElement>('.page') ?? Array.from(viewer.querySelectorAll<HTMLElement>('.page')).find(element => {
    const rect = element.getBoundingClientRect();
    return textRect.top < rect.bottom && textRect.bottom > rect.top && textRect.left < rect.right && textRect.right > rect.left;
  });
  if (!pageElement || !viewer.contains(pageElement)) return null;
  const page = Number(pageElement.dataset.pageNumber);
  const pageRect = pageElement.getBoundingClientRect();
  if (!Number.isInteger(page) || page < 1 || pageRect.height <= 0) return null;
  return { excerpt, page, offset: Math.max(0, Math.min(1, (textRect.top - pageRect.top) / pageRect.height)) };
}

export function initializeNotebook(hooks: NotebookHooks): NotebookController {
  const panel = document.createElement('aside');
  panel.id = 'notebook-panel';
  panel.className = 'notebook-panel';
  panel.setAttribute('aria-label', 'Research notebook');
  panel.hidden = true;
  panel.innerHTML = `<section class="notebook-shell">
    <header class="notebook-header"><div class="notebook-heading"><span class="notebook-eyebrow">${icon('note')} Research notebook</span><h2 class="notebook-title"></h2><p class="notebook-subtitle">Excerpts and thoughts, saved only on this device.</p></div><button type="button" class="notebook-close" aria-label="Close notebook">${icon('close')}</button></header>
    <div class="notebook-toolbar"><button type="button" class="notebook-add">${icon('note')} Add text note</button><button type="button" class="notebook-export">${icon('export')} Export Markdown</button><span class="notebook-count"></span></div>
    <details class="notebook-portable"><summary>Notebook history &amp; backup</summary><div><button type="button" class="notebook-undo">${icon('back')} Undo note</button><button type="button" class="notebook-redo">${icon('next')} Redo note</button><button type="button" class="notebook-backup">${icon('download')} Save backup</button><button type="button" class="notebook-import">${icon('open')} Import backup</button></div><p>Highlights and notes are stored in a local sidecar, not embedded into the PDF. Note undo is separate from PDF undo; both appear in the local edit history.</p></details><input class="notebook-import-file" type="file" accept="application/json,.json" hidden>
    <p class="notebook-status" role="status" hidden></p><div class="notebook-list"></div>
    <footer class="notebook-footer">Local to this browser · Notes save as you type · Esc to close</footer>
  </section>`;
  document.querySelector('#reader')!.append(panel);
  const title = panel.querySelector<HTMLElement>('.notebook-title')!;
  const list = panel.querySelector<HTMLElement>('.notebook-list')!;
  const count = panel.querySelector<HTMLElement>('.notebook-count')!;
  const status = panel.querySelector<HTMLElement>('.notebook-status')!;
  const addButton = panel.querySelector<HTMLButtonElement>('.notebook-add')!;
  const exportButton = panel.querySelector<HTMLButtonElement>('.notebook-export')!;
  const undoButton = panel.querySelector<HTMLButtonElement>('.notebook-undo')!;
  const redoButton = panel.querySelector<HTMLButtonElement>('.notebook-redo')!;
  const backupButton = panel.querySelector<HTMLButtonElement>('.notebook-backup')!;
  const importFile = panel.querySelector<HTMLInputElement>('.notebook-import-file')!;
  addButton.title = 'Add text note (Ctrl/Cmd+Enter)';
  exportButton.title = 'Export Markdown (Ctrl/Cmd+S)';
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); panel.hidden = true; document.querySelector<HTMLElement>('#viewer-container')?.focus({ preventScroll: true }); return; }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!(event.target instanceof HTMLTextAreaElement) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); restoreEntries(event.shiftKey || event.key.toLowerCase() === 'y'); return; }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); exportButton.click(); }
    else if (event.key === 'Enter') { event.preventDefault(); addButton.click(); }
  });
  let activeDocument: NotebookDocument | null = null;
  let entries: NotebookEntry[] = [];
  let dirty = false;
  let undo: NotebookEntry[][] = [];
  let redo: NotebookEntry[][] = [];
  let lastEdit = '';
  let lastEditTime = 0;
  let cachedSelection: { documentId: string; location: Pick<NotebookEntry, 'excerpt' | 'page' | 'offset'> } | null = null;
  let highlightFrame = 0;

  function findExcerptRange(layer: HTMLElement, excerpt: string): Range | null {
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    const mappings: { node: Text; start: number; end: number }[] = [];
    let combined = '';
    let previous: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      if (!text.data) continue;
      if (previous && combined && !/\s$/.test(combined) && !/^\s/.test(text.data)) {
        combined += ' '; mappings.push({ node: previous, start: previous.length, end: previous.length });
      }
      for (let index = 0; index < text.length; index++) {
        const character = text.data[index];
        if (/\s/.test(character)) {
          if (combined && !combined.endsWith(' ')) { combined += ' '; mappings.push({ node: text, start: index, end: index + 1 }); }
        } else { combined += character.toLocaleLowerCase(); mappings.push({ node: text, start: index, end: index + 1 }); }
      }
      previous = text;
    }
    const target = excerpt.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    if (!target || mappings.length !== combined.length) return null;
    const start = combined.indexOf(target);
    if (start < 0) return null;
    const range = document.createRange();
    range.setStart(mappings[start].node, mappings[start].start);
    range.setEnd(mappings[start + target.length - 1].node, mappings[start + target.length - 1].end);
    return range;
  }

  function refreshHighlights() {
    cancelAnimationFrame(highlightFrame); highlightFrame = 0;
    document.querySelectorAll('.pipit-annotation-layer').forEach(layer => layer.remove());
    if (!activeDocument || hooks.getDocument()?.id !== activeDocument.id) return;
    const byPage = new Map<number, NotebookEntry[]>();
    for (const entry of entries) if (entry.kind === 'highlight' && entry.excerpt) byPage.set(entry.page, [...(byPage.get(entry.page) || []), entry]);
    for (const [pageNumber, pageEntries] of byPage) {
      const page = document.querySelector<HTMLElement>(`#viewer .page[data-page-number="${pageNumber}"]`);
      const textLayer = page?.querySelector<HTMLElement>('.textLayer');
      if (!page || !textLayer) continue;
      let overlay: HTMLElement | null = null;
      const pageRect = page.getBoundingClientRect();
      if (!pageRect.width || !pageRect.height) continue;
      for (const entry of pageEntries) {
        const range = findExcerptRange(textLayer, entry.excerpt);
        if (!range) continue;
        if (!overlay) { overlay = document.createElement('div'); overlay.className = 'pipit-annotation-layer'; overlay.setAttribute('aria-hidden', 'true'); page.append(overlay); }
        for (const rect of Array.from(range.getClientRects())) {
          if (!rect.width || !rect.height) continue;
          const mark = document.createElement('span'); mark.className = 'pipit-annotation-highlight';
          mark.style.left = `${(rect.left - pageRect.left) * page.clientWidth / pageRect.width}px`;
          mark.style.top = `${(rect.top - pageRect.top) * page.clientHeight / pageRect.height}px`;
          mark.style.width = `${rect.width * page.clientWidth / pageRect.width}px`;
          mark.style.height = `${rect.height * page.clientHeight / pageRect.height}px`;
          overlay.append(mark);
        }
      }
    }
  }

  function scheduleHighlights() {
    if (highlightFrame) return;
    highlightFrame = requestAnimationFrame(refreshHighlights);
  }
  const pageObserver = new MutationObserver(records => {
    const annotationOnly = records.every(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest('.pipit-annotation-layer')) return true;
      return [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.classList.contains('pipit-annotation-layer'));
    });
    if (!annotationOnly) scheduleHighlights();
  });
  const pageRoot = document.querySelector('#viewer');
  if (pageRoot) pageObserver.observe(pageRoot, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleHighlights, { passive: true });

  function rememberSelection() {
    const current = hooks.getDocument();
    if (!current) { cachedSelection = null; return; }
    const selected = selectedExcerpt();
    if (selected) cachedSelection = { documentId: current.id, location: selected };
  }
  document.addEventListener('selectionchange', rememberSelection);
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && document.querySelector('#viewer-container')?.contains(event.target)) cachedSelection = null;
  }, true);

  function persist(announceFailure = false): boolean {
    if (!activeDocument) return false;
    const wasDirty = dirty;
    dirty = !saveStored(storageKey(activeDocument.id), entries);
    status.hidden = !dirty;
    status.textContent = dirty ? 'Changes could not be saved. Export a copy or try editing again before leaving.' : '';
    if (dirty && (!wasDirty || announceFailure)) hooks.toast('Notebook storage failed. Changes are not saved; export a copy before leaving.');
    return !dirty;
  }

  function render() {
    title.textContent = activeDocument?.name ?? '';
    count.textContent = `${entries.length} / ${entryLimit}`;
    addButton.disabled = entries.length >= entryLimit;
    exportButton.disabled = !entries.length;
    backupButton.disabled = !entries.length;
    undoButton.disabled = !undo.length;
    redoButton.disabled = !redo.length;
    list.innerHTML = entries.length ? entries.map(entry => {
      const updatedAt = entry.updatedAt ?? entry.createdAt ?? Date.now();
      return `<article class="notebook-card${entry.kind === 'highlight' ? ' notebook-highlight-card' : ''}" data-entry="${escapeHtml(entry.id)}">
      <div class="notebook-card-header"><button type="button" class="notebook-jump" data-jump="${escapeHtml(entry.id)}" aria-label="Jump to page ${entry.page}">Page ${entry.page} ${icon('arrow')}</button><time class="notebook-timestamp" datetime="${new Date(updatedAt).toISOString()}" data-timestamp="${escapeHtml(entry.id)}">${formatTimestamp(updatedAt)}</time><button type="button" class="notebook-delete" data-delete="${escapeHtml(entry.id)}" aria-label="Delete note from page ${entry.page}">Delete</button></div>
      ${entry.kind === 'highlight' ? '<span class="notebook-annotation-kind">Local highlight · sidecar</span>' : ''}
      ${entry.excerpt ? `<blockquote class="notebook-excerpt">${icon('quote')}<span class="notebook-excerpt-text">${escapeHtml(entry.excerpt)}</span></blockquote>` : ''}
      <label class="notebook-note-label">${entry.kind === 'highlight' ? 'Note on this highlight (optional)' : entry.excerpt ? 'Your note (optional)' : 'Your note'}<textarea class="notebook-note" data-note="${escapeHtml(entry.id)}" maxlength="${noteLimit}" rows="3" placeholder="What matters here?">${escapeHtml(entry.note)}</textarea></label>
    </article>`;
    }).join('') : `<div class="notebook-empty">${icon('note')}<h3 class="notebook-empty-title">Keep what matters.</h3><p class="notebook-empty-text">Select text in the PDF to capture an excerpt, or add a text note at your current reading position.</p></div>`;
  }

  function checkpoint() {
    undo.push(structuredClone(entries));
    if (undo.length > 40) undo.shift();
    redo = []; lastEdit = '';
  }
  function restoreEntries(forward: boolean) {
    if (!isCurrentDocument()) return;
    const source = forward ? redo : undo;
    const target = source.pop();
    if (!target) return;
    (forward ? undo : redo).push(structuredClone(entries));
    entries = target; lastEdit = ''; persist(); render(); refreshHighlights();
    hooks.recordActivity?.(forward ? 'Redo notebook change' : 'Undo notebook change');
    const button = forward ? redoButton : undoButton;
    (button.disabled ? addButton : button).focus({ preventScroll: true });
    hooks.toast(forward ? 'Notebook change restored.' : 'Notebook change undone.');
  }
  undoButton.addEventListener('click', () => restoreEntries(false));
  redoButton.addEventListener('click', () => restoreEntries(true));

  function reset() {
    cachedSelection = null;
    if (dirty) persist(true);
    panel.hidden = true;
    activeDocument = null;
    entries = [];
    undo = []; redo = []; lastEdit = '';
    document.querySelectorAll('.pipit-annotation-layer').forEach(layer => layer.remove());
    dirty = false;
    status.hidden = true;
    status.textContent = '';
    render();
  }

  function loadDocument(): boolean {
    const current = hooks.getDocument();
    if (!current) { reset(); hooks.toast('Open a document to use the notebook.'); return false; }
    if (activeDocument?.id === current.id) { activeDocument = { ...current }; return true; }
    reset();
    activeDocument = { ...current };
    try { void window.localStorage.length; }
    catch { hooks.toast('Notebook storage is unavailable. Export a copy of any notes you add.'); }
    const stored = readStored<unknown>(storageKey(current.id), []);
    const seen = new Set<string>();
    if (Array.isArray(stored)) {
      for (const candidate of stored.slice(0, entryLimit)) {
        if (!candidate || typeof candidate !== 'object') continue;
        const entry = candidate as Partial<NotebookEntry>;
        if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 128 || seen.has(entry.id) || typeof entry.excerpt !== 'string' || typeof entry.note !== 'string' || typeof entry.page !== 'number' || !Number.isInteger(entry.page) || entry.page < 1 || typeof entry.offset !== 'number' || !Number.isFinite(entry.offset) || (entry.kind !== undefined && entry.kind !== 'note' && entry.kind !== 'highlight')) continue;
        seen.add(entry.id);
        const createdAt = validTimestamp(entry.createdAt) ? entry.createdAt : Date.now();
        const updatedAt = validTimestamp(entry.updatedAt) ? entry.updatedAt : createdAt;
        entries.push({ id: entry.id, excerpt: entry.excerpt.slice(0, excerptLimit), note: entry.note.slice(0, noteLimit), page: entry.page, offset: Math.max(-1, Math.min(1, entry.offset)), kind: entry.kind || 'note', createdAt, updatedAt });
      }
    }
    if (!Array.isArray(stored) || entries.length !== stored.length) hooks.toast('Some notebook data could not be read. Only valid notes are shown.');
    refreshHighlights();
    return true;
  }

  function open() {
    if (!panel.hidden) { panel.hidden = true; document.querySelector<HTMLElement>('#viewer-container')?.focus({ preventScroll: true }); return; }
    if (!loadDocument()) return;
    hooks.closePreview?.();
    render();
    panel.hidden = false;
    panel.querySelector<HTMLButtonElement>('.notebook-close')?.focus({ preventScroll: true });
  }

  function addEntry(location: Pick<NotebookEntry, 'excerpt' | 'page' | 'offset'> & { kind?: NotebookEntry['kind'] }): string | null {
    if (entries.length >= entryLimit) { hooks.toast(`Notebook limit reached (${entryLimit} notes per document). Export or delete notes first.`); return null; }
    const now = Date.now();
    const entry: NotebookEntry = { id: crypto.randomUUID(), ...location, excerpt: location.excerpt.slice(0, excerptLimit), note: '', kind: location.kind || 'note', createdAt: now, updatedAt: now };
    checkpoint();
    entries.push(entry);
    persist();
    render();
    if (entry.kind === 'highlight') refreshHighlights();
    hooks.recordActivity?.(entry.kind === 'highlight' ? 'Add highlight' : 'Add notebook note');
    return entry.id;
  }

  function focusNote(id: string) {
    const textarea = Array.from(list.querySelectorAll<HTMLTextAreaElement>('.notebook-note')).find(element => element.dataset.note === id);
    textarea?.focus({ preventScroll: true });
    textarea?.closest('.notebook-card')?.scrollIntoView({ block: 'nearest' });
  }

  function capture() {
    const current = hooks.getDocument();
    const selected = selectedExcerpt() ?? (current && cachedSelection?.documentId === current.id ? cachedSelection.location : null);
    if (!selected) { hooks.toast('Select text in the PDF to capture an excerpt.'); return; }
    if (!loadDocument()) return;
    const id = addEntry(selected);
    if (!id) return;
    cachedSelection = null;
    panel.hidden = false;
    focusNote(id);
    if (selected.excerpt.length > excerptLimit) hooks.toast(`Excerpt shortened to ${excerptLimit} characters.`);
  }

  function highlight() {
    const current = hooks.getDocument();
    const selected = selectedExcerpt() ?? (current && cachedSelection?.documentId === current.id ? cachedSelection.location : null);
    if (!selected) { hooks.toast('In visual mode, move with j/k to select text, then press h to highlight it.'); return; }
    if (!loadDocument()) return;
    const id = addEntry({ ...selected, kind: 'highlight' });
    if (id) {
      cachedSelection = null;
      hooks.toast('Highlight saved on this device. Press n to add a note; export the notebook to carry it elsewhere.');
    }
  }

  function isCurrentDocument(): boolean {
    if (activeDocument && hooks.getDocument()?.id === activeDocument.id) return true;
    reset();
    hooks.toast('The document changed. Open its notebook again.');
    return false;
  }

  panel.querySelector('.notebook-close')!.addEventListener('click', () => { if (dirty) persist(true); panel.hidden = true; document.querySelector<HTMLElement>('#viewer-container')?.focus({ preventScroll: true }); });
  addButton.addEventListener('click', () => {
    if (!isCurrentDocument()) return;
    const current = hooks.getDocument()!;
    const id = addEntry({ excerpt: '', page: Math.max(1, Math.trunc(current.page) || 1), offset: Number.isFinite(current.offset) ? Math.max(-1, Math.min(1, current.offset)) : 0 });
    if (id) focusNote(id);
  });
  list.addEventListener('input', event => {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement) || !isCurrentDocument()) return;
    const entry = entries.find(candidate => candidate.id === textarea.dataset.note);
    if (!entry) return;
    const startsEditGroup = lastEdit !== entry.id || performance.now() - lastEditTime > 800;
    if (startsEditGroup) { checkpoint(); hooks.recordActivity?.('Edit notebook note'); }
    lastEdit = entry.id; lastEditTime = performance.now();
    entry.note = textarea.value.slice(0, noteLimit);
    entry.updatedAt = Date.now();
    const timestamp = list.querySelector<HTMLTimeElement>(`time[data-timestamp="${CSS.escape(entry.id)}"]`);
    if (timestamp) { timestamp.dateTime = new Date(entry.updatedAt).toISOString(); timestamp.textContent = formatTimestamp(entry.updatedAt); }
    persist();
    undoButton.disabled = !undo.length; redoButton.disabled = !redo.length;
  });
  list.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || !isCurrentDocument()) return;
    const id = button.dataset.jump ?? button.dataset.delete;
    const index = entries.findIndex(entry => entry.id === id);
    if (index < 0) return;
    if (button.dataset.jump !== undefined) {
      const entry = entries[index];
      panel.hidden = true;
      hooks.goTo(entry.page, entry.offset);
    } else if (button.dataset.delete !== undefined) {
      const deleted = entries[index];
      checkpoint();
      entries.splice(index, 1);
      hooks.recordActivity?.(deleted.kind === 'highlight' ? 'Delete highlight' : 'Delete notebook note');
      persist(); refreshHighlights();
      render();
      const nextButton = list.querySelectorAll<HTMLButtonElement>('.notebook-delete')[Math.min(index, entries.length - 1)];
      (nextButton ?? addButton).focus({ preventScroll: true });
    }
  });
  function downloadBackup(text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'pipit-notebook.json'; anchor.hidden = true;
    document.body.append(anchor);
    try { anchor.click(); } finally { anchor.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  backupButton.addEventListener('click', () => {
    if (isCurrentDocument() && activeDocument) downloadBackup(notebookSidecar({ id: activeDocument.id, name: activeDocument.name }, entries));
  });
  panel.querySelector('.notebook-import')!.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => { void (async () => {
    const file = importFile.files?.[0]; importFile.value = '';
    if (!file || !isCurrentDocument() || !activeDocument) return;
    const expected = activeDocument.id;
    try {
      if (file.size > notebookLimits.bytes) throw new Error('Notebook backup exceeds 8 MiB.');
      const text = await file.text();
      if (activeDocument?.id !== expected || hooks.getDocument()?.id !== expected) throw new Error('The document changed. Import the backup again.');
      const incoming = parseNotebookSidecar(text, expected, hooks.getDocument()?.pageCount);
      const merged = mergeNotebookEntries(entries, incoming);
      if (merged.length === entries.length) { hooks.toast('These notes are already in your notebook.'); return; }
      const added = merged.length - entries.length;
      checkpoint(); entries = merged; persist(); render(); hooks.recordActivity?.('Import notebook backup');
      hooks.toast(`Imported ${added} backup notes. Existing notes were preserved.`);
    } catch (error) { hooks.toast(error instanceof Error ? error.message : 'Could not import notebook backup.'); }
  })(); });
  exportButton.addEventListener('click', () => {
    if (!isCurrentDocument() || !activeDocument || !entries.length) return;
    const heading = markdownText(activeDocument.name.replace(/[\r\n]+/g, ' '));
    const markdown = [`# ${heading}`, '', 'Research notebook · Stored locally', '', ...entries.flatMap(entry => [
      `## Page ${entry.page} · Updated ${formatTimestamp(entry.updatedAt ?? entry.createdAt ?? Date.now())}`, '',
      ...(entry.excerpt ? markdownText(entry.excerpt).split(/\r?\n/).map(line => `> ${line}`) : []),
      ...(entry.excerpt ? ['', `— ${heading}, p. ${entry.page}`, ''] : [`${heading}, p. ${entry.page}`, '']),
      ...(entry.note ? [markdownText(entry.note), ''] : []),
    ])].join('\n');
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.className = 'notebook-download';
      anchor.href = url;
      const filename = activeDocument.name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/g, '').slice(0, 120) || 'document';
      anchor.download = `${filename}-notebook.md`;
      anchor.hidden = true;
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); }
    } catch { hooks.toast('Could not export the notebook. Please try again.'); }
    finally { if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); } }
  });

  function captureText(excerpt:string,page:number,offset:number) {
    const current = hooks.getDocument();
    if (!current || !excerpt.trim() || !Number.isInteger(page) || page < 1 || page > (current.pageCount || Infinity) || !loadDocument()) return;
    const id = addEntry({ excerpt:excerpt.trim(), page, offset:Math.max(-1,Math.min(1,offset)) });
    if (id) { panel.hidden = false; focusNote(id); }
  }
  return { open, capture, highlight, captureText, reset, rememberSelection, refreshHighlights };
}
