import { PDFDocument, degrees } from 'pdf-lib';
import { icon } from './icons';
import { readStored, saveStored } from './preferences';
import { escapeHtml } from './types';
import './page-editor.css';

interface EditorDocument { id: string; name: string; pageCount: number; page: number }
interface PageEditorHooks {
  getDocument(): EditorDocument | null;
  getBytes(): Promise<Uint8Array>;
  renderThumbnail(page: number, canvas: HTMLCanvasElement): Promise<void>;
  replace(bytes: Uint8Array, page: number): Promise<string | null>;
  goTo(page: number): void;
  toast(message: string): void;
}
export interface PageEditorController {
  open(): void;
  importFiles(files: readonly File[], at?: number): void;
  applyEdit(label: string, page: number, operation: (pdf: PDFDocument) => Promise<void> | void): void;
  recordExternalEdit(before: Uint8Array, label: string): void;
  undo(): void;
  redo(): void;
  openHistory(): void;
  recordActivity(action: string): void;
  canUndo(): boolean;
  canRedo(): boolean;
  stats(): { edits: number; undos: number };
  documentOpening(): void;
}

const pageCountLimit = 10_000;
const undoCountLimit = 6;
const undoBytesLimit = 96 * 1024 * 1024;
const imagePixelLimit = 36_000_000;
const acceptedImage = (file: File) => file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif|tiff?)$/i.test(file.name);
const acceptedPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

async function imageBytes(file: File): Promise<{ bytes: Uint8Array; format: 'jpg' | 'png' }> {
  if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} is larger than the 100 MiB image limit.`);
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > imagePixelLimit) throw new Error(`${file.name} exceeds the 36 megapixel image limit.`);
    if (isJpeg) return { bytes: new Uint8Array(await file.arrayBuffer()), format: 'jpg' };
    if (isPng) return { bytes: new Uint8Array(await file.arrayBuffer()), format: 'png' };
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`Could not decode ${file.name}.`);
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(`Could not convert ${file.name} to PNG.`)), 'image/png'));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), format: 'png' };
  } catch (error) {
    if (error instanceof Error && /megapixel|convert|decode/.test(error.message)) throw error;
    throw new Error(`Could not read ${file.name} as an image.`);
  } finally { bitmap?.close(); }
}

async function drawImagePage(document: PDFDocument, file: File, index: number): Promise<void> {
  const { bytes, format } = await imageBytes(file);
  const image = format === 'jpg' ? await document.embedJpg(bytes) : await document.embedPng(bytes);
  const fit = Math.min(.75, 792 / image.width, 1008 / image.height);
  const width = Math.max(1, image.width * fit), height = Math.max(1, image.height * fit);
  const page = document.insertPage(index, [width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
}

export async function imagesToPdf(files: readonly File[]): Promise<Uint8Array> {
  const valid = files.filter(acceptedImage);
  if (!valid.length) throw new Error('Choose at least one supported image.');
  if (valid.length > 100) throw new Error('Add up to 100 images at a time.');
  if (valid.reduce((sum, file) => sum + file.size, 0) > 512 * 1024 * 1024) throw new Error('The combined image import is larger than the 512 MiB limit. Split it into smaller batches.');
  const output = await PDFDocument.create();
  for (let index = 0; index < valid.length; index++) await drawImagePage(output, valid[index], index);
  return output.save({ updateFieldAppearances: false });
}

export function initializePageEditor(hooks: PageEditorHooks): PageEditorController {
  const dialog = document.createElement('dialog');
  dialog.className = 'page-editor-dialog';
  dialog.setAttribute('aria-labelledby', 'page-editor-title');
  dialog.innerHTML = `
    <header class="page-editor-header">
      <div><span class="eyebrow">EDIT A COPY</span><h2 id="page-editor-title">Pages</h2><p class="page-editor-subtitle">Reorder, combine, or add image pages. Your source file stays untouched.</p></div>
      <button class="page-editor-close" type="button" aria-label="Close page organizer">${icon('close')}</button>
    </header>
    <div class="page-editor-tools" role="toolbar" aria-label="Page actions">
      <button type="button" data-page-action="pdf" title="Insert pages from PDF files">${icon('document')}<span>Insert PDF</span></button>
      <button type="button" data-page-action="images" title="Add images as pages">${icon('image')}<span>Add images</span></button>
      <span class="page-editor-divider" aria-hidden="true"></span>
      <button type="button" data-page-action="copy" title="Copy selected pages inside Pipit · Ctrl/Cmd+C">${icon('copy')}<span>Copy</span></button>
      <button type="button" data-page-action="paste" title="Paste copied pages after selection · Ctrl/Cmd+V">${icon('export')}<span>Paste</span></button>
      <span class="page-editor-divider" aria-hidden="true"></span>
      <button type="button" data-page-action="up" title="Move selected pages earlier · Ctrl/Cmd+↑">${icon('back')}<span>Move up</span></button>
      <button type="button" data-page-action="down" title="Move selected pages later · Ctrl/Cmd+↓">${icon('next')}<span>Move down</span></button>
      <button type="button" data-page-action="rotate" title="Rotate selected pages clockwise · R">${icon('rotate')}<span>Rotate</span></button>
      <button type="button" data-page-action="delete" title="Delete selected pages · Delete">${icon('trash')}<span>Delete</span></button>
      <button type="button" data-page-action="undo" title="Undo page edit · Ctrl/Cmd+Z">${icon('back')}<span>Undo</span></button>
      <button type="button" data-page-action="redo" title="Redo page edit · Ctrl/Cmd+Shift+Z">${icon('next')}<span>Redo</span></button>
    </div>
    <div class="page-editor-meta"><span class="page-editor-count" role="status"></span><span class="page-editor-status">Local edits · original PDF unchanged</span><details class="page-edit-history"><summary>${icon('history')} Edit history <span data-history-count>0</span></summary><p>Timestamped activity is saved on this device. Undo snapshots are available while this document is open.</p><ol data-history-list></ol></details></div>
    <div class="page-editor-grid" role="grid" aria-label="PDF page thumbnails" tabindex="0"></div>
    <footer class="page-editor-footer"><span>Click or arrows to select · Shift-click / Shift+arrows for a range · drag to reorder · Enter reads</span><span><kbd>Ctrl/Cmd C</kbd> copy · <kbd>Ctrl/Cmd V</kbd> paste · <kbd>Del</kbd> remove · <kbd>Esc</kbd> close</span></footer>
    <input class="page-editor-pdf-input" type="file" accept="application/pdf,.pdf" multiple hidden>
    <input class="page-editor-image-input" type="file" accept="image/*" multiple hidden>`;
  document.body.append(dialog);

  const grid = dialog.querySelector<HTMLElement>('.page-editor-grid')!;
  const countLabel = dialog.querySelector<HTMLElement>('.page-editor-count')!;
  const pdfInput = dialog.querySelector<HTMLInputElement>('.page-editor-pdf-input')!;
  const imageInput = dialog.querySelector<HTMLInputElement>('.page-editor-image-input')!;
  const historyList = dialog.querySelector<HTMLOListElement>('[data-history-list]')!;
  const historyCount = dialog.querySelector<HTMLElement>('[data-history-count]')!;
  const historyDisclosure = dialog.querySelector<HTMLDetailsElement>('.page-edit-history')!;
  const toolButtons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-page-action]')];
  let selected = new Set<number>();
  let lastSelected = 0;
  let documentId = '';
  let applying = false;
  let busy = false;
  let clipboard: Uint8Array | null = null;
  let clipboardPageCount = 0;
  let undo: Uint8Array[] = [];
  let redo: Uint8Array[] = [];
  let renderedCount = 0;
  let thumbnailObserver: IntersectionObserver | null = null;
  let moreObserver: IntersectionObserver | null = null;
  let dragPages: number[] = [];
  let selectAnchor = 1;
  type Activity = { action: string; at: number; kind: 'edit' | 'undo' | 'redo' | 'annotation' };
  let activity: Activity[] = [];
  let activityDocumentId = '';
  let sessionEdits = 0;
  let sessionUndos = 0;
  const activityKey = (id: string) => `pipit.edit-history.v1:${id}`;

  const current = () => hooks.getDocument();
  function renderActivity() {
    historyCount.textContent = String(activity.length);
    historyList.innerHTML = activity.length ? activity.map(item => `<li data-kind="${item.kind}"><span>${escapeHtml(item.action)}</span><time datetime="${new Date(item.at).toISOString()}">${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(item.at)}</time></li>`).join('') : '<li class="page-edit-history-empty">No edits yet.</li>';
  }
  function logActivity(action: string, kind: Activity['kind']) {
    const doc = current();
    if (!doc) return;
    if (!activityDocumentId) activityDocumentId = doc.id;
    activity.unshift({ action: action.slice(0, 160), at: Date.now(), kind });
    activity = activity.slice(0, 100);
    saveStored(activityKey(activityDocumentId), activity);
    if (doc.id !== activityDocumentId) saveStored(activityKey(doc.id), activity);
    renderActivity();
  }
  function resetHistory() {
    undo = []; redo = []; documentId = current()?.id || '';
    if (activityDocumentId !== documentId) {
      activityDocumentId = documentId;
      const stored = readStored<unknown>(activityKey(documentId), []);
      activity = Array.isArray(stored) ? stored.slice(0, 100).filter((entry): entry is Activity => !!entry && typeof entry === 'object' && typeof (entry as Activity).action === 'string' && typeof (entry as Activity).at === 'number' && ['edit', 'undo', 'redo', 'annotation'].includes((entry as Activity).kind)).map(entry => ({ ...entry, action: entry.action.slice(0, 160) })) : [];
      sessionEdits = 0; sessionUndos = 0; renderActivity();
    }
  }
  function updateTools() {
    const count = current()?.pageCount || 0;
    const validSelection = selected.size > 0;
    for (const button of toolButtons) {
      const action = button.dataset.pageAction;
      button.disabled = busy || ((['copy', 'up', 'down', 'rotate', 'delete'].includes(action || '')) && !validSelection)
        || (action === 'paste' && !clipboard) || (action === 'undo' && !undo.length) || (action === 'redo' && !redo.length)
        || (action === 'delete' && selected.size >= count);
    }
    dialog.dataset.busy = String(busy);
  }

  function markSelection() {
    grid.querySelectorAll<HTMLButtonElement>('.page-card').forEach(card => {
      const page = Number(card.dataset.editorPage);
      const chosen = selected.has(page);
      card.classList.toggle('is-selected', chosen);
      card.setAttribute('aria-pressed', String(chosen));
    });
    const doc = current();
    if (doc) countLabel.textContent = `${selected.size ? `${selected.size} selected · ` : ''}${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}`;
    updateTools();
  }

  function appendCards(start: number, end: number) {
    const doc = current();
    if (!doc) return;
    thumbnailObserver?.disconnect();
    moreObserver?.disconnect();
    grid.querySelector('.page-editor-more')?.remove();
    const fragment = document.createDocumentFragment();
    const newCanvases: HTMLCanvasElement[] = [];
    for (let page = start; page <= end; page++) {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'page-card'; card.dataset.editorPage = String(page); card.draggable = true;
      card.setAttribute('role', 'gridcell'); card.setAttribute('aria-pressed', String(selected.has(page)));
      card.setAttribute('aria-label', `Page ${page}${selected.has(page) ? ', selected' : ''}`);
      if (selected.has(page)) card.classList.add('is-selected');
      card.innerHTML = `<span class="page-thumb"><canvas aria-hidden="true"></canvas><span class="page-thumb-loading">${icon('document')}</span></span><span class="page-card-caption"><span>Page</span><strong>${page}</strong></span>`;
      newCanvases.push(card.querySelector('canvas')!);
      fragment.append(card);
    }
    if (end < doc.pageCount) {
      const more = document.createElement('div');
      more.className = 'page-editor-more'; more.textContent = `Scroll for more · ${end} of ${doc.pageCount}`;
      fragment.append(more);
    }
    grid.append(fragment);
    thumbnailObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const canvas = entry.target as HTMLCanvasElement;
        const page = Number(canvas.closest<HTMLElement>('.page-card')?.dataset.editorPage);
        thumbnailObserver?.unobserve(canvas);
        if (page) void hooks.renderThumbnail(page, canvas).then(() => canvas.closest('.page-thumb')?.classList.add('is-rendered')).catch(() => canvas.closest('.page-thumb')?.classList.add('is-unavailable'));
      }
    }, { root: grid, rootMargin: '160px' });
    newCanvases.forEach(canvas => thumbnailObserver!.observe(canvas));
    const sentinel = grid.querySelector<HTMLElement>('.page-editor-more');
    if (sentinel) {
      moreObserver = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        const previous = renderedCount;
        renderedCount = Math.min(doc.pageCount, renderedCount + 72);
        appendCards(previous + 1, renderedCount);
      }, { root: grid, rootMargin: '240px' });
      moreObserver.observe(sentinel);
    }
  }

  function render() {
    const doc = current();
    if (!doc) return;
    if (documentId !== doc.id && !applying) resetHistory();
    if (!documentId) documentId = doc.id;
    selected = new Set([...selected].filter(page => page >= 1 && page <= doc.pageCount));
    if (!selected.size) selected.add(Math.max(1, Math.min(doc.pageCount, doc.page)));
    lastSelected = [...selected][0] || 1;
    countLabel.textContent = `${selected.size} selected · ${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}`;
    grid.replaceChildren();
    // Ensure the reader's current page exists in the DOM so keyboard focus can
    // land there, while keeping the usual first batch small for long PDFs.
    renderedCount = Math.min(doc.pageCount, Math.max(72, doc.page));
    appendCards(1, renderedCount);
    updateTools();
  }

  function selectPage(page: number, event?: MouseEvent) {
    const doc = current();
    if (!doc || page < 1 || page > doc.pageCount) return;
    if (event?.shiftKey) {
      const low = Math.min(selectAnchor, page), high = Math.max(selectAnchor, page);
      selected = new Set(Array.from({ length: high - low + 1 }, (_, index) => low + index));
    } else if (event?.ctrlKey || event?.metaKey) {
      if (selected.has(page)) selected.delete(page); else selected.add(page);
      if (!selected.size) selected.add(page);
      selectAnchor = page;
    } else { selected = new Set([page]); selectAnchor = page; }
    lastSelected = page;
    markSelection();
  }

  function pushUndo(bytes: Uint8Array) {
    undo.push(bytes);
    redo = [];
    let total = undo.reduce((sum, item) => sum + item.byteLength, 0);
    while (undo.length > undoCountLimit || total > undoBytesLimit) total -= undo.shift()!.byteLength;
  }

  async function install(bytes: Uint8Array, page: number, action: string, sourceId: string, selection?: Set<number>, historyAction = false): Promise<boolean> {
    if (current()?.id !== sourceId) throw new Error('The open document changed. Nothing was edited; reopen Pages and try again.');
    const previous = await hooks.getBytes();
    if (current()?.id !== sourceId) throw new Error('The open document changed. Nothing was edited; reopen Pages and try again.');
    const wasOpen = dialog.open;
    busy = true; updateTools();
    dialog.close();
    applying = true;
    try {
      const nextId = await hooks.replace(bytes, page);
      if (!nextId) {
        hooks.toast('The edited copy could not be opened. Your source PDF is still unchanged.');
        return false;
      }
      if (historyAction) { redo.push(previous); logActivity(action, 'redo'); }
      else { pushUndo(previous); sessionEdits++; logActivity(action.replace(/\s*· edited copy ready$/, ''), 'edit'); }
      documentId = nextId;
      if (selection) selected = selection;
      else selected = new Set([Math.max(1, page)]);
      lastSelected = [...selected][0] || Math.max(1, page);
      hooks.toast(action);
      return true;
    } finally {
      applying = false; busy = false;
      if (wasOpen) { dialog.showModal(); render(); grid.querySelector<HTMLButtonElement>(`.page-card[data-editor-page="${lastSelected}"]`)?.focus({ preventScroll: true }); }
      updateTools();
    }
  }

  async function edit(label: string, page: number, operation: (pdf: PDFDocument) => Promise<void> | void, selection?: Set<number>) {
    const doc = current();
    if (!doc || busy) return;
    const originId = doc.id;
    busy = true; updateTools(); countLabel.textContent = `${label}…`;
    try {
      const bytes = await hooks.getBytes();
      const pdf = await PDFDocument.load(bytes);
      if (pdf.isEncrypted) throw new Error('This PDF is encrypted. Unlock it in a PDF app before editing a copy.');
      await operation(pdf);
      if (current()?.id !== originId) throw new Error('The open document changed. Nothing was edited; reopen Pages and try again.');
      if (!pdf.getPageCount()) throw new Error('A PDF must keep at least one page.');
      if (pdf.getPageCount() > pageCountLimit) throw new Error(`Page edits are limited to ${pageCountLimit.toLocaleString()} pages.`);
      const output = await pdf.save({ updateFieldAppearances: false });
      if (current()?.id !== originId) throw new Error('The open document changed. Nothing was edited; reopen Pages and try again.');
      await install(output, page, `${label} · edited copy ready`, originId, selection);
    } catch (error) {
      hooks.toast(error instanceof Error ? error.message : `Could not ${label.toLowerCase()}.`);
    } finally { busy = false; updateTools(); }
  }

  async function reorder(desiredOrder: number[], selectedOld: Set<number>) {
    const doc = current();
    if (!doc || desiredOrder.every((page, index) => page === index + 1)) return;
    const selection = new Set(desiredOrder.flatMap((oldPage, index) => selectedOld.has(oldPage) ? [index + 1] : []));
    const oldFocus = lastSelected;
    const focus = Math.max(1, desiredOrder.indexOf(oldFocus) + 1);
    await edit('Reordering pages', focus, pdf => {
      const pages = pdf.getPages();
      if (desiredOrder.length !== pages.length || desiredOrder.some(page => !Number.isInteger(page) || page < 1 || page > pages.length)) throw new Error('Page order became stale. Reopen the organizer and try again.');
      const ordered = desiredOrder.map(page => pages[page - 1]);
      for (let index = pdf.getPageCount() - 1; index >= 0; index--) pdf.removePage(index);
      ordered.forEach(page => pdf.addPage(page));
    }, selection);
  }

  async function moveSelection(direction: -1 | 1) {
    const doc = current();
    if (!doc || selected.size === 0) return;
    const order = Array.from({ length: doc.pageCount }, (_, index) => index + 1);
    const picked = new Set(selected);
    if (direction < 0) {
      for (let index = 1; index < order.length; index++) if (picked.has(order[index]) && !picked.has(order[index - 1])) [order[index - 1], order[index]] = [order[index], order[index - 1]];
    } else {
      for (let index = order.length - 2; index >= 0; index--) if (picked.has(order[index]) && !picked.has(order[index + 1])) [order[index], order[index + 1]] = [order[index + 1], order[index]];
    }
    await reorder(order, picked);
  }

  async function copyPages() {
    const doc = current();
    if (!doc || !selected.size || busy) return;
    try {
      const bytes = await hooks.getBytes();
      if (current()?.id !== doc.id) throw new Error('The open document changed. Select pages again in the current PDF.');
      const source = await PDFDocument.load(bytes);
      const clip = await PDFDocument.create();
      const copied = await clip.copyPages(source, [...selected].sort((a, b) => a - b).map(page => page - 1));
      copied.forEach(page => clip.addPage(page));
      clipboard = await clip.save(); clipboardPageCount = copied.length; updateTools();
      hooks.toast(`${copied.length} page${copied.length === 1 ? '' : 's'} copied to Pipit’s page clipboard.`);
    } catch (error) { hooks.toast(error instanceof Error ? error.message : 'Could not copy these pages.'); }
  }

  async function pastePages(at?: number) {
    if (!clipboard || busy) { if (!clipboard) hooks.toast('Copy pages in Pipit first with Ctrl+C.'); return; }
    const doc = current();
    if (!doc) return;
    const insertAt = at ?? (selected.size ? Math.max(...selected) : doc.page);
    const nextSelection = new Set(Array.from({ length: clipboardPageCount }, (_, index) => insertAt + index + 1));
    await edit('Pasting pages', insertAt + 1, async pdf => {
      const source = await PDFDocument.load(clipboard!);
      const copied = await pdf.copyPages(source, source.getPageIndices());
      copied.forEach((page, index) => pdf.insertPage(insertAt + index, page));
    }, nextSelection);
  }

  async function importFiles(files: readonly File[], at?: number) {
    const valid = files.filter(file => acceptedPdf(file) || acceptedImage(file));
    const invalid = files.filter(file => !acceptedPdf(file) && !acceptedImage(file));
    if (invalid.length) hooks.toast(`Skipped unsupported file${invalid.length === 1 ? '' : 's'}: ${invalid.slice(0, 3).map(file => file.name).join(', ')}`);
    if (!valid.length) return;
    if (valid.length > 100) { hooks.toast('Add up to 100 files at a time.'); return; }
    const totalBytes = valid.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > 512 * 1024 * 1024) { hooks.toast('The combined import is larger than the 512 MiB limit. Split it into smaller batches.'); return; }
    const doc = current();
    if (!doc) return;
    let insertAt = at ?? (selected.size ? Math.max(...selected) : doc.page);
    const startPage = insertAt + 1;
    const selectedAfter = new Set<number>();
    await edit('Adding pages', startPage, async pdf => {
      for (const file of valid) {
        if (acceptedPdf(file)) {
          if (file.size > 250 * 1024 * 1024) throw new Error(`${file.name} is larger than the 250 MiB PDF limit.`);
          const source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
          if (source.isEncrypted) throw new Error(`${file.name} is encrypted and cannot be inserted.`);
          if (pdf.getPageCount() + source.getPageCount() > pageCountLimit) throw new Error(`Page edits are limited to ${pageCountLimit.toLocaleString()} pages.`);
          const copied = await pdf.copyPages(source, source.getPageIndices());
          for (const page of copied) { selectedAfter.add(insertAt + 1); pdf.insertPage(insertAt++, page); }
        } else {
          selectedAfter.add(insertAt + 1);
          if (pdf.getPageCount() >= pageCountLimit) throw new Error(`Page edits are limited to ${pageCountLimit.toLocaleString()} pages.`);
          await drawImagePage(pdf, file, insertAt++);
        }
      }
    }, selectedAfter);
  }

  async function history(backward: boolean) {
    if (busy) return;
    const originId = current()?.id;
    if (!originId) return;
    const source = backward ? undo : redo;
    const snapshot = source.pop();
    if (!snapshot) return;
    busy = true; updateTools();
    const wasOpen = dialog.open;
    let restoreDialog = wasOpen;
    let movedSnapshot = false;
    try {
      const currentBytes = await hooks.getBytes();
      if (current()?.id !== originId) throw new Error('The open document changed. Reopen Pages before undoing or redoing edits.');
      const doc = current();
      const page = Math.max(1, Math.min(doc?.pageCount || 1, lastSelected));
      dialog.close(); applying = true;
      const nextId = await hooks.replace(snapshot, page);
      if (!nextId) throw new Error('Could not restore that page edit.');
      (backward ? redo : undo).push(currentBytes);
      if (backward) { sessionUndos++; logActivity('Undo edit', 'undo'); }
      else logActivity('Redo edit', 'redo');
      documentId = nextId;
      restoreDialog = wasOpen && current()?.id === nextId;
      movedSnapshot = true;
      hooks.toast(backward ? 'Page edit undone.' : 'Page edit restored.');
    } catch (error) {
      hooks.toast(error instanceof Error ? error.message : 'Could not restore that page edit.');
    } finally {
      if (!movedSnapshot) source.push(snapshot);
      applying = false; busy = false;
      if (restoreDialog && current()) { dialog.showModal(); render(); grid.querySelector<HTMLButtonElement>(`.page-card[data-editor-page="${lastSelected}"]`)?.focus({ preventScroll: true }); }
      updateTools();
    }
  }

  function handleTool(action: string) {
    const doc = current();
    if (!doc || busy) return;
    switch (action) {
      case 'pdf': pdfInput.click(); break;
      case 'images': imageInput.click(); break;
      case 'copy': void copyPages(); break;
      case 'paste': void pastePages(); break;
      case 'up': void moveSelection(-1); break;
      case 'down': void moveSelection(1); break;
      case 'rotate': {
        const pages = [...selected];
        const page = Math.min(...pages);
        void edit('Rotating pages', page, pdf => pages.forEach(number => {
          const target = pdf.getPage(number - 1);
          target.setRotation(degrees((target.getRotation().angle + 90) % 360));
        }), new Set(pages));
        break;
      }
      case 'delete': {
        if (selected.size >= doc.pageCount) { hooks.toast('Keep at least one page in a PDF.'); break; }
        const removed = [...selected].sort((a, b) => a - b);
        const focus = Math.max(1, Math.min(doc.pageCount - removed.length, removed[0]));
        void edit('Deleting pages', focus, pdf => removed.slice().reverse().forEach(page => pdf.removePage(page - 1)), new Set([focus]));
        break;
      }
      case 'undo': void history(true); break;
      case 'redo': void history(false); break;
    }
  }

  dialog.querySelector('.page-editor-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { thumbnailObserver?.disconnect(); moreObserver?.disconnect(); hooks.goTo(current()?.page || 1); });
  dialog.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-page-action]') : null;
    if (button && !button.disabled) { handleTool(button.dataset.pageAction || ''); return; }
    const card = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.page-card') : null;
    if (card) selectPage(Number(card.dataset.editorPage), event as MouseEvent);
  });
  dialog.addEventListener('dblclick', event => {
    const card = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.page-card') : null;
    if (!card) return;
    const page = Number(card.dataset.editorPage); dialog.close(); hooks.goTo(page);
  });
  pdfInput.addEventListener('change', () => { const files = [...(pdfInput.files || [])]; pdfInput.value = ''; if (files.length) void importFiles(files); });
  imageInput.addEventListener('change', () => { const files = [...(imageInput.files || [])]; imageInput.value = ''; if (files.length) void importFiles(files); });

  grid.addEventListener('dragstart', event => {
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.page-card') : null;
    if (card) {
      const page = Number(card.dataset.editorPage);
      dragPages = selected.has(page) ? [...selected].sort((a, b) => a - b) : [page];
      if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(page)); }
      card.classList.add('is-dragging');
    }
  });
  grid.addEventListener('dragend', () => { dragPages = []; grid.querySelectorAll('.is-dragging,.drop-before,.drop-after').forEach(node => node.classList.remove('is-dragging', 'drop-before', 'drop-after')); grid.classList.remove('accepting-files'); });
  grid.addEventListener('dragover', event => {
    if (!event.dataTransfer) return;
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.page-card') : null;
    if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; grid.classList.add('accepting-files'); return; }
    if (dragPages.length && card) {
      event.preventDefault(); event.dataTransfer.dropEffect = 'move';
      grid.querySelectorAll('.drop-before,.drop-after').forEach(node => node.classList.remove('drop-before','drop-after'));
      const rect = card.getBoundingClientRect(); card.classList.add(event.clientX < rect.left + rect.width / 2 ? 'drop-before' : 'drop-after');
    }
  });
  grid.addEventListener('drop', event => {
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) {
      event.preventDefault(); event.stopPropagation(); grid.classList.remove('accepting-files');
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.page-card') : null;
      const insertion = card ? Number(card.dataset.editorPage) - 1 + (event.clientX > card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2 ? 1 : 0) : current()?.page || 0;
      void importFiles(files, insertion); return;
    }
    if (!dragPages.length) return;
    event.preventDefault();
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.page-card') : null;
    if (!target) return;
    const targetPage = Number(target.dataset.editorPage);
    const rect = target.getBoundingClientRect();
    const insertion = targetPage - 1 + (event.clientX > rect.left + rect.width / 2 ? 1 : 0);
    const doc = current(); if (!doc) return;
    const chosen = new Set(dragPages);
    const all = Array.from({ length: doc.pageCount }, (_, index) => index + 1);
    const moving = all.filter(page => chosen.has(page));
    const remaining = all.filter(page => !chosen.has(page));
    const adjusted = Math.max(0, insertion - all.filter((page, index) => index < insertion && chosen.has(page)).length);
    const order = [...remaining.slice(0, adjusted), ...moving, ...remaining.slice(adjusted)];
    void reorder(order, chosen);
  });

  dialog.addEventListener('keydown', event => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const typing = !!target?.matches('input,textarea,select,[contenteditable="true"]');
    if (event.key === 'Escape') return;
    if (typing) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'c') { event.preventDefault(); event.stopPropagation(); void copyPages(); return; }
    if (modifier && event.key.toLowerCase() === 'v') { event.preventDefault(); event.stopPropagation(); void pastePages(); return; }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); void history(!event.shiftKey); return; }
    if (modifier && event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); void moveSelection(-1); return; }
    if (modifier && event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); void moveSelection(1); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); handleTool('delete'); return; }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); event.stopPropagation(); handleTool('rotate'); return; }
    if (event.key.toLowerCase() === 'a') { event.preventDefault(); event.stopPropagation(); handleTool('pdf'); return; }
    if (event.key.toLowerCase() === 'i') { event.preventDefault(); event.stopPropagation(); handleTool('images'); return; }
    if (event.key === 'Enter' && target?.closest('.page-card')) {
      event.preventDefault(); event.stopPropagation();
      const page = Number(target.closest<HTMLElement>('.page-card')?.dataset.editorPage);
      if (page) { dialog.close(); hooks.goTo(page); }
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','h','j','k','l'].includes(event.key)) {
      let cards = [...grid.querySelectorAll<HTMLButtonElement>('.page-card')];
      const focused = cards.indexOf(document.activeElement as HTMLButtonElement);
      const position = Math.max(0, focused);
      const columns = Math.max(1, Math.floor(grid.clientWidth / 176));
      const direction = ['ArrowLeft','h'].includes(event.key) ? -1 : ['ArrowRight','l'].includes(event.key) ? 1 : ['ArrowUp','k'].includes(event.key) ? -columns : columns;
      let next = Math.max(0, Math.min(cards.length - 1, position + direction));
      if (next === cards.length - 1 && renderedCount < (current()?.pageCount || 0) && direction > 0) {
        const previous = renderedCount;
        renderedCount = Math.min(current()?.pageCount || previous, renderedCount + 72);
        appendCards(previous + 1, renderedCount);
        cards = [...grid.querySelectorAll<HTMLButtonElement>('.page-card')];
        next = Math.min(cards.length - 1, position + direction);
      }
      event.preventDefault();
      const page = Number(cards[next]?.dataset.editorPage);
      if (page && event.shiftKey) {
        const low = Math.min(selectAnchor, page), high = Math.max(selectAnchor, page);
        selected = new Set(Array.from({ length: high - low + 1 }, (_, index) => low + index)); lastSelected = page; markSelection();
      } else if (page) selectPage(page);
      cards[next]?.focus({ preventScroll: true }); cards[next]?.scrollIntoView({ block: 'nearest' });
    }
  }, true);

  dialog.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); grid.classList.add('accepting-files'); } }, true);
  dialog.addEventListener('dragleave', event => { if (event.relatedTarget && dialog.contains(event.relatedTarget as Node)) return; grid.classList.remove('accepting-files'); }, true);

  return {
    open() {
      const doc = current();
      if (!doc) { hooks.toast('Open a PDF before arranging pages.'); return; }
      if (documentId !== doc.id) resetHistory();
      selected = new Set([doc.page]); lastSelected = doc.page; selectAnchor = doc.page;
      render(); if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => grid.querySelector<HTMLButtonElement>(`.page-card[data-editor-page="${doc.page}"]`)?.focus({ preventScroll: true }));
    },
    openHistory() {
      this.open();
      if (!dialog.open) return;
      historyDisclosure.open = true;
      requestAnimationFrame(() => historyDisclosure.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true }));
    },
    importFiles(files, at) {
      const doc = current();
      if (!doc) { hooks.toast('Open a PDF before adding pages.'); return; }
      if (!dialog.open) { selected = new Set([doc.page]); render(); dialog.showModal(); }
      void importFiles(files, at);
    },
    applyEdit(label, page, operation) { void edit(label, page, operation); },
    recordExternalEdit(before, label) {
      if (!current()) return;
      if (documentId && current()?.id !== documentId) resetHistory();
      pushUndo(before);
      sessionEdits++;
      logActivity(label, 'edit');
      updateTools();
    },
    recordActivity(label) { if (current()) logActivity(label, 'annotation'); },
    undo() { void history(true); },
    redo() { void history(false); },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    stats: () => ({ edits: sessionEdits, undos: sessionUndos }),
    documentOpening() {
      if (applying) return;
      dialog.close(); resetHistory();
    },
  };
}
