# Validation record

Date: 2026-10-19. Local Windows validation, not an assertion of universal PDF compatibility or full Sioyek equivalence.

## Evidence

- `npm run build`: TypeScript checks, optimized Rust WASM build, and Vite production bundle passed.
- `npm test`: five Rust tests passed: exact equation ranking, Unicode author search, category filtering, figure labels, and exact figure numbers over partial matches.
- `scripts/verification/keyboard.js`: 15 assertions covering page navigation, history, bookmarks, marks, real text highlights, reference previews, equation jumps, themes, zoom, focus mode, embedded-link hints, preview links, and command-palette figure lookup.
- `scripts/verification/documents.js`: nine assertions covering smart reference hints, opening a real 14-page two-column research PDF, search, actual canvas background pixels, local recent library, invalid-PDF recovery, and compact controls. Rotation was exercised and captured, not compared to a reference raster.
- `scripts/verification/extension.js`: six assertions in an isolated Chrome for Testing 156.0.8078.4 profile. Top-level PDF MIME redirects work without a filename suffix; query parameters and `#page=3` survive; Rust WASM works under extension CSP; HTML named `.pdf` remains HTML; attachment responses remain downloads.
- `scripts/verification/password.js`: wrong-password retry, successful unlock, and cancellation recovery passed using an encrypted copy of the original demo.
- `scripts/verification/preferences.js`: two assertions passed for actual palette-replacement pixels and saved-page restoration when reopening a local PDF. Total: 35 browser checks, plus five Rust unit tests.
- Screenshots are retained locally in `output/playwright/`. Images are visually inspected; they are not a pixel-diff test suite. An invalid-file fixture deliberately triggers PDF.js's malformed-PDF warning.

Fixtures: the project's original generated six-page field guide, and Mozilla PDF.js's [TraceMonkey research-paper example](https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf). The latter is cached under ignored `output/playwright/fixtures/tracemonkey.pdf`, not included in the app or committed. Its search behavior was tested, not the correctness of every equation/citation match.

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

For extension verification, use an **isolated** Chrome for Testing profile, never an everyday profile. Load `dist/` with `--disable-extensions-except=<absolute-dist>` and `--load-extension=<absolute-dist>`, and remove Playwright's default `--disable-extensions` argument. The local test config explicitly selects the installed Chrome for Testing executable. System-branded Chrome can reject command-line unpacked-extension loading. Consult `playwright-cli --help` for its `--config` schema.

Run `node scripts/verification/fixture-server.mjs` separately (port 4180), then run `scripts/verification/extension.js` in the extension-enabled CLI session. The test server serves only public/generated fixtures. Stop it after verification. The default web preview remains on port 4173.

## Known coverage limits

macOS/Linux execution, screen-reader behavior, all keyboard layouts, enterprise Chrome policies, remote authentication edge cases, and production-scale documents are unverified. Local file-URL interception needs the user-controlled extension permission; file-picker opening is tested. No benchmark claims are made. Reference matching is heuristic and does not establish semantic correctness. Review actual source pages, especially for multi-column documents and nonstandard bibliography formats.

The browser cannot provide desktop/window transparency. Normal content colors, custom recoloring, and replacement palettes are separate from OS compositor features.
