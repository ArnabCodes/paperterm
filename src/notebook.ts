import { icon } from './icons';
import { readStored, saveStored } from './preferences';
import { escapeHtml } from './types';

interface NotebookDocument { id: string; name: string; page: number; offset: number }
export interface NotebookHooks {
  getDocument(): NotebookDocument | null;
  goTo(page: number, offset?: number): void;
  toast(message: string): void;
}
export interface NotebookController { open(): void; capture(): void; reset(): void; rememberSelection(): void }
interface NotebookEntry { id: string; excerpt: string; page: number; offset: number; note: string }

const entryLimit = 200;
const excerptLimit = 8000;
const noteLimit = 8000;
const storageKey = (id: string) => `paperterm.notebook.v1:${id}`;
const markdownText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#!|~+\-]/g, '\\$&');

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
  const dialog = document.createElement('dialog');
  dialog.className = 'notebook-dialog';
  dialog.setAttribute('aria-label', 'Research notebook');
  dialog.innerHTML = `<section class="notebook-shell">
    <header class="notebook-header"><div class="notebook-heading"><span class="notebook-eyebrow">${icon('note')} Research notebook</span><h2 class="notebook-title"></h2><p class="notebook-subtitle">Excerpts and thoughts, saved only on this device.</p></div><button type="button" class="notebook-close" aria-label="Close notebook">${icon('close')}</button></header>
    <div class="notebook-toolbar"><button type="button" class="notebook-add">${icon('note')} Add text note</button><button type="button" class="notebook-export">${icon('export')} Export Markdown</button><span class="notebook-count"></span></div>
    <p class="notebook-status" role="status" hidden></p><div class="notebook-list"></div>
    <footer class="notebook-footer">Local to this browser · Notes save as you type · Esc to close</footer>
  </section>`;
  document.body.append(dialog);
  const title = dialog.querySelector<HTMLElement>('.notebook-title')!;
  const list = dialog.querySelector<HTMLElement>('.notebook-list')!;
  const count = dialog.querySelector<HTMLElement>('.notebook-count')!;
  const status = dialog.querySelector<HTMLElement>('.notebook-status')!;
  const addButton = dialog.querySelector<HTMLButtonElement>('.notebook-add')!;
  const exportButton = dialog.querySelector<HTMLButtonElement>('.notebook-export')!;
  addButton.title = 'Add text note (Ctrl/Cmd+Enter)';
  exportButton.title = 'Export Markdown (Ctrl/Cmd+S)';
  dialog.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); exportButton.click(); }
    else if (event.key === 'Enter') { event.preventDefault(); addButton.click(); }
  });
  let activeDocument: NotebookDocument | null = null;
  let entries: NotebookEntry[] = [];
  let dirty = false;
  let cachedSelection: { documentId: string; location: Pick<NotebookEntry, 'excerpt' | 'page' | 'offset'> } | null = null;

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
    list.innerHTML = entries.length ? entries.map(entry => `<article class="notebook-card" data-entry="${escapeHtml(entry.id)}">
      <div class="notebook-card-header"><button type="button" class="notebook-jump" data-jump="${escapeHtml(entry.id)}" aria-label="Jump to page ${entry.page}">Page ${entry.page} ${icon('arrow')}</button><button type="button" class="notebook-delete" data-delete="${escapeHtml(entry.id)}" aria-label="Delete note from page ${entry.page}">Delete</button></div>
      ${entry.excerpt ? `<blockquote class="notebook-excerpt">${icon('quote')}<span class="notebook-excerpt-text">${escapeHtml(entry.excerpt)}</span></blockquote>` : ''}
      <label class="notebook-note-label">${entry.excerpt ? 'Your note (optional)' : 'Your note'}<textarea class="notebook-note" data-note="${escapeHtml(entry.id)}" maxlength="${noteLimit}" rows="3" placeholder="What matters here?">${escapeHtml(entry.note)}</textarea></label>
    </article>`).join('') : `<div class="notebook-empty">${icon('note')}<h3 class="notebook-empty-title">Keep what matters.</h3><p class="notebook-empty-text">Select text in the PDF to capture an excerpt, or add a text note at your current reading position.</p></div>`;
  }

  function reset() {
    cachedSelection = null;
    if (dirty) persist(true);
    if (dialog.open) dialog.close();
    activeDocument = null;
    entries = [];
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
        if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 128 || seen.has(entry.id) || typeof entry.excerpt !== 'string' || typeof entry.note !== 'string' || typeof entry.page !== 'number' || !Number.isInteger(entry.page) || entry.page < 1 || typeof entry.offset !== 'number' || !Number.isFinite(entry.offset)) continue;
        seen.add(entry.id);
        entries.push({ id: entry.id, excerpt: entry.excerpt.slice(0, excerptLimit), note: entry.note.slice(0, noteLimit), page: entry.page, offset: Math.max(-1, Math.min(1, entry.offset)) });
      }
    }
    if (!Array.isArray(stored) || entries.length !== stored.length) hooks.toast('Some notebook data could not be read. Only valid notes are shown.');
    return true;
  }

  function open() {
    if (!loadDocument()) return;
    render();
    if (!dialog.open) dialog.showModal();
  }

  function addEntry(location: Pick<NotebookEntry, 'excerpt' | 'page' | 'offset'>): string | null {
    if (entries.length >= entryLimit) { hooks.toast(`Notebook limit reached (${entryLimit} notes per document). Export or delete notes first.`); return null; }
    const entry: NotebookEntry = { id: crypto.randomUUID(), ...location, excerpt: location.excerpt.slice(0, excerptLimit), note: '' };
    entries.push(entry);
    persist();
    render();
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
    if (!dialog.open) dialog.showModal();
    focusNote(id);
    if (selected.excerpt.length > excerptLimit) hooks.toast(`Excerpt shortened to ${excerptLimit} characters.`);
  }

  function isCurrentDocument(): boolean {
    if (activeDocument && hooks.getDocument()?.id === activeDocument.id) return true;
    reset();
    hooks.toast('The document changed. Open its notebook again.');
    return false;
  }

  dialog.querySelector('.notebook-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (dirty) persist(true);
    document.querySelector<HTMLElement>('#viewer-container')?.focus({ preventScroll: true });
  });
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
    entry.note = textarea.value.slice(0, noteLimit);
    persist();
  });
  list.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || !isCurrentDocument()) return;
    const id = button.dataset.jump ?? button.dataset.delete;
    const index = entries.findIndex(entry => entry.id === id);
    if (index < 0) return;
    if (button.dataset.jump !== undefined) {
      const entry = entries[index];
      dialog.close();
      hooks.goTo(entry.page, entry.offset);
    } else if (button.dataset.delete !== undefined) {
      entries.splice(index, 1);
      persist();
      render();
      const nextButton = list.querySelectorAll<HTMLButtonElement>('.notebook-delete')[Math.min(index, entries.length - 1)];
      (nextButton ?? addButton).focus({ preventScroll: true });
    }
  });
  exportButton.addEventListener('click', () => {
    if (!isCurrentDocument() || !activeDocument || !entries.length) return;
    const heading = markdownText(activeDocument.name.replace(/[\r\n]+/g, ' '));
    const markdown = [`# ${heading}`, '', 'Research notebook · Stored locally', '', ...entries.flatMap(entry => [
      `## Page ${entry.page}`, '',
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

  return { open, capture, reset, rememberSelection };
}
