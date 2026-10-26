import { icon } from './icons';
import { escapeHtml as esc } from './types';
import { listBooks } from './library';
import { readLocalFolder, saveLocalFolder, type LocalFolderHandle } from './file-location';
import './file-browser.css';

interface Entry { name: string; children?: Entry[]; folder?: LocalFolderHandle; file?: () => Promise<Blob>; updated?: number }

export function initializeFileBrowser(open: (blob: Blob, name: string) => Promise<void>) {
  const dialog = document.createElement('dialog');
  dialog.id = 'file-browser';
  dialog.setAttribute('aria-labelledby', 'files-title');
  dialog.innerHTML = `<header><div><span class="eyebrow">YOUR LOCAL WORKSPACE</span><h2 id="files-title">Open a paper</h2></div><button data-files="close" aria-label="Close file browser">${icon('close')}</button></header><div class="files-tools"><button data-files="recent">${icon('history')} Recent</button><button data-files="folder">${icon('open')} Connect folder</button><button data-files="import">${icon('plus')} Add PDFs</button><label>${icon('search')}<input type="search" placeholder="Filter this folder…" aria-label="Filter files"/></label></div><nav aria-label="Folder path"></nav><div class="files-columns"><section aria-label="Parent folder"></section><section aria-label="Current folder"><div role="listbox" tabindex="0" aria-label="Files"></div></section><section aria-label="Selection preview"></section></div><p class="files-status" role="status"></p><footer><span>↑ ↓ / j k select · ← h parent · → l / Enter open · / filter · Esc close</span><span>Local only</span></footer>`;
  document.body.append(dialog);
  const filter = dialog.querySelector('input')!;
  const localButton = document.createElement('button');
  localButton.dataset.files = 'local'; localButton.innerHTML = `${icon('open')} Local files`;
  dialog.querySelector('.files-tools')!.prepend(localButton);
  const columns = dialog.querySelectorAll<HTMLElement>('.files-columns > section');
  const list = dialog.querySelector<HTMLElement>('[role=listbox]')!;
  const status = dialog.querySelector<HTMLElement>('.files-status')!;
  const folderInput = document.createElement('input');
  folderInput.type = 'file'; folderInput.setAttribute('webkitdirectory', ''); folderInput.multiple = true;
  folderInput.hidden = true; folderInput.setAttribute('aria-label', 'Choose a local folder');
  const pdfInput = document.createElement('input');
  pdfInput.type = 'file'; pdfInput.accept = 'application/pdf,.pdf'; pdfInput.multiple = true;
  pdfInput.hidden = true; pdfInput.setAttribute('aria-label', 'Choose local PDFs');
  dialog.append(folderInput, pdfInput);
  let root: Entry = { name: 'Recent PDFs', children: [] }, connected: Entry | undefined;
  let path: Entry[] = [root], visible: Entry[] = [], selected = 0, revision = 0, renderRevision = 0;
  let returnFocus: HTMLElement | null = null;
  let view: 'local' | 'recent' = 'local', needsPermission = false;
  const restoredFolder = readLocalFolder().then(handle => {
    if (handle && !connected) connected = { name: handle.name, folder: handle };
  }).catch(() => {});
  const current = () => path[path.length - 1];
  const isFolder = (entry: Entry) => !!entry.children || !!entry.folder;
  function message(text: string) { status.textContent = text; }
  function locations() {
    columns[0].innerHTML = `<div class="files-locations"><span class="eyebrow">LOCAL FOLDERS</span><button data-files="folder">${icon('open')} Choose a folder</button><button data-files="downloads">${icon('download')} Downloads…</button><button data-files="documents">${icon('document')} Documents…</button>${connected ? `<button data-files="local">${icon('open')}<span>${esc(connected.name)}</span></button>` : ''}<button data-files="recent">${icon('history')} Recent PDFs</button></div>`;
  }
  function emptyLocal() {
    revision++; renderRevision++; view = 'local'; visible = []; selected = 0; filter.value = '';
    dialog.querySelector('nav')!.textContent = connected?.name || 'Local files';
    locations();
    list.innerHTML = `<div class="files-empty"><strong>${needsPermission ? 'Reconnect your folder' : 'Show files on your computer'}</strong><p>${needsPermission ? `Allow read access to ${esc(connected?.name || 'your folder')} to show its PDFs again.` : 'Choose a local folder once. Its PDFs and subfolders will appear here.'}</p><button data-files="${needsPermission ? 'reconnect' : 'folder'}">${icon('open')} ${needsPermission ? 'Reconnect folder' : 'Choose local folder'}</button><button data-files="import">${icon('plus')} Choose PDF files</button></div>`;
    list.removeAttribute('aria-activedescendant');
    columns[2].innerHTML = '<div class="files-empty">Private by design<p>Pipit cannot list your disk until you choose a folder. Files stay on your computer; only the chosen folder reference is remembered where supported.</p></div>';
    message('Folder access is read-only. The browser asks for permission when needed.');
    localButton.setAttribute('aria-pressed', 'true');
  }
  async function local() {
    view = 'local'; filter.value = ''; localButton.setAttribute('aria-pressed', 'true');
    if (!connected) { needsPermission = false; emptyLocal(); return; }
    try {
      needsPermission = !!connected.folder?.queryPermission && await connected.folder.queryPermission({ mode: 'read' }) !== 'granted';
      if (needsPermission) { emptyLocal(); return; }
      path = [connected]; await render();
    } catch { needsPermission = true; emptyLocal(); }
  }
  async function children(entry: Entry) {
    if (entry.folder) {
      const entries: Entry[] = [];
      for await (const handle of entry.folder.values()) {
        if (handle.kind === 'directory') entries.push({ name: handle.name, folder: handle });
        else if (/\.pdf$/i.test(handle.name)) entries.push({ name: handle.name, file: () => handle.getFile() });
      }
      entry.children = entries.sort((left, right) => Number(isFolder(right)) - Number(isFolder(left)) || left.name.localeCompare(right.name, undefined, { numeric: true }));
    }
    return entry.children || [];
  }
  async function preview() {
    const token = ++revision, entry = visible[selected];
    list.querySelectorAll('[role=option]').forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
    const active = list.querySelector<HTMLElement>(`#files-entry-${selected}`);
    if (active) { list.setAttribute('aria-activedescendant', active.id); active.scrollIntoView({ block: 'nearest' }); }
    else list.removeAttribute('aria-activedescendant');
    columns[2].innerHTML = entry ? `<div class="files-preview-title">${icon(isFolder(entry) ? 'open' : 'document')}<strong>${esc(entry.name)}</strong></div><p>${isFolder(entry) ? 'Folder · Enter to explore' : 'PDF document · Enter to read'}</p>` : '<div class="files-empty">Your next idea starts here.<p>Connect a folder or add a few PDFs.</p></div>';
    if (!entry || !isFolder(entry)) return;
    try {
      const next = await children(entry);
      if (token !== revision || !dialog.open) return;
      const container = document.createElement('div');
      container.className = 'files-next';
      container.innerHTML = next.slice(0, 50).map((item, index) => `<button data-child="${index}">${icon(isFolder(item) ? 'open' : 'document')}<span>${esc(item.name)}</span></button>`).join('') || '<p>No PDFs or folders here.</p>';
      container.addEventListener('click', event => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-child]');
        if (button) { path.push(entry); filter.value = ''; selected = Number(button.dataset.child); void render(false); }
      });
      columns[2].append(container);
    } catch { if (token === revision) message('Folder access expired. Connect the folder again to restore permission.'); }
  }
  async function render(reset = true) {
    const token = ++renderRevision;
    if (reset) selected = 0;
    try {
      const entries = await children(current());
      if (token !== renderRevision || !dialog.open) return;
      visible = entries.filter(entry => entry.name.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase()));
      selected = Math.max(0, Math.min(selected, visible.length - 1));
      list.innerHTML = visible.map((entry, index) => `<div role="option" id="files-entry-${index}" aria-selected="${index === selected}" data-entry="${index}">${icon(isFolder(entry) ? 'open' : 'document')}<span>${esc(entry.name)}</span>${isFolder(entry) ? icon('next') : '<small>PDF</small>'}</div>`).join('') || '<p class="files-empty">No matching PDFs or folders.</p>';
      if (path.length > 1) columns[0].innerHTML = `<button data-parent>${icon('back')}<span>${esc(path[path.length - 2].name)}</span></button>`;
      else locations();
      const parent = path[path.length - 2];
      if (parent) for (const sibling of parent.children || []) {
        const button = document.createElement('button');
        button.innerHTML = `${icon(isFolder(sibling) ? 'open' : 'document')}<span>${esc(sibling.name)}</span>`;
        button.classList.toggle('files-current', sibling === current());
        button.addEventListener('click', () => { path.pop(); selected = (parent.children || []).indexOf(sibling); filter.value = ''; void render(false).then(activate); });
        columns[0].append(button);
      }
      dialog.querySelector('nav')!.innerHTML = path.map((entry, index) => `<button data-path="${index}">${esc(entry.name)}</button>`).join('<span>/</span>');
      message(`${visible.length} items · PDF files and folders only · ${view === 'local' ? 'Read-only local access' : 'Recent PDF copies'} · Nothing is uploaded`);
      void preview();
    } catch { if (token === renderRevision) { if (view === 'local') { needsPermission = true; emptyLocal(); } else { message('Cannot read recent PDFs. Choose a local folder instead.'); list.innerHTML = ''; } } }
  }
  async function activate() {
    const entry = visible[selected];
    if (!entry) return;
    if (isFolder(entry)) { path.push(entry); filter.value = ''; await render(); list.focus(); }
    else if (entry.file) {
      try { const blob = await entry.file(); dialog.close(); await open(blob, entry.name); }
      catch (error) { message(error instanceof Error ? error.message : 'Could not open this PDF. Reconnect its folder.'); }
    }
  }
  function parent() { if (path.length > 1) { path.pop(); filter.value = ''; void render(); } list.focus(); }
  function importFiles(files: File[]) {
    if (!files.length) return;
    root = { name: files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Added PDFs', children: [] };
    for (const file of files.filter(item => /\.pdf$/i.test(item.name))) {
      const parts = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1) : [file.name];
      let directory = root;
      for (const name of parts.slice(0, -1)) {
        let child = directory.children!.find(entry => entry.name === name && entry.children);
        if (!child) { child = { name, children: [] }; directory.children!.push(child); }
        directory = child;
      }
      directory.children!.push({ name: file.name, file: async () => file });
    }
    connected = root; path = [root]; view = 'local'; needsPermission = false; filter.value = ''; localButton.setAttribute('aria-pressed', 'true'); void render(); list.focus();
  }
  folderInput.addEventListener('change', () => { importFiles([...folderInput.files || []]); folderInput.value = ''; });
  pdfInput.addEventListener('change', () => { importFiles([...pdfInput.files || []]); pdfInput.value = ''; });
  async function recent() {
    view = 'recent'; localButton.setAttribute('aria-pressed', 'false');
    try { root = { name: 'Recent PDFs', children: (await listBooks()).map(book => ({ name: book.name, file: async () => book.blob })) }; path = [root]; filter.value = ''; await render(); }
    catch { message('Recent library unavailable. You can still connect a folder or add PDFs.'); }
  }
  dialog.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button, [data-entry]');
    if (!target) return;
    if (target.dataset.entry !== undefined) { selected = Number(target.dataset.entry); void preview(); list.focus(); }
    if (target.hasAttribute('data-parent')) parent();
    if (target.dataset.path !== undefined) { path = path.slice(0, Number(target.dataset.path) + 1); filter.value = ''; void render(); list.focus(); }
    if (target.dataset.files === 'close') dialog.close();
    if (target.dataset.files === 'recent') void recent().then(() => list.focus());
    if (target.dataset.files === 'local') void local().then(() => list.focus());
    if (target.dataset.files === 'import') pdfInput.click();
    if (target.dataset.files === 'reconnect' && connected?.folder?.requestPermission) {
      void connected.folder.requestPermission({ mode: 'read' }).then(permission => {
        if (permission !== 'granted') message('Read access was not granted. Choose a folder or PDF files instead.');
        else void local().then(() => list.focus());
      }).catch(() => message('Could not renew access. Choose the folder again.'));
    } else if (['folder', 'downloads', 'documents', 'reconnect'].includes(target.dataset.files || '')) {
      const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: string; id: string; startIn?: string }) => Promise<LocalFolderHandle> }).showDirectoryPicker;
      if (!picker) folderInput.click();
      else void picker.call(window, { mode: 'read', id: 'pipit-local-folder', ...(['downloads', 'documents'].includes(target.dataset.files || '') ? { startIn: target.dataset.files } : {}) }).then(async folder => {
        connected = { name: folder.name, folder }; view = 'local'; needsPermission = false;
        await local();
        try { await saveLocalFolder(folder); }
        catch { message('Folder connected for this tab. Your browser could not remember its access for next time.'); }
      }).then(() => list.focus()).catch(error => { if (error.name !== 'AbortError') message('Folder access was denied or unavailable. Use Choose PDF files / Add PDFs, or select a folder again.'); });
    }
  });
  list.addEventListener('dblclick', () => { void activate(); });
  filter.addEventListener('input', () => { if (view === 'local' && (!connected || needsPermission)) return; void render(); });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); return; }
    if (event.key === 'Tab') return;
    if (event.target === filter && !['ArrowDown', 'Enter'].includes(event.key)) return;
    if ((event.target as HTMLElement).closest('button')) return;
    if (['ArrowDown', 'j', 'ArrowUp', 'k', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      selected = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, selected + (['ArrowDown', 'j'].includes(event.key) ? 1 : -1)));
      list.focus(); void preview();
    } else if (['ArrowRight', 'l', 'Enter'].includes(event.key)) { event.preventDefault(); list.focus(); void activate(); }
    else if (['ArrowLeft', 'h', 'Backspace'].includes(event.key)) { event.preventDefault(); parent(); }
    else if (event.key === '/') { event.preventDefault(); filter.focus(); }
  });
  dialog.addEventListener('close', () => { revision++; renderRevision++; returnFocus?.isConnected && returnFocus.focus(); });
  return async () => {
    if (dialog.open) return;
    returnFocus = document.activeElement as HTMLElement;
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(other => other.close());
    dialog.showModal();
    await restoredFolder;
    if (dialog.open) await local();
    if (!connected || needsPermission) list.querySelector<HTMLButtonElement>('button')?.focus();
    else list.focus();
  };
}
