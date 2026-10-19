const paths: Record<string, string> = {
  menu: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  command: '<path d="M9 9V5a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v14a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2Z"/>',
  open: '<path d="M3 9V5h7l2 3h9v12H3Z"/><path d="M3 12h18"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  mark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  next: '<path d="m10 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
  link: '<path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 8a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2" transform="translate(1 0) scale(.9)"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  document: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 13h8M8 17h6"/>',
  ruler: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M7 7v5m5-5v3m5-3v5"/>',
};
export const icon = (name: string) => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.document}</svg>`;
export const button = (action: string, name: string, title: string, extra = '') => `<button class="icon-button" data-action="${action}" aria-label="${title}" title="${title}" ${extra}>${icon(name)}</button>`;

export function shell() {
  return `
  <header class="topbar">
    <div class="brand"><img src="./mark.svg" width="28" height="28" alt=""/><span>paperterm<span class="brand-dot">.</span></span></div>
    <div class="document-title"><span id="document-name">Your reading workspace</span><span id="document-detail">A little less interface. A little more focus.</span></div>
    <div class="top-actions">${button('open', 'open', 'Open PDF (o)')}<button class="command-trigger" data-action="commands">${icon('command')}<span>Commands</span><kbd>Ctrl K</kbd></button>${button('settings', 'settings', 'Reading settings')}</div>
  </header>
  <main id="workspace">
    <section id="welcome" aria-labelledby="welcome-title">
      <div class="welcome-content"><div class="eyebrow"><span class="live-dot"></span> A QUIET PLACE TO READ</div>
      <h1 id="welcome-title">Follow the idea.<br/><em>Keep your place.</em></h1>
      <p class="intro">A considered workspace for papers, references, and the connections between them. Built around your keyboard.</p>
      <div class="welcome-actions"><button class="primary" data-action="open">${icon('plus')} Open a PDF <kbd>O</kbd></button><button class="text-button" data-action="demo">Explore the field guide ${icon('arrow')}</button></div>
      <div class="drop-note">or drop a document anywhere <span>·</span> Your PDFs stay on your device</div>
      <div class="feature-strip"><article><span class="feature-symbol">↗</span><h3>Keep the thread</h3><p>Peek at equations and citations<br/>without leaving the page.</p></article><article><span class="feature-symbol">⌘</span><h3>Stay in flow</h3><p>Navigate, search, and jump.<br/>Every action has a shortcut.</p></article><article><span class="feature-symbol">Aa</span><h3>Make it yours</h3><p>Quiet themes. Your colors.<br/>Space for focused reading.</p></article></div>
      <div id="recent-documents"></div></div>
      <div class="welcome-foot"><span>MADE FOR CURIOUS MINDS</span><button class="text-button" data-action="help">Keyboard guide <kbd>?</kbd></button></div>
    </section>
    <section id="reader" hidden aria-label="PDF reader">
      <aside id="sidebar"><div class="sidebar-tabs" role="tablist" aria-label="Document navigation"><button role="tab" data-action="outline" aria-selected="true">Contents</button><button role="tab" data-action="bookmarks" aria-selected="false">Bookmarks</button></div><div class="sidebar-caption" id="sidebar-caption">IN THIS DOCUMENT</div><nav id="navigation-list" aria-label="Document outline"></nav><div class="sidebar-foot"><span>MAKE ROOM FOR THE IDEA</span><button data-action="focus" class="text-button">Focus mode <kbd>Z</kbd></button></div></aside>
      <div id="reading-stage"><div id="viewer-container" tabindex="0" aria-label="PDF pages"><div id="viewer" class="pdfViewer"></div></div><div id="reading-ruler" hidden></div><div id="link-hints"></div></div>
      <aside id="portal" hidden aria-label="Reference preview"><div class="portal-heading"><div><span class="eyebrow">REFERENCE PREVIEW</span><h2 id="portal-title">A closer look</h2></div>${button('close-portal', 'close', 'Close preview (Escape)')}</div><div id="portal-scroll" tabindex="0" aria-label="Preview page"><canvas id="portal-canvas"></canvas><div id="portal-location"></div></div><div class="portal-footer"><span id="portal-page"></span><button class="primary small" data-action="portal-jump">Go to passage ${icon('arrow')}</button></div><div class="portal-tip">Your reading position is held. <kbd>Esc</kbd> to return.</div></aside>
    </section>
  </main>
  <footer id="reader-toolbar" hidden><div class="toolbar-group">${button('sidebar', 'menu', 'Toggle contents (t)')}${button('history-back', 'back', 'Return to previous position (Alt+Left)')}${button('history-forward', 'next', 'Go forward (Alt+Right)')}<span class="separator"></span><button class="page-button" data-action="page" aria-label="Go to page"><span id="page-current">1</span><span class="muted">/</span><span id="page-total">1</span></button></div><div class="toolbar-group toolbar-middle">${button('zoom-out', 'minus', 'Zoom out (-)')}<button id="zoom-value" class="text-button" data-action="fit-width" title="Fit width (w)">Fit width</button>${button('zoom-in', 'plus', 'Zoom in (+)')}<span class="separator"></span>${button('search', 'search', 'Search text (/)')}${button('bookmark', 'mark', 'Bookmark this page (b)')}${button('focus', 'focus', 'Focus mode (z)')}</div><div class="toolbar-group"><span id="engine-status" class="status-label">Ready</span>${button('download', 'download', 'Download original PDF')}${button('help', 'help', 'Keyboard guide (?)')}</div></footer>
  <button id="exit-focus" class="focus-exit" data-action="focus" hidden>Exit focus <kbd>Z</kbd></button>
  <div id="find-bar" hidden><label>${icon('search')}<input id="find-input" aria-label="Find in document" placeholder="Find in document…" autocomplete="off"/></label><span id="find-count" role="status"></span>${button('find-prev', 'back', 'Previous match (Shift+Enter)')}${button('find-next', 'next', 'Next match (Enter)')}${button('close-find', 'close', 'Close search (Escape)')}</div>
  <dialog id="palette" aria-labelledby="palette-title"><div class="palette-heading"><span id="palette-title">Commands</span><kbd>ESC</kbd></div><input id="palette-input" aria-label="Filter commands" autocomplete="off" spellcheck="false"/><div id="palette-results" role="listbox" aria-label="Results"></div><div id="palette-foot">↑ ↓ to navigate <span>↵ to select</span></div></dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="settings-title">Reading settings</h2></div>${button('close-dialog', 'close', 'Close settings')}</div><div class="theme-options"><button data-theme="paper"><span class="theme-sample paper">Aa</span>Paper</button><button data-theme="sepia"><span class="theme-sample sepia">Aa</span>Sepia</button><button data-theme="night"><span class="theme-sample night">Aa</span>Night</button></div><label class="setting-row"><span>Recolor document pages<small>Turn off to preserve the PDF’s original colors.</small></span><input id="recolor-toggle" type="checkbox"/></label><div class="color-fields"><label>Page background<input type="color" id="background-color"/></label><label>Text foreground<input type="color" id="foreground-color"/></label></div><div class="setting-section"><h3>Color replacements</h3><p>Replace a source color in diagrams and text. Near matches include antialiased edges.</p><div id="palette-mappings"></div><button class="text-button" data-action="add-color">${icon('plus')} Add a color replacement</button></div><div class="settings-note">Settings are saved in this browser. Browser pages cannot make the Chrome window transparent.</div><button class="secondary" data-action="reset-theme">Reset to Paper</button></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><div><span class="eyebrow">A SHORTCUT TO EVERYWHERE</span><h2 id="help-title">Keep your hands on the keys.</h2></div>${button('close-dialog', 'close', 'Close keyboard guide')}</div><div id="help-keys"></div><p class="settings-note">Press Ctrl K (⌘ K on macOS) to find any command. Browser-reserved shortcuts keep their usual behavior.</p></dialog>
  <dialog id="password-dialog" aria-labelledby="password-title"><form id="password-form"><span class="eyebrow">ENCRYPTED DOCUMENT</span><h2 id="password-title">This PDF needs a password.</h2><input id="password-input" type="password" aria-label="PDF password" autocomplete="off"/><p id="password-error"></p><div class="welcome-actions"><button type="submit" class="primary">Unlock PDF</button><button type="button" class="secondary" data-action="cancel-password">Cancel</button></div></form></dialog>
  <input id="file-input" type="file" accept="application/pdf,.pdf" hidden/>
  <div id="drop-overlay" hidden><div>${icon('document')}<h2>Drop into your next idea.</h2><p>Release your PDF to start reading.</p></div></div>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <div id="loading" hidden><span class="spinner"></span><span id="loading-label">Opening your document…</span></div>`;
}
