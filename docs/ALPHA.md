# Pipit Alpha 04 — release dashboard

## 0.11.7 Pipit editing workspace — 28 October 2026

Published to the public [Pipit GitHub repository](https://github.com/ArnabCodes/pipit) and [Pipit website](https://pipit-reader.pages.dev/). Chromium, Firefox, and Safari-target packages are rebuilt with Pipit branding and published checksums. Page thumbnails support selection, reorder, rotate, delete, bounded undo, PDF/image insertion, and cross-document page copy/paste. The Commands and dock surfaces include text/signature stamps, PDF form fill/save-copy, and timestamped edit history. Vim-style Visual selection copies text and creates sidecar highlights/notes; annotations stay separate from the original PDF. Page changes save to a new copy. Embedded text rewriting and certificate-backed digital signatures are unsupported.

Existing local preferences, reading positions, bookmarks, notebooks, Visual settings, edit history, and recent PDF copies migrate into Pipit-named browser storage. Firefox uses the renamed Pipit development add-on ID; remove and reload an older temporary XPI when upgrading. Overleaf-originated PDF tabs remain with Overleaf for SyncTeX. Ctrl/Cmd+P opens the browser’s native PDF viewer, and `g Z` hands a remote source to Zotero. The website and download packages were rebuilt and live checks passed; native Safari execution remains unverified. No browser store submission is included.

## 0.11.6 Flight School — 27 October 2026

Published to https://pipit-reader.pages.dev/ and https://ca2a5f55.pipit-reader.pages.dev/. Manifest: `docs/releases/0.11.6-alpha.4.json`. Lesson 6 recognizes valid modifier-tolerant key sequences and verifies the restored scroll position instead of PDF.js's active-page heuristic. An Advanced course and shuffled Feather Relay have separate progress. Chromium and WebKit completed both routes locally and live; real Vimium history, Chromium extension, 39 Firefox development extension checks and 41 public download checks passed. Native Safari and other keyboard extensions remain untested. No Git push or store submission.

## 0.11.5 history and lesson six — 27 October 2026

Published to https://pipit-reader.pages.dev/ and https://7d5a5bf1.pipit-reader.pages.dev/. Manifest: `docs/releases/0.11.5-alpha.4.json`. Back/forward use g h/g l or Backspace/Shift Backspace; prior Alt arrows remain. The tutorial restores its missing preview when resumed or selected, handles follow/return through pane reflow and permits replay without duplicate XP. Its revised PDF retains its first document ID and existing notes. Local/live Chromium and WebKit, real Vimium, Chromium extension, 37 Firefox development extension checks, full alpha gate and 41 public download checks passed. Native Safari remains untested. No GitHub push or store submission.

## 0.11.2 keyboard compatibility — 27 October 2026

Published to https://pipit-reader.pages.dev/ and https://9a426075.pipit-reader.pages.dev/. Manifest: `docs/releases/0.11.2-alpha.4.json`. Full alpha gate and 41 independent public checks pass; complete live course passes in Chromium, WebKit and Chromium with Vimium. Surfingkeys needs its site toggle; safe pause and the complete course after recovery pass locally. Firefox temporary extension passes 36 checks. Safari is source-only; native Safari was not tested. No GitHub push or store submission.

## Flight School reliability and arcade design — 27 October 2026

Published 0.11.1 at https://debffe7d.pipit-reader.pages.dev/ and production. Manifest: `docs/releases/0.11.1-alpha.4.json`. No Git commit/push, GitHub release upload or store submission for this patch.

Reproduced the opening dead path: Enter on the old default radio option did not start play. The input path also rejected forwarded KeyboardEvents and relied on delayed PDF layout/global focus without direct feedback. The new focused Play button starts with Enter; continuous scroll/layout is prepared first, movement is handled at window capture with explicit scroll outcomes, and forwarded events are accepted. Main reader hotkeys also tolerate a window event target. A realistic beginner test pauses over two seconds between g and d; training prefixes now wait instead of expiring. Level changes and pause clear stale prefixes. Mouse/gesture blocking and actual-outcome requirements remain intact.

Design reference: https://codex-resets.com/tibo-28, visually inspected for its warm dark/cream palette, orange/gold/green accents, outlined cards, offset shadows, chunky type and progress tiles. Original SVG bird/platform/feather art and CSS motion were authored locally; no reference-site artwork was copied. Flight School has a short Play screen, eleven collectible-feather levels, lit keycaps, XP, progressive walkthroughs, inline modal hints and a friendly pause/resume screen. Guided and Practice runs use v3 storage; old records, notes and bookmarks remain untouched. Reduced motion is respected. The LaTeX paper was recompiled twice and remains six pages; changed page 1 was visually inspected.

Validation: full verify:alpha gate passes. Full eleven-level course / 300 XP passes locally and on production using Enter progression, inline notebook guidance, a delayed key sequence, separate practice, pointer blockade, colors, quote capture and emergency recovery. A new four-viewport regression (1280×720, 1920×1080, 2560×1600, 1024×600) sends j immediately after the panel becomes ready, without focus repair or screenshot delays. It verifies actual down/up scrolling, live game feedback, coach focus, forwarded window events, Vimium preference, pause/resume and manual hard-mode release. Chromium extension opening regressions plus course launch/movement pass. Firefox 158 passes 36 extension checks, including native Enter start/next, actual j/k and page navigation, Esc pause and Enter resume. Safari source parity is checked; macOS runtime remains untested.

The supplied game client completed j/k and observed 20 XP. Its ignored local copy has j/k aliases, skips hidden canvases, and waits for game readiness before actions. Desktop/mobile screenshots, intro, won-feather and pause states were visually inspected. Website/docs launch and social previews pass; 41 independent public package/size/SHA-256 checks pass. Evidence: output/playwright/arcade-*, output/playwright/arcade/, output/playwright/v0111-public-downloads.json. Source changes remain local.

## Keyboard-first learning and hard mode — 27 October 2026

Published 0.11.0 / Alpha 04, deployment https://780861a1.pipit-reader.pages.dev/ and production alias. Manifest: `docs/releases/0.11.0-alpha.4.json`. Source changes remain local; no Git commit/push, GitHub release or store submission was performed for this update.

The keyboard audit added preview/document focus commands, searchable anchored text-line capture, typed hex background/foreground and palette mappings, and Scholar queries without selection. The tutor now has 9 core lessons plus 2 optional challenges / 300 XP. Learn shows numbered steps with no assumed Vim knowledge. Practice initially hides steps and keeps separate progress in `pipit.tutor.v2`; old records remain untouched. Keyboard sequences and actual outcomes are both required for credit. A GUI action alone cannot earn points. Guided lessons enter hard mode automatically; manual `:HardMode` works on ordinary PDFs. Mouse, hover, wheel, touch, context menus and drag are blocked inside the page; native keyboard/assistive activation remains usable. Ctrl Shift F12 exits and pauses even in a modal. Reload recovers normal input. Browser chrome, OS shortcuts and system dialogs remain outside the policy.

Validation: full `npm run verify:alpha` passes, including tutorial state/shortcut tests, 16 archive parity checks over 305 shared files, documentation/public-copy and site artifact checks. The full 11-lesson course completes through trusted key events, both locally and on production. Regression checks cover independent modes, saved 300 XP, hidden practice steps, native keyboard buttons under hard mode, pointer/wheel/drag/touch/context-menu blockade, no shortcut credit for a GUI path, quote capture, typed colors/mappings, dialog escape and reload recovery. No page errors observed. Chromium extension passes its 9 PDF interception/download regressions plus keyboard lessons, hard mode and exit. Firefox 158 passes 34 extension checks including guided steps, hard mode, actual j/k movement and p navigation, research search, notebook round trip and real OpenAlex expansion. Final small content/layout adjustments were rechecked in Chromium; Firefox runtime evidence predates those presentation-only edits.

All changed LaTeX pages and desktop/mobile screenshots were visually reviewed; PDF remains six pages and equation (2) remains on page 3. The supplied game client ran successfully; its ignored local copy skips hidden canvases so the closed preview canvas cannot stall screenshot capture. Live website/docs launch passes at 1440/768/390px; social preview checks remain valid. All three public packages passed 41 HTTPS/size/SHA-256 checks. Hosted tutor PDF independently matches `tutorial/build.json`. Evidence: `output/playwright/keyboard-tutor-*`, `output/playwright/keyboard-tutor/`, `output/playwright/v0110-public-downloads.json`. Safari source parity is checked, but runtime testing remains unavailable on this Windows host.

## Branding patch — 26 October 2026

Version 0.10.1, deployment https://fefe40fe.pipit-reader.pages.dev/, removes obsolete migration FAQ/release copy and updates documentation, font/icon notices and package installation instructions to Pipit. Existing storage keys, Firefox identity and download-bypass compatibility remain internal and stable. Public copy audit now rejects the obsolete product name. Full release validation, six-page social metadata/image checks and 41 public download/hash checks pass. Bird-icon social previews from deployment afe271dc remain intact. Source changes are local; this patch did not create a Git commit or push.

## Pipit Tutor — 26 October 2026

Published 0.10.0 / Alpha 03 at https://6fa3c407.pipit-reader.pages.dev/ and the production alias. Manifest: `docs/releases/0.10.0-alpha.3.json`. Arnab subsequently authorized committing and pushing the current source to the private GitHub repository. GitHub release uploads and store submissions remain outside this update.

The six-page, two-column pdfLaTeX paper includes selectable text, links, numbered equations, a vector figure and a table. Observations are explicitly synthetic teaching data. Source and hashes: `tutorial/`. `:Tutor`, the welcome button and website open the guided route. Ten real-action missions award 300 XP and four badges, with hints, skips, pause/resume, revisits and confirmed reset. Reset retains notes/bookmarks. Desktop reserves a coach margin; mobile uses a scrollable compact coach. Existing unguided sample remains compatible.

Validation: full `npm run verify:alpha` passed, including 37 tutor checks, 16 archive checks across 305 shared files, 12 detection and 24 site artifact checks. Chromium completes all ten missions and 300 XP, then verifies persistence, reset with notes retained, no awards for reopening existing notes, skips and hints. Chromium extension passes 9 interception/download regressions plus Tutor launch, bundled PDF and real XP. Firefox 158 passes 33 extension checks including Tutor under CSP, navigation XP, research search, previews, notebook round trip and OpenAlex. Tests now wait for complete Firefox backup downloads and Chromium PDF handoff.

All six PDF pages and desktop/mobile coach and website screenshots visually inspected; supplied develop-web-game client ran successfully. Native editor compilation did not return; installed pdfLaTeX compiled the actual deliverable twice and Poppler verified it. Safari runtime was unavailable on Windows: source parity is packaged and checked, with source-only/manual-open limits retained.

Production: 41 independent HTTPS/package/SHA-256 checks passed; live Tutor and documentation verified at 1440/768/390px. Hosted `/reader/tutor.pdf` separately matches the local receipt: 346,579 bytes, SHA-256 `20963bf2fc2f2ea29717bf6a1cbcb2e9ca903a5925bc85fac1a1cd132ff73d86`. Evidence: `output/playwright/tutor-*`, `output/playwright/tutor/`, `output/playwright/v0100-public-downloads.json` and `output/tutor-latex/`.

## Public-copy audit and dual-input demos — 26 October 2026

Published website-only deployment https://9f227963.pipit-reader.pages.dev/. Removed the browser-caret troubleshooting entry, the one-off ScienceDirect verification report, private-repository references and build/test commentary from customer-facing copy. Retained actionable product limits: unsigned/source-only installation, folder grants, OCR dependence, separate notebook sidecars and publisher access. The public-copy audit checks all five HTML pages and three text-bearing scripts locally and over HTTPS; internal investigation notes stay in this private repository, not the generated user guide.

Consolidated the duplicate feature-card mini-demos into the main four-scene showcase. Cards now link to the corresponding scene. Each scene has Mouse and Keyboard controls, a simulated click pointer and a top-right key display. The tour shows mouse interaction followed by its keyboard counterpart; actual F/hint, j/k, colon, g d and graph arrow/Enter input works inside the emulated screen. Space/Enter are distinguished, and keys outside the demo are not captured or stored. Pause, offscreen/hidden-tab cancellation and reduced-motion behavior remain supported.

Validation: 36 new dual-input checks pass locally and on production at 320–1440px; 16 docs checks pass locally and on production. Existing website/showcase/feature checks pass 37/26/17, with 12 detection and 24 site artifact checks plus documentation build checks. Public copy audit passes for eight resources, and all three unchanged extension archives pass 41 independent HTTPS/hash checks. Desktop/phone screenshots and mouse/keyboard states were visually reviewed. Evidence: `output/playwright/dual-input-*`.

## Public user documentation — 26 October 2026

Published at https://pipit-reader.pages.dev/docs/ through website-only deployment a6e6450b. Homepage header/footer link to ten searchable topics: getting started, installation/updates, navigation/search, reference lens/split view, appearance, notes/export, local files, citations/publisher access, keyboard guide and troubleshooting. The eight keyboard groups are built from reader command literals and the shared help generator, including leader bindings and context labels. The guide requires no backend or network search; every topic remains readable without JavaScript. Browser-specific installation and privacy/access limits are explicit.

Docs build checks, 12 detection and 24 site artifact checks pass. Sixteen docs browser checks pass locally and on production across 320–1440px, including search, empty/reset states, section links and no-JavaScript fallback. Existing website regression checks pass 37, including actual downloads and the hosted-reader equation preview. All three unchanged extension archives pass 41 public HTTPS/hash checks. Desktop and native-width mobile docs screenshots were reviewed. Evidence: `output/playwright/docs-*`.

## Feature-focused website copy — 26 October 2026

Published at https://9e5e3216.pipit-reader.pages.dev/ with the existing production alias. Replaced slogan-led copy with a clear research-PDF product description, descriptive interactive-demo labels and eight feature groups: reference previews, themes, keyboard/history, notebook export, split views, citation networks, local folder browsing and local processing. Added actual shortcuts and explicit coverage/access/annotation limitations. Corrected the obsolete FAQ statement denying cross-paper graphs; metadata and supporting-page titles now describe their contents. The decorative reading dock is hidden in the graph illustration so it does not cover the selected-node description. Extension packages are unchanged.

Seventeen feature-copy checks pass locally and on production across 320–1440px. Existing website/showcase/cursor checks pass 37/26/14; detection/artifact checks pass 12/24. All three public downloads retain their release-manifest SHA-256 values; 41 public HTTPS checks pass. Desktop, phone, and all four demo scenes were visually reviewed. Evidence: `output/playwright/feature-copy-*`.

## Website-builder polish — 26 October 2026

Applied the Sites skill's implementation, local-preview and visual-QA workflow to the existing checkout, preserving Cloudflare hosting rather than registering a duplicate Site. Website-only deployment: https://7b8efa62.pipit-reader.pages.dev/. Added explicit static/default and interactive/text-input cursor behavior, transparent insertion-caret inheritance for non-input content, restored visible carets for real inputs, clearer hover/focus states, larger checksum/footer copy, and a properly hidden-until-focused skip link. Text selection remains enabled. Extension archives and reader code are unchanged.

No `contenteditable` or design-mode editing was found on ordinary copy. Browser caret-browsing navigation is distinct from a site's insertion caret and cannot be claimed fixed by CSS; if a caret still appears throughout the page, Chrome's F7 / Accessibility → Navigate pages with a text cursor setting is the relevant user-controlled option. No browser-wide accessibility setting or keyboard navigation was disabled.

Validation: 14 targeted checks pass locally and on production, including real command input, selection, skip link, keyboard focus and 320–1440px overflow checks. Existing site/showcase checks pass 37/26, detection/artifact checks 12/24, and production download/hash checks 41. Desktop full-page and native-width phone screenshots were visually reviewed. Evidence: `output/playwright/site-polish-*`.

## Browser-mark visual pass — 26 October 2026

Published website-only update: https://d532f765.pipit-reader.pages.dev/ (production alias unchanged). Replaced Unicode browser placeholders with unmodified vendor Chrome/Firefox SVGs and Apple's Safari PNG, self-hosted in matching 40px boxes. Sources/trademark attribution: `site/assets/BROWSER-MARKS.md` and the public credits page. Extension packages and their Alpha 02 checksums are unchanged.

Inspected full desktop/mobile screenshots and the desktop download section. The focused browser flow passes 19 checks at 1440, 1024, 768, 390 and 320px, including loaded artwork, opacity, alignment, overflow and keyboard order; repeated successfully on production. Existing site and interactive-showcase flows pass 37 and 26 checks; detection and site artifact checks pass 12 and 24 checks. All three public downloads independently pass the existing 41 HTTPS/hash/archive checks. Evidence: `output/playwright/browser-marks-*`.

## Current publication — 22 October 2026

Pipit **0.9.0 / Alpha 02** is published at https://pipit-reader.pages.dev/ after Arnab authorized updating the website and its extension downloads. Production deployment: https://f0ffad11.pipit-reader.pages.dev/. Download identities and SHA-256 values are recorded in `docs/releases/0.9.0-alpha.2.json`. Chromium is an unpacked ZIP; Firefox is unsigned/temporary; Safari is a source payload, not a signed installer. GitHub remains private and its existing prerelease was not changed. No commit, push or store submission was performed.

Release validation: 108 unit checks, 16 archive checks, 12 browser-detection cases and 21 site artifact checks; native Chromium interception 9, native Firefox 158 reader/extension 30, publisher-discovery Chromium 13 (controlled publisher responses), local-files Chromium 13, local website 37 and showcase 26 checks. Production independently passed 41 anonymous HTTPS checks and 37 browser checks, including all three actual downloads, checksum companions, archive contents, security headers, private-path exclusions and hosted-reader WASM equation preview. Logs and snapshots: `output/playwright/v090-*`. Real institutional access to the reported ScienceDirect article and native Safari remain unverified.

Recheck the exact published artifacts without rebuilding:

```sh
node scripts/verification/public-downloads.mjs https://pipit-reader.pages.dev docs/releases/0.9.0-alpha.2.json
```

## Historical Alpha 01 record

Version: 0.8.0. GitHub release tag: `v0.8.0-alpha.1`. This is an experimental desktop-browser reader, not production certification or full Sioyek parity.

## Release gates

- Repeatable local validation pipeline: `npm ci && npm run verify:alpha` (not bit-for-bit deterministic PDF/ZIP generation).
- Browser checks use isolated Chromium and Firefox profiles, not the user's profile. Cached evidence is retained under ignored `output/playwright/v080-*`.
- Three versioned packages and SHA-256 companions. Website metadata is generated from their actual bytes and fails on stale versions/checksums.
- Chromium and Firefox execute the same frontend, worker and WASM assets. Safari remains source-only and runtime-untested.
- No analytics scripts or document uploads. Landing-page detection is local, advisory, and never hides other targets. Downloads/setup work without JavaScript.
- New icon sizes are rendered from the SVG source. Pip's raster artwork is checked into `site/assets/pip.png`; only compositor-friendly decorative CSS motion is used, with reduced-motion support.
- Name choice is not a legal trademark clearance. Existing local storage keys, Rust crate name, Firefox add-on ID, and legacy download bypass are retained for upgrade compatibility. New `pipit-download=1` also bypasses interception.

## Website build and Cloudflare deployment

The `cloudflare`, `cloudflare-deploy`, and `wrangler` skills guided a static Cloudflare Pages Direct Upload site. It has no Functions/backend, external CDN assets, account database, or application telemetry. Hosting still exposes ordinary connection information to Cloudflare. Site and reader use separate CSPs; downloads are served as attachments. Only generated distributables and the intentional web reader are published, not the private Git checkout or cached test documents.

```sh
npm run verify:alpha
npx wrangler pages dev site-dist --ip 127.0.0.1 --port 4181
```

Before publishing, authenticate interactively with `npx wrangler login`, then verify `npx wrangler whoami`. If the project does not yet exist, create it once:

```sh
npx wrangler pages project create pipit-reader --production-branch=main
npm run site:deploy
```

Confirm the returned production URL, fetch all three packages and compare hashes to `site-dist/release.json`, verify security/download headers and 404 handling, and exercise `/reader/?demo=1` over HTTPS before calling deployment complete. No custom domain, paid resource, store submission, or signing is part of this release.

**Live:** https://pipit-reader.pages.dev/ — production deployment `8a806a54-ccb1-4352-9190-a9b08e190056`, published on 2026-10-19 after Arnab approved device authorization from his Mac. Scoped Pages OAuth was sufficient; broader Worker/AI permissions were not added. Initial project creation required Wrangler's `--force` fallback to avoid unsupported Workers delegation; subsequent commands target the existing Pages project normally.

All three public package downloads and their checksum companions match `docs/releases/0.8.0-alpha.1.json`. Anonymous HTTPS verification passes 41 checks, including correct ZIP/XPI contents, valid WASM, attachment headers, separate site/reader CSPs, 404 behavior, and no exposed Git/env/extension manifest. Cache: `output/playwright/v080-public-downloads.json`. Repeat without rebuilding or changing the published packages:

```sh
node scripts/verification/public-downloads.mjs https://pipit-reader.pages.dev
```

## GitHub

The repository stays private. Alpha 01 was published as a private prerelease at tag `v0.8.0-alpha.1`, commit `6381798`; all three downloaded GitHub artifacts were independently checked against release manifest hashes. Public downloads are served from Cloudflare.

## Known alpha gaps

Safari signing/Xcode compilation/native testing; macOS/Linux browser verification; Firefox permanent signing; mobile extensions; very large/complex PDFs, CJK/RTL and enterprise authentication. Search/reference resolution needs text; there is no built-in OCR. Citation graphs are within-document numeric heuristics. Themes recolor figures; disable recoloring for color-critical work. Export notes before changing origin/profile/extension identity. Broad API compatibility is not measured speed or stability parity with every browser.

## References

- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Safari extension packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
