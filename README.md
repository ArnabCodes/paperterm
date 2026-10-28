# Pipit

**Pipit 0.11.7 source pushed to private GitHub** (`81b6774`): `[` / `]` now follow actual PDF text lines; Ctrl+P / ⌘+P opens a print-ready PDF in the browser viewer; `g Z` hands a remote PDF back to the browser for Zotero; Overleaf-initiated PDF tabs bypass Pipit so Overleaf’s SyncTeX viewer remains in control. It has not been deployed; the live site remains on 0.11.6.

A quiet PDF workspace for following ideas without losing your place. A minimal web interface, Sioyek-inspired keyboard navigation and reference previews, and a Rust/WebAssembly lookup engine.


## Start here

**Live 0.11.5 — reading history:** `g h` / `g l` move back / forward, with Backspace / Shift Backspace and the prior Alt-arrow shortcuts as aliases. Lesson 6 restores its equation preview when resumed, supports replay and returns to a page-relative position across pane resizing. The revised tutorial PDF keeps its original document identity and existing notes. [Try it](https://pipit-reader.pages.dev/reader/?tutor=1&v=0.11.5); see [shortcut audit](docs/KEYBOARD-AUDIT.md). Source has not been pushed.

**Live 0.11.4 — Flight School:** Mouse-accessible game controls, disabled reader controls, eleven distinct animated scenes, centered level introductions, completion confetti and an optional returning-player speedrun. The timer pauses with the game; skipped runs are unranked. [Play](https://pipit-reader.pages.dev/reader/?tutor=1&v=0.11.4). Chromium/WebKit full speedruns, Vimium, Firefox development package and public download hashes were verified. Native Safari remains untested. No GitHub push.

**Live 0.11.3 — lesson controls:** Flight School uses ⏎ for Enter and Shift H to toggle hints. The full course, text-entry protection, Chromium/WebKit, real Vimium and public downloads were verified. [Play the tutorial](https://pipit-reader.pages.dev/reader/?tutor=1&v=0.11.3). Source has not been pushed.

**Live release — 0.11.2 keyboard-extension conflicts:** Flight School now has a focused keyboard surface and independent light/dark appearance. The complete course passes with actual Vimium in an isolated Chromium profile. With default Surfingkeys autofocus protection, the course pauses safely and asks for a site exception; after Surfingkeys' Alt S site toggle, the complete course passes. Chromium extension and Firefox development extension were tested; WebKit was tested separately, not native Safari. Published at https://pipit-reader.pages.dev/reader/?tutor=1&v=0.11.2; all three public package hashes were verified. Source has not been pushed to GitHub. See [Tutor](docs/TUTOR.md).

**Live reliability/design patch — 27 October 2026:** [Pipit 0.11.1 Flight School](https://pipit-reader.pages.dev/reader/?tutor=1&v=0.11.1) replaces the long setup with Play focused by default. Enter starts/advances; Escape closes a tool, then pauses; Enter resumes. Original pixel-style SVG art, feathers, XP, lit keys and level tiles accompany the real PDF actions. The input fix supports immediate j/k, coach focus and forwarded webview events; training prefixes no longer expire while reading instructions. Guidance stays visible inside lookup/notebook dialogs. Full course and four-viewport regressions pass locally and live; Chromium extension and 36 Firefox checks pass. All three downloads independently match `docs/releases/0.11.1-alpha.4.json`. Update/reload installed packages to use this build. Source remains local; this patch was not pushed to GitHub. Earlier release entries below are historical.

**Live release — 27 October 2026:** [Pipit 0.11.0 / Alpha 04](https://pipit-reader.pages.dev/#download) rebuilds [Tutor](https://pipit-reader.pages.dev/reader/?tutor=1) as eleven keyboard games. Learn shows numbered keystrokes from j/k onward; Practice hides steps and keeps independent progress. Lessons require the taught shortcut plus a real result. Training enters hard mode, which blocks pointer input inside Pipit. `:HardMode` toggles it separately; **Ctrl Shift F12** always restores pointer input and pauses training. Reload also clears hard mode. Keyboard gaps were closed with `g i` / `g m` preview/document focus, `g q` anchored text-line capture, typed hex colors/mappings and Scholar queries. [Keyboard audit](docs/KEYBOARD-AUDIT.md), [tutorial guide](docs/TUTOR.md), [release evidence](docs/ALPHA.md). Website and packages are published; these source changes have not been pushed to GitHub. This supersedes the release entries below.

**Branding patch — 26 October 2026:** Version 0.10.1 removes obsolete migration copy from the website, docs and package installation text. The live site uses only Pipit branding and includes bird-icon social previews. Hidden storage and extension identity keys remain stable to preserve current Pipit data and updates. All three public package hashes were verified against `docs/releases/0.10.1-alpha.3.json`.

**GitHub source update — 26 October 2026:** Arnab authorized committing and pushing the current Alpha 03 source to this private repository after website publication. Earlier notes about withholding Git commits/pushes describe the prior publication boundary; no GitHub release upload or browser-store submission is included.

**Live release — 26 October 2026:** [Pipit 0.10.0 / Alpha 03](https://pipit-reader.pages.dev/#download) adds [Pipit Tutor](https://pipit-reader.pages.dev/reader/?tutor=1). Run `:Tutor` or choose Start Pipit Tutor on the welcome screen. A six-page LaTeX specimen supports 8 core missions, 2 optional challenges, 300 XP, 4 badges, hints and local pause/resume. [Tutorial source and reproduction](docs/TUTOR.md). Public packages and hosted PDF were independently hash-verified; Chromium and Firefox tutorial checks pass. Safari remains source-only and was not runtime-tested on this Windows host. No Git commit, push or store submission. This supersedes the Alpha 02 release entry below.

**User documentation:** [Pipit docs](https://pipit-reader.pages.dev/docs/) covers installation, navigation, reference previews, split views, themes, notes, local folders, citation maps and troubleshooting. The complete keyboard guide is generated from the current reader command definitions. Docs search runs locally; all topics remain readable without JavaScript.

**Live release — 22 October 2026:** [Pipit 0.9.0 / Alpha 02](https://pipit-reader.pages.dev/#download) includes the feature refinements below, the interactive website, and updated Chromium ZIP, unsigned Firefox XPI and Safari source ZIP. All three public packages and checksum companions are verified. This website/package publication supersedes the earlier local-only review restriction; GitHub/store publication was not performed. See [release evidence](docs/ALPHA.md). Historical local-review notes below describe the development sequence, not the current publication status.

**Publisher PDFs (local review):** citation maps retain subscriber-only PDF URLs as well as open-access links. When the selected paper has no indexed PDF, Pipit checks its DOI/publisher page for PDF metadata, structured data and explicit links using available browser credentials, then offers Open PDF directly in Pipit. Only the selected publisher is checked, with bounded/cancellable requests and session-memory caching. The toolbar can hand off an article page (including ScienceDirect) to discovery. Publisher cookies, institutional access, CAPTCHA/JavaScript challenges and extension site permissions can still prevent access; failed lookups provide the publisher link and retry. No access controls are bypassed. Reload the unpacked extension after rebuilding to test this change; it is not published.

**Internal file browser (local review):** `o` opens Local files in a glass three-column browser: parent/locations, current folder, and selection/folder preview. Choose a folder or use the Downloads/Documents starting locations to grant read-only access. Chromium directory handles are remembered locally and restored after reload when permission remains granted; an explicit Reconnect action renews expired permission. Unsupported browsers use the attached folder-selection input; those imports remain session-only. Recent PDF copies are a separate view, never confused with your disk. Use arrows or `h j k l`, Enter, Home/End, `/` to filter, Tab for controls, and Escape to close. The browser still requires an initial system folder permission picker. No files are uploaded, modified, or deleted. See [local file access and validation](docs/LOCAL-FILES.md).

**Reader refinement (local only):** `F` unifies reference previews (`s` aliases it; `f` follows links), with scrollable column context and independent preview pages. The dock expands on both sides of stationary core controls; hover menus share its glass treatment and dismiss beyond a 28px safety radius. Citation exploration restores known papers, automatically identifies exact matches on first opening (opt-out available), and has reference/citing filters, a three-hop slider, citation-rate sizing, graph/list navigation and indexed open-PDF links. Notebook backup/import and undo/redo remain behind one disclosure. See [citation behavior and privacy](docs/CITATION-MAP.md) and [the feature audit](docs/UX-REVIEW.md). Nothing is published.

**Website review:** a feature-first interactive showcase now demonstrates equation peeks, keyboard reading/command search, palettes, and the upcoming field map. A pausable guided tour stops on interaction, leaving the viewport, or hiding the tab; reduced-motion users start with a static scene. Build with `npm run build:site`, preview on port 4181. This redesign is local only, not deployed.

**Release 0.9.0:** broader-field OpenAlex citation maps and content-only, column-aware equation/figure/table previews are included. See [feature behavior and limits](docs/CITATION-MAP.md). The reading tools below describe this version.

**Status:** **0.9.0 / Alpha 02** is live at [pipit-reader.pages.dev](https://pipit-reader.pages.dev/), with tested Chromium and Firefox extensions, a Safari source target, and a browser-aware download website with Pip the bird mascot. Safari installation/runtime validation and macOS/Linux testing remain open. Safari does not automatically intercept PDF responses. No store listing exists. See [browser support and installation](docs/BROWSERS.md) and [performance evidence](docs/PERFORMANCE.md).

**Next:** try the Alpha 01 packages on the [download page](https://pipit-reader.pages.dev/#download). See the [alpha dashboard](docs/ALPHA.md) for website build/deployment, [TASKS.md](TASKS.md) for ownership, and [validation](docs/VALIDATION.md) for actual test coverage and limits. Local website preview uses port 4181.

### Build and run

Install Node.js 22.12+ (24 recommended), npm, and a stable Rust toolchain through rustup. Windows native Rust tests need the MSVC build tools.

```sh
rustup toolchain install stable
rustup target add wasm32-unknown-unknown --toolchain stable
npm ci
npm run build
npm run preview
```

Open http://127.0.0.1:4173. Choose a local PDF, drop one into the window, or explore the included original six-page field guide. Development mode is `npm run dev`.

The build bundles the renderer, PDF worker, fonts, character maps, image decoders, and Rust WASM. No CDN or document-processing server is required. Serve `dist/` over HTTP(S); opening the application HTML directly with `file://` is not supported.

### Make it Chrome's PDF viewer

1. Build the app, or extract `artifacts/pipit-0.8.0-chrome.zip` into a permanent folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked**, then select `dist/` (or the extracted ZIP folder containing `manifest.json`).
4. Open the extension's **Details** and enable **Allow access to file URLs** for local PDFs. Allow site access on the sites whose PDFs you want to open.
5. Open an ordinary PDF URL in a new tab. Pipit replaces Chrome's built-in viewer for eligible top-level PDF navigations.

Generate the distributable with `npm run package` after building. It includes a SHA-256 companion file. **After an update, click Reload on the Pipit card in `chrome://extensions`, then reopen your PDF tabs.** Refreshing an existing PDF tab alone does not update the background redirect rules. Disable the extension to restore Chrome's built-in viewer. This does not change the operating system's default application.

Chrome 128+ is the declared extension minimum because response-header redirect rules require it; the tested version is listed in the validation report. Use current Chrome. Top-level GET responses served as `application/pdf` open directly, **including attachment-style PDF links**. Opening a remote PDF does not save a file to Downloads or add it to the recent-document library. Like any viewer, the browser must fetch the PDF bytes and may use its normal network cache. Use the Download button to explicitly save a copy; `pipit-download=1` in a URL also bypasses interception.

Embedded PDF frames, POST responses, browser-internal viewers, blob URLs, and files served with a non-PDF MIME type are not intercepted. Sites with expiring URLs or unusual authentication may require downloading and opening the file locally. Disable other PDF-viewer extensions if their redirects conflict.

## Reading tools

- Continuous PDF rendering, selectable text, search highlights, outline navigation, rotation, fit modes, and two-page layout.
- Centered content-only quick looks have no visible header, controls or padding. They detect two-column text and fit the selected equation/figure/table region to that column, using a fresh high-resolution render rather than enlarging a low-resolution raster. The page beneath is dimmed; the viewport remains rounded with a subtle external shadow. `g P` restores the full page when heuristics crop imperfectly. Enter follows, Shift+P pins/unpins, Alt+Up/Down cycles results, Escape closes, and right-click/Shift+F10 opens transient actions. Other preview actions remain in `:`.
- Pinned previews resize by dragging their left edge, or by focusing the separator and using Left/Right arrows (Home/End for limits). Width is saved locally; returning to a floating preview restores the centered proportions. The main reading area retains at least 280px on desktop.
- Right-click an internal link or an unlinked equation/citation/figure number to preview it; middle-click to jump. Select a reference and press `Alt+Enter` to peek or `Alt+Shift+Enter` to jump. Every jump keeps a return point in reading history.
- Field citation map (`g c`): explicitly search OpenAlex by title/DOI, confirm the correct paper, and explore references, citing papers and related work as a directed graph. Nodes support keyboard selection, filtering, source links and recentering. Provider/time/subset coverage and partial failures are visible; results are bounded and cached locally. Only submitted metadata queries and public work IDs leave the browser, never PDF bytes or notes. The previous offline page-to-bibliography view remains at `g L`, with local numeric-citation matching and backlinks; author–year citations and scans are not mapped by that local view. See [coverage and privacy](docs/CITATION-MAP.md).
- A local research notebook: select a passage and press `q` to save its quote and page, add your own notes, jump back later, and export Markdown. `Shift+q` opens the notebook; text-only notes are also supported. Quotes and notes are separate from the original PDF.
- Searchable document contents, next/previous section and equation navigation, plus explicit Google Scholar searches and DOI/arXiv links from detected references. These external actions open a new tab only when selected.
- Keyboard hints over embedded links, plus heuristic hints over visible equation numbers and numeric citations even when the PDF has no links.
- Reading history, page bookmarks, named marks, a movable reading ruler, focus mode, and a searchable command palette.
- The ruler advances to the next visible PDF text line with `]` and back with `[`. `Ctrl+P` / `⌘+P` opens the PDF in the browser’s native viewer for direct printing without a download detour. Use `g Z` on a remote PDF to open its source in the browser for Zotero Connector; local files have no source URL to hand off.
- Overleaf-originated PDF tabs remain with Overleaf’s SyncTeX-aware viewer. Pipit itself does not implement SyncTeX; keep Overleaf’s PDF Viewer setting on **Overleaf** rather than **Browser**.
- Paper, Sepia, and Night plus 20 terminal-inspired light/dark themes, with brightness filters and command-menu selection. See [theme names and sources](docs/THEMES.md). Opaque inks map to nearby palette colors; antialiased edge pixels retain their coverage and blend continuously against the chosen paper color. PDF canvases use grayscale antialiasing so subpixel fringes are not mistaken for colored ink. Terminal themes use full ANSI snapshots; the original three presets use their own three swatches. Custom foreground/background colors and up to 12 source replacements remain available and take priority, including smooth text edges. This changes images too; disable recoloring when original scientific colors matter.
- Local recent-document library and saved reading positions. Password prompt and invalid-file recovery.
- Frosted panels with blur, saturation, and translucent theme-aware surfaces. Turn off **Frosted panels** for solid dialogs/sidebar; the dock retains its 24%-opacity background and backdrop blur at rest and expanded. A continuous spring controls expansion and contraction, retaining velocity when interrupted; nearby icons gently magnify under the pointer. Reduced-motion mode exposes tools immediately, and reduced-transparency preferences take priority. Interface text uses locally bundled Inter Variable. PDF typography itself is unchanged.
- Press `g o` to open a direct PDF URL without saving it first. The standalone web app needs a CORS-enabled source; the extension can fetch permitted hosts.
- Full-window reading with a compact glass dock always in reach: contents, page, search, and commands. Hover over it to expand more tools with an eased animation; move away to return to the compact form. The transparent left panel appears at the screen edge. Neither floating surface shrinks the PDF. Selection uses soft fills rather than borders. Icons use a consistent, locally bundled Lucide set.
- Keyboard access does not depend on hovering: `F6` expands and focuses the dock, `t` opens/pins the contents panel, and `Escape` collapses controls. On touch screens, tap the dock or bottom edge for more tools. Scrollbars appear during mouse/trackpad wheel scrolling, then disappear; keyboard scrolling keeps them hidden. Ctrl+wheel zooms the PDF around the pointer while keeping the interface size fixed; over a preview it zooms that preview independently.

### Keyboard map

Unmodified letters are lowercase. A capital letter below explicitly means Shift plus that letter. The interface displays shortcut letters in uppercase as labels, not as a requirement to hold Shift.

| Keys | Action |
| --- | --- |
| `o` / `Shift+o` | Open PDF / recent library |
| `g o` | Open PDF from URL |
| `j` `k` / arrows | Scroll down / up |
| `h` `l` | Scroll horizontally |
| `Space` / `Shift+Space` | Move a viewport |
| `d` / `u` | Move half a viewport |
| `gg` / `Shift+g` / `p` | First / last / numbered page |
| `+` `-` / `w` / `a` / `Shift+w` | Zoom / fit width / fit page / smart text width |
| `Ctrl+wheel` | Zoom PDF under the pointer; over a preview, zoom only the preview |
| `Ctrl+PageDown` / `Ctrl+PageUp` | Browser tab navigation (not intercepted) |
| `Shift+r` | Rotate clockwise |
| `/` or `Ctrl+f` | Search document text |
| `n` / `Shift+n` | Next / previous text match |
| `e` / `c` / `v` | Equation / citation / figure or table lookup |
| `Enter` / `Shift+Enter` in lookup | Preview / jump to result |
| `Alt+Enter` / `Alt+Shift+Enter` with selected reference | Preview / jump to its definition |
| `Enter` / `Shift+p` in preview | Jump to passage / pin or unpin beside paper |
| `Alt+Up` / `Alt+Down` | Previous / next preview result |
| `g c` / `g t` | Broader-field citation map / searchable contents |
| `g L` / `g P` | Local reference backlinks / full-page preview override |
| `g e` / `g Shift+e` | Next / previous equation definition |
| `g s` / `g Shift+s` | Next / previous section |
| `q` / `Shift+q` | Capture selected passage / open notebook |
| `f` / `Shift+f` | Follow / preview an embedded link by hint |
| `s` | Hint visible equation and citation references |
| `Alt+Left` / `Alt+Right` | Back / forward in reading history |
| `b` / `Shift+b` | Toggle bookmark / show bookmarks |
| `m` then a letter | Set a named mark |
| `'` then a letter | Return to that mark |
| `t` / `z` | Toggle/pin outline / focus mode |
| `F6` | Expand dock and focus its controls |
| `r` / `[` `]` | Toggle / move reading ruler |
| `g d` / `,` | Cycle theme / reading settings |
| `g 2` | Toggle single-page / two-page spread |
| `g l` / `g r` | Toggle frosted panels / document recoloring |
| `g b` / `g f` / `g p` | Edit background / foreground / palette replacements |
| `g 0` / `g v` | Reset appearance / enable Vimium compatibility |
| `g D` / `g h` | Download original PDF / open field guide |
| `g C` | Clear cached PDFs after confirmation; original files and notes remain |
| `g B` / `g /` | Preview citation mentions / search selected text in Scholar |
| `Ctrl/Cmd+Enter` / `Ctrl/Cmd+S` inside notebook | Add text note / export Markdown |
| `:` / `Ctrl+k` (macOS: `Cmd+k`) | All commands: reading tools, settings, themes, and two-page layout |
| `Ctrl+p` (macOS: `⌘+p`) | Open the source PDF in the browser’s native viewer for printing |
| `g Z` | Open a remote PDF in the native browser viewer for Zotero Connector |
| `:` then a number, `Enter` | Jump directly to that page |
| `?` or `F1` / `Escape` | Keyboard guide / dismiss active surface |

## Privacy and boundaries

### Keyboard ownership and Vimium

Open the searchable keyboard map with `F1` or `?`. Its 77 entries are organized into eight sections: navigation, layout, references, previews, research, appearance, files, and browser/workspace controls. Wide screens use four columns; smaller screens use three, two, or one with an internally scrollable list. The lightly frosted surface respects solid-panel and reduced-transparency settings. Keys separated by spaces are sequential; uppercase letters mean Shift. Command-menu labels and leader dispatch share `src/shortcuts.ts` so new bindings stay synchronized.

Reader mode supplies the PDF bindings above. Settings → **Vimium compatibility** (also available through `:`) leaves plain keys to Vimium on the web app: scrolling, `t`/`T`, `f`/`F`, `r`, `x`/`X`, and navigation prefixes are not consumed by Pipit. Use `:` or Ctrl/Cmd+K for every PDF action, Ctrl/Cmd+F for PDF-wide search, Ctrl/Cmd+O to open a document, and Alt+Enter / Alt+Shift+Enter for selection lookup. Inputs retain normal typing. Tab/Shift+Tab reach controls; floating previews keep focus inside until Escape or pinning. `+`/`-` zoom the focused preview independently.

Vimium cannot inject into another extension’s pages; the installed viewer therefore supplies its own reader keys. `x` closes the current extension tab using the platform tab API, verified on disposable Chromium and Firefox tabs. In the ordinary web app, `x`/`X` pass through to Vimium rather than trying to bypass browser tab-closing restrictions; Ctrl/Cmd+W and Ctrl/Cmd+Shift+T retain native close/restore behavior. Ctrl+D, Ctrl+U, and Ctrl+PageUp/PageDown are no longer intercepted. Half-page scrolling is `d`/`u`; URL opening moves to `g o`, and theme cycling to `g d`. Single lowercase letters in the guide mean unshifted keys; shifted variants are labeled explicitly.

Extension event-handler ordering cannot be controlled by a website. If a customized Vimium map also captures `:`, comma, or Alt+Enter, configure a per-site Vimium pass-key/exclusion rule for those Pipit entry points. The compatibility tests verify key ownership and browser-native actions, not every Vimium version or custom mapping.

Document parsing, rendering, and reference indexing happen locally. No accounts, analytics, telemetry, or upload endpoint. Remote PDFs are fetched from their original host; following external links contacts their destinations. The optional field map sends only the metadata query you submit and selected public work IDs directly to OpenAlex, never PDF bytes or notes; inspect sensitive titles before searching. Its successful neighborhoods are cached locally for 24 hours. The extension requests broad host access to fetch and replace PDF navigations, not to read ordinary page content; it injects no content scripts.

Up to six opened local PDFs, each no larger than 25 MB, are cached in IndexedDB. Reading state and themes live in localStorage. This is **not encrypted storage**; clearing the origin's browser data removes it. Remote PDFs are not added to this library. The extension and standalone app have separate storage. PDF scripting and XFA are not enabled.

Notebook entries also live in localStorage, keyed to the document fingerprint: up to 200 entries per PDF, with 8,000 characters each for an excerpt and its note. Browser storage limits can be lower; a save failure is shown and Markdown export remains available. External Scholar searches send the selected reference/passage to Google only after an explicit command. DOI/arXiv actions contact their respective sites.

This is not full Sioyek parity. Lookup is text-based and heuristic, not a semantic citation resolver. Scans have no searchable text without OCR; there is no built-in OCR. Complex columns, unusual numbering, split captions, and bibliography styles can produce missing or incorrect matches. Inspect the preview before trusting a match. Pipit itself has no SyncTeX, annotation editor, arbitrary key remapping, cross-document citation linking, or cloud sync. Overleaf-originated PDF tabs are left to Overleaf’s own SyncTeX-aware viewer. Very large documents have not been performance-qualified.

An ordinary browser tab cannot make the **Chrome window transparent** to the desktop. Custom page colors are supported; OS-level transparency from the earlier desktop request is not promised for this web app.

## Architecture and verification

- `src/reader.ts`: Mozilla PDF.js rendering, text layers, embedded links, outline, search, extraction, and preview canvas.
- `core/src/lib.rs`: Rust reference detection and ranking, compiled to WASM and executed by `src/engine.worker.ts`.
- `src/main.ts`, `src/ui.ts`, `src/style.css`: application state, keyboard controls, dialogs, and responsive reading workspace.
- `src/chrome.ts`, `src/chrome.css`, `src/themes.ts`: hover/keyboard chrome, floating glass surfaces, transient scrollbars, and theme tokens.
- `src/dock-motion.ts`: frame-driven, velocity-preserving dock spring and local icon magnification.
- `src/text-lines.ts`, `src/research.ts`, `src/research-panel.ts`: heuristic column extraction, numeric reference map, interactive graph, and backlinks.
- `src/notebook.ts`, `src/research.css`, `src/icons.ts`: local notes and export, quick-look surfaces, and inline icon geometry.
- `src/color-palette.ts`, `src/theme-palettes.ts`: bounded perceptual palette matching and bundled ANSI palette snapshots.
- `public/background.js`: Manifest V3 top-level PDF redirect rules. HTML with a `.pdf` suffix is not mistaken for a PDF.
- `scripts/verification/`: repeatable Playwright CLI scenarios; see [validation instructions](docs/VALIDATION.md).

```sh
npm test
npm run build
npm run package
```

Both npm and Cargo dependencies are locked. The Rust scripts select rustup's compiler explicitly to avoid a standalone Windows Rust installation shadowing it. Changes to `core/` require rebuilding WASM; Vite's development server alone does not rebuild Rust.

### Sources and licenses

Rendering is provided by [Mozilla PDF.js](https://mozilla.github.io/pdf.js/), not a newly written Rust PDF parser. The viewer's WebAssembly reference engine is Rust; the browser UI is TypeScript. Navigation takes inspiration from [Sioyek's commands](https://sioyek-documentation.readthedocs.io/en/latest/commands.html). Chrome integration uses [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).

Project code retains the repository's MIT license. PDF.js and its bundled decoder/font notices are distributed with the build under `vendor/`; their respective licenses apply. The interface bundles [Inter 4.1](https://github.com/rsms/inter/tree/v4.1) under the SIL Open Font License, included in `fonts/OFL.txt`. Inline icons use [Lucide](https://github.com/lucide-icons/lucide) geometry under ISC; attribution and full license are in `docs/ICON-LICENSE.txt` and the build's `vendor/LUCIDE-LICENSE.txt`. The original folded-page logo is maintained as `public/mark.svg`; build-time SVG rasterization generates matching browser and extension icons. The field-guide PDF is generated from original project text, not copied from a publication.
