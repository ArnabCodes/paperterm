# Validation record

Date: 2026-10-19. Local Windows validation, not an assertion of universal PDF compatibility or full Sioyek equivalence.

## Version 0.8.0 — Pipit Alpha 01

The full `npm run verify:alpha` pipeline passes: production TypeScript/Vite/Rust build, 71 reader/platform unit checks, 12 browser-detection cases, 16 extension-archive checks and 21 website-artifact checks. The three targets share 304 byte-identical assets. The new public-facing name/icon and package names are Pipit; existing storage keys and Firefox identity are deliberately retained. The pipeline is repeatable validation, not a claim of bit-for-bit deterministic PDF/ZIP generation.

Windows browser evidence totals **208 passing assertions**:

| Scenario | Assertions |
| --- | ---: |
| Chromium keyboard / research / guide | 15 / 33 / 23 |
| Chromium native extension / extension polish | 9 / 2 |
| Recoloring/preview polish / preview surfaces | 11 / 15 |
| Real research paper / document recovery / passwords | 8 / 9 / 3 |
| Worker race/reset behavior / GPU glyph edges / forced CPU glyph edges / saved preferences | 5 / 10 / 10 / 3 |
| Native Firefox 158 extension | 15 |
| Cloudflare Pages local runtime website | 37 |

Website tests use Wrangler's local Pages runtime, including actual CSP/header behavior, all three file downloads and checksum endpoints, a genuine 404, desktop/tablet/phone overflow down to 320px, keyboard-operated illustration, selected theme state, reduced-motion preference, and real WASM equation lookup in `/reader/`. Firefox/Safari/iPhone user-agent simulations test download advice only, not native Safari execution. Separate contexts verify no-JavaScript setup/downloads and graceful metadata-fetch failure. Landing page/local sample flows make no third-party requests; no JavaScript runtime errors are observed. Screenshots and raw logs are cached as `output/playwright/v080-*`.

Production and full dependency `npm audit` report zero known vulnerabilities at this check; this is not a security audit. Firefox web-ext lint reports zero errors/notices and 19 warnings (bundled dynamic HTML/import assignments and unsupported Android minimum metadata). Native Safari signing/testing, macOS/Linux execution, store approval, mobile support and broad PDF/performance qualification remain open. Cloudflare's local emulator is not a public HTTPS deployment; public URL verification waits for renewed account authentication.

## Version 0.7.0

Windows production build and 71 unit checks pass. The 18 added platform checks cover source validation (including opaque extension origins), browser-neutral tab closing, MIME/download policy, per-target manifests and mocked Safari toolbar/link handling. These Safari checks are not Safari runtime evidence.

Sixteen archive checks verify SHA-256 companions, required resources, valid WASM, version alignment, native backgrounds and 304 byte-identical shared assets. Firefox web-ext lint reports zero errors, zero notices and 19 warnings: 18 bundled dynamic HTML/import warnings and one Android compatibility warning. This is not store approval or a security audit.

An isolated, headless Firefox 158.0 profile temporarily installs the unsigned XPI and passes 15 checks: MIME redirect, full queries/page fragment, WASM preview under extension CSP, full-line preview fit, actual themed pixels, two-page layout, eight guide sections, local-file picker with a 14-page research paper, search, HTML exclusion, inline attachment with no Downloads file, explicit download, bypass and closing a disposable extension tab. The color backend reports webgl2, not proof of physical GPU acceleration. A separate native file URL probe stays in Firefox's built-in viewer; the adapter deliberately does not advertise file URL interception. Firefox initial-page restoration waits for scaled layout before jumping, fixing a native-browser page-fragment mismatch.

Chromium regression logs cover keyboard (15), research (33), guide (23), extension integration (9) and extension polish (2) assertions. Cached artifacts are under ignored `output/playwright/v070-*`; Firefox tooling/provenance stays under ignored `output/browser-tools`. Browser profiles are disposable. No user profile is modified.

Safari source packaging and adapter unit tests pass; Xcode compilation, signing, installation, native Safari rendering, shortcut delivery and performance remain untested. Automatic Safari MIME interception is not implemented. See [browser support](BROWSERS.md) for installation and explicit platform limits. No macOS/Linux, mobile or store-publication claim is made.

## Version 0.6.1

Production build, 53 unit checks, and 97 browser assertions pass. The six new shortcut-unit checks verify registered/unique leader actions, g 2, coverage of every non-theme command, eight guide sections, complete guide coverage, and shared dispatch/display metadata. Individual themes remain selectable by name through colon commands.

`scripts/verification/guide.js` passes 23 assertions: a four-column desktop map with all sections visible without internal scrolling at 1440×960, 75 entries, actual 87% background opacity and 28px blur, action/key filtering and empty state, three/two/one-column layouts, mobile overflow, real PDF.js spread toggling both ways, solid preference, recoloring and color-editor shortcuts, Vimium toggle/command-menu recovery, reset, destructive-clear confirmation, original PDF download, search reset, and notebook note/export keys. Remaining reruns: keyboard 15, research 33, polish 11, preview-surface 15. Screenshots are retained as v061-guide-desktop.png and v061-guide-phone.png under output/playwright. Clear-library confirmation is observed with a test stub returning false; test documents are not deleted. Reduced-transparency fallback is implemented in CSS but not separately emulated in this visual run. No claim of testing every OS/browser shortcut interception is made.

## Previous rendering validation

Version 0.6.0: production build and 47 unit checks passed (five Rust, 16 reference-map, eight extraction, ten continuous-palette, eight worker-queue). 187 browser assertions passed across fresh scenarios covering GPU and CPU text edges, flicker-free zoom, smart width, preview geometry/focus/zoom, Vimium key ownership, normal keyboard reading, real documents, research lookup, palette interpolation, resizable previews, spring dock, glass/settings, preferences, extension redirects, and closing a disposable extension tab with x. Per-scenario logs are retained under ignored output/playwright/v060-*.txt. The original broad dock scenario was also rerun; password validation below remains earlier evidence.

The polish scenario observes visible canvases frame-by-frame through six rapid zoom changes: no default-white exposed frames were found; themed cover frames were observed and all covers were released after settling. It verifies larger borderless/dimmed quick looks, no initial horizontal line clipping, rounded viewport geometry, focus containment, independent keyboard preview zoom, pinning, command access in Vimium mode, and reserved browser keys. Extension checks close a disposable viewer tab, never the user's real tab.

The CPU fallback is exercised by a test-only worker shim returning null for OffscreenCanvas WebGL2; results explicitly report backend cpu. Merely passing --disable-webgl did not disable worker WebGL2 in this Chromium build, so that preliminary run is not counted as fallback evidence. GPU-path results report webgl2, which may be software GL; physical acceleration is not established. A real installed Vimium build/custom mapping is not part of these tests: compatibility checks verify the application's event ownership, and extension isolation is a browser constraint. See README for per-site pass-key guidance.

The worker-queue tests cover lazy dispatch, coalescing before readback, one active job, transferable-buffer ownership, exact result pixels, cancellation, stale-canvas skipping, and error cleanup. Browser tests cover rapid theme changes, reset during pending work, new-document switching, recolored previews under extension CSP, and actual wheel scrolling without zoom changes. Pixel tests wait for asynchronous recoloring to settle rather than assuming a theme click finishes raster work synchronously.

Three before/after scroll runs and raw-log locations are documented in [PERFORMANCE.md](PERFORMANCE.md). They show lower UI-thread stall time on one cached real paper, not universal or cross-reader superiority.

The text fixture renders five ink colors at three font sizes through PDF.js. Grayscale canvas antialiasing avoids treating LCD subpixel fringes as document colors. Continuous mapping retains intermediate edge shades in dark/light themes and custom paper/ink replacements; restoring Paper reproduces the original pixels exactly. GPU theme/paper-only maximum fixture edge deviations are below 2/255; custom replacements stay below 6/255 with RMS below 2.5/255. Nearby near-neutral ink intentionally shares part of a custom black substitution. This replaces the earlier nearest-swatch/context-dependent test contract; it is bounded fixture evidence, not lossless reconstruction of every PDF or every scientific figure.

The dock checks sample intermediate widths, stable internal layout, interrupted expansion/contraction without snapping, icon proximity magnification, narrow-screen bounds, and reduced-motion behavior. Motion uses a continuous critically damped spring rather than discrete grid reflow.

## Evidence

- `npm run build`: TypeScript checks, optimized Rust WASM build, and Vite production bundle passed.
- `npm test`: five Rust tests passed for reference ranking/category filtering; `research-unit.mjs` passes 16 checks for numeric lists/ranges, bounded parsing, bibliography detection, duplicate definitions, backlinks, section boundaries, excerpts, and DOI/arXiv candidates; `text-lines-unit.mjs` passes eight checks for single/two-column extraction, equation lines, full-width bands, geometry bounds, and the cached real PDF. Without that optional fixture, the last extraction check is explicitly skipped.
- `scripts/verification/keyboard.js`: 15 assertions covering page navigation, history, bookmarks, marks, real text highlights, reference previews, equation jumps, themes, zoom, focus mode, embedded-link hints, preview links, and command-palette figure lookup.
- `scripts/verification/documents.js`: nine assertions covering smart reference hints, opening a real 14-page two-column research PDF, search, actual canvas background pixels, local recent library, invalid-PDF recovery, and compact controls. Rotation was exercised and captured, not compared to a reference raster.
- `scripts/verification/extension.js`: nine assertions in an isolated Chrome for Testing 156.0.8078.4 profile. Top-level PDF MIME redirects work without a filename suffix; query parameters and `#page=3` survive; Rust WASM works under extension CSP; HTML named `.pdf` remains HTML; attachment PDFs now open inline with zero download events. Explicit Download and URL download bypass still save files.
- `scripts/verification/password.js`: wrong-password retry, successful unlock, and cancellation recovery passed using an encrypted copy of the original demo.
- `scripts/verification/preferences.js`: two assertions passed for actual palette-replacement pixels and saved-page restoration when reopening a local PDF.
- `scripts/verification/glass.js`: nine checks cover safe HTTP(S) URL opening without a download, local Inter font loading, larger type, actual computed backdrop blur, solid-panel persistence, and settings/toolbar layout at 390px width. Paper, Sepia, and Night screenshots are retained under `output/playwright/glass-*`. System reduced-transparency is honored by CSS; the visual run uses normal transparency preferences.
- `scripts/verification/dock.js`: 24 checks cover full-window reading, visible compact dock with inert extra controls, mouse expansion and retreat, overlay geometry, keyboard sidebar/dock access, borderless command popup, colon commands and numeric page jumps, wheel-only scrollbar timing, 23 themes and brightness filters, theme persistence, command-driven selection, and a 390px dock.
- `scripts/verification/research.js`: 33 checks cover compact/expanded dock behavior and easing, real Ctrl+wheel without browser zoom, floating quick looks without a main-view resize/scroll, cycling results, pin/unpin, Enter jumps and return history, right/middle-click and selected-text lookup, graph counts and backlinks, searchable contents, next section/equation, passage capture, Markdown download, note persistence and return jumps, and 390px controls/previews.
- `scripts/verification/research-paper.js`: eight integration checks cover all 19 TraceMonkey bibliography labels, author filtering, graph keyboard focus, original-page preview, zero external requests during local graph use, Capture through the command palette, and notebook isolation between documents. Two unmatched numeric markers from the paper remain explicitly unresolved; these may be code/math, not citations.
- `scripts/verification/preview-surface.js`: 15 checks verify centered/live app proportions in landscape and portrait, a minimal two-button header, full-line width with zoom capped at 95% of the main document, unchanged main scroll/geometry, draggable and keyboard-adjustable side widths, persistence and bounds, unpinning, and the more transparent continuously blurred spring dock. Screenshots include `v05-centered-preview.png` and `v05-portrait-preview.png`.
- `scripts/verification/palette-colors.js`: eight checks sample actual rendered PDF canvas pixels: original RGB swatches, terminal-palette membership, distinct red/green/blue outputs, exact light/dark neutral endpoints, explicit replacement priority, recoloring-off behavior, and reset. Generate its original fixture first with `node scripts/verification/palette-fixture.mjs`. A screenshot is retained as `v05-palette-dark.png`.
- `scripts/verification/color-palette-unit.mjs`: ten checks cover palette snapshots, neutral endpoints, alpha/original-pixel preservation, source-color independence from surrounding content, bounded source ramps, interpolated distinct hues, custom endpoint/coverage behavior, and storage APIs. The optional `--verify-upstream` compares all 320 terminal ANSI slots; `--benchmark` measures only a bounded Node pixel loop, not PDF rendering or browser responsiveness. Earlier measured raw records/provenance are retained in that script; no end-to-end performance claim follows from them.
- Screenshots are retained locally in `output/playwright/`. Images are visually inspected; they are not a pixel-diff test suite. An invalid-file fixture deliberately triggers PDF.js's malformed-PDF warning.

Fixtures: the project's original generated six-page field guide, and Mozilla PDF.js's [TraceMonkey research-paper example](https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf). The latter is cached under ignored `output/playwright/fixtures/tracemonkey.pdf`, not included in the app or committed. Column extraction finds all 19 bibliography labels, compared with 13 before the extraction fix. This verifies labels on this fixture, not semantic correctness of every match or universal reading order.

## Repeat browser checks

The scripts are Playwright CLI `run-code` functions, not Playwright Test specs. Start `npm run preview` separately. Install browser tooling as needed:

```sh
npx playwright install chromium
npx --yes --package @playwright/cli playwright-cli -s=paperterm open "http://127.0.0.1:4173/?demo=1#page=1"
npx --yes --package @playwright/cli playwright-cli -s=paperterm resize 1440 960
npx --yes --package @playwright/cli playwright-cli -s=paperterm snapshot
npx --yes --package @playwright/cli playwright-cli -s=paperterm run-code --filename scripts/verification/keyboard.js
npx --yes --package @playwright/cli playwright-cli -s=paperterm run-code --filename scripts/verification/documents.js
```

Create `output/playwright/fixtures/` and download the linked research PDF there before the documents scenario. Run keyboard then documents in that order; the first starts from page 1 of the demo. Screenshots and profiles remain under ignored output paths.

For the password scenario, generate an encrypted copy of `dist/sample.pdf` named `output/playwright/fixtures/encrypted.pdf`, with user password `paperterm-test`. The local run used pypdf in an isolated, ignored test-only Python environment. Python is not required by the app or ordinary build. Run the scenario with the same CLI `run-code --filename scripts/verification/password.js` command.

Run `scripts/verification/preferences.js` after the other web scenarios. It uses the generated demo and cached research PDF, exercises palette mapping and document switching, and resets theme settings to Paper afterward.

Then run `scripts/verification/glass.js` to exercise the URL opener, font, frosted/solid settings, theme screenshots, and compact layout. This scenario expects the normal (not reduced-transparency) OS setting when asserting blur.

Run `scripts/verification/dock.js`, then `research.js`, then `research-paper.js` in the web session. The latter scenarios load their own demo/real fixtures and clean up the notes they create. Version 0.4.0 result logs are cached as `output/playwright/v04-*-results.txt`. Screenshots include `research-dock-compact.png`, `research-dock-expanded.png`, `research-quick-look.png`, `research-paper-graph.png`, `research-notebook.png`, and `research-compact-preview.png`. The exported notebook is cached as `research-notebook.md`. Extra dock tools are intentionally inert until expanded; the compact dock remains accessible.

For v0.5, also run `preview-surface.js` and `palette-colors.js`. Current results are cached as `output/playwright/v05-*-results.txt`, with unit output in `v05-unit-results.txt`. The color fixture is a one-page original PDF, with no text/indexing requirements. Preview commands replace the former footer buttons. Source passages remain scrollable at the main document scale, so zoomed pages may require horizontal panning rather than shrinking the text.

For extension verification, use an **isolated** Chrome for Testing profile, never an everyday profile. Load `dist/` with `--disable-extensions-except=<absolute-dist>` and `--load-extension=<absolute-dist>`, and remove Playwright's default `--disable-extensions` argument. The local test config explicitly selects the installed Chrome for Testing executable. System-branded Chrome can reject command-line unpacked-extension loading. Consult `playwright-cli --help` for its `--config` schema.

Use a fresh isolated profile or explicitly reload the extension after changing its background worker. Reusing a command-line-loaded profile can retain old dynamic rules even while the manifest reports the new version. The 0.5.0 extension checks used a fresh isolated profile. Generated CSS was also checked in the browser: a redundant hand-written WebKit prefix caused the optimizer to drop standard backdrop blur; keeping the standard declaration lets the build handle prefixes correctly.

Run `node scripts/verification/fixture-server.mjs` separately (port 4180), then run `scripts/verification/extension.js` in the extension-enabled CLI session. The test server serves only public/generated fixtures. Stop it after verification. The default web preview remains on port 4173.

## Known coverage limits

macOS/Linux execution, screen-reader behavior, all keyboard layouts, enterprise Chrome policies, remote authentication edge cases, and production-scale documents are unverified. Local file-URL interception needs the user-controlled extension permission; file-picker opening is tested. No benchmark claims are made. Reference matching is heuristic and does not establish semantic correctness. Review actual source pages, especially for multi-column documents and nonstandard bibliography formats.

The graph is local to one document and indexes positive numeric square-bracket markers. Author–year citations, superscripts, split-line groups, and scanned text are unsupported. Array indices can look like citations. Complex columns, tables, image-only full-width figures, RTL and rotated text can still disrupt reading order. Rendering remains PDF.js; the extraction adjustment affects lookup order, not page pixels. Notes are browser-local and do not embed PDF annotations or sync across devices. Palette quantization approximates colors and saturation, including images; retain original rendering when color information matters.

The browser cannot provide desktop/window transparency. Normal content colors, custom recoloring, and replacement palettes are separate from OS compositor features.
