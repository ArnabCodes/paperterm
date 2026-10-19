# paperterm.

A quiet PDF workspace for following ideas without losing your place. A minimal web interface, Sioyek-inspired keyboard navigation and reference previews, and a Rust/WebAssembly lookup engine.

This is a fresh browser-first implementation. It replaces the previous Python terminal prototype; Git history is preserved. The repository remains private.

## Start here

**Status:** working local web reader and unpacked Chrome extension, version 0.2.0. Tested on Windows with Chromium; macOS and Linux testing remains open. No public deployment or Chrome Web Store listing exists.

**Next:** build, load the extension, and try your own papers. See [TASKS.md](TASKS.md) for ownership and [validation](docs/VALIDATION.md) for actual test coverage and limits.

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

1. Build the app, or extract `artifacts/paperterm-0.2.0-chrome.zip` into a permanent folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked**, then select `dist/` (or the extracted ZIP folder containing `manifest.json`).
4. Open the extension's **Details** and enable **Allow access to file URLs** for local PDFs. Allow site access on the sites whose PDFs you want to open.
5. Open an ordinary PDF URL in a new tab. Paperterm replaces Chrome's built-in viewer for eligible top-level PDF navigations.

Generate the distributable with `npm run package` after building. It includes a SHA-256 companion file. Reload the extension after rebuilding. Disable the extension to restore Chrome's built-in viewer. This does not change the operating system's default application.

Chrome 128+ is the declared extension minimum because response-header redirect rules require it; the tested version is listed in the validation report. Use current Chrome. Embedded PDF frames, attachment downloads, POST responses, browser-internal viewers, and blob URLs are deliberately not intercepted. Sites with expiring URLs or unusual authentication may require downloading and opening the file locally. Disable other PDF-viewer extensions if their redirects conflict.

## Reading tools

- Continuous PDF rendering, selectable text, search highlights, outline navigation, rotation, fit modes, and two-page layout.
- Split-view previews for equations, bibliography entries, figures, and internal links. Enter peeks; Shift+Enter jumps. Escape returns to the main reading view.
- Keyboard hints over embedded links, plus heuristic hints over visible equation numbers and numeric citations even when the PDF has no links.
- Reading history, page bookmarks, named marks, a movable reading ruler, focus mode, and a searchable command palette.
- Paper, Sepia, and Night themes; custom foreground/background colors; up to 12 source-color replacements. Recoloring is a luminance mapping and changes images as well as text. Disable it when original scientific colors matter. Replacement colors take priority over recoloring.
- Local recent-document library and saved reading positions. Password prompt and invalid-file recovery.

### Keyboard map

Unmodified letters are lowercase. A capital letter below explicitly means Shift plus that letter. The interface displays shortcut letters in uppercase as labels, not as a requirement to hold Shift.

| Keys | Action |
| --- | --- |
| `o` / `Shift+o` | Open PDF / recent library |
| `j` `k` / arrows | Scroll down / up |
| `h` `l` | Scroll horizontally |
| `Space` / `Shift+Space` | Move a viewport |
| `Ctrl+d` / `Ctrl+u` | Move half a viewport |
| `gg` / `Shift+g` / `:` | First / last / numbered page |
| `+` `-` / `w` / `a` | Zoom / fit width / fit page |
| `Shift+r` | Rotate clockwise |
| `/` or `Ctrl+f` | Search document text |
| `n` / `Shift+n` | Next / previous text match |
| `e` / `c` / `v` | Equation / citation / figure or table lookup |
| `Enter` / `Shift+Enter` in lookup | Preview / jump to result |
| `f` / `Shift+f` | Follow / preview an embedded link by hint |
| `s` | Hint visible equation and citation references |
| `Alt+Left` / `Alt+Right` | Back / forward in reading history |
| `b` / `Shift+b` | Toggle bookmark / show bookmarks |
| `m` then a letter | Set a named mark |
| `'` then a letter | Return to that mark |
| `t` / `z` | Toggle outline / focus mode |
| `r` / `[` `]` | Toggle / move reading ruler |
| `d` / `,` | Cycle theme / reading settings |
| `Ctrl+k` (macOS: `Cmd+k`) | Command palette, including two-page layout |
| `?` / `Escape` | Keyboard guide / dismiss active surface |

## Privacy and boundaries

Document parsing, rendering, and reference indexing happen locally. No accounts, analytics, telemetry, or upload endpoint. Remote PDFs are fetched from their original host; following external links contacts their destinations. The extension requests broad host access to fetch and replace PDF navigations, not to read ordinary page content; it injects no content scripts.

Up to six opened local PDFs, each no larger than 25 MB, are cached in IndexedDB. Reading state and themes live in localStorage. This is **not encrypted storage**; clearing the origin's browser data removes it. Remote PDFs are not added to this library. The extension and standalone app have separate storage. PDF scripting and XFA are not enabled.

This is not full Sioyek parity. Lookup is text-based and heuristic, not a semantic citation resolver. Scans have no searchable text without OCR; there is no built-in OCR. Complex columns, unusual numbering, split captions, and bibliography styles can produce missing or incorrect matches. Inspect the preview before trusting a match. There is no SyncTeX, annotation editor, arbitrary key remapping, cross-document citation linking, or cloud sync. Very large documents have not been performance-qualified.

An ordinary browser tab cannot make the **Chrome window transparent** to the desktop. Custom page colors are supported; OS-level transparency from the earlier desktop request is not promised for this web app.

## Architecture and verification

- `src/reader.ts`: Mozilla PDF.js rendering, text layers, embedded links, outline, search, extraction, and preview canvas.
- `core/src/lib.rs`: Rust reference detection and ranking, compiled to WASM and executed by `src/engine.worker.ts`.
- `src/main.ts`, `src/ui.ts`, `src/style.css`: application state, keyboard controls, dialogs, and responsive reading workspace.
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

Project code retains the repository's MIT license. PDF.js and its bundled decoder/font notices are distributed with the build under `vendor/`; their respective licenses apply. The field-guide PDF is generated from original project text, not copied from a publication.
