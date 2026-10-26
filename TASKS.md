# Pipit resumption dashboard

Updated: 2026-10-26. Direction: minimal browser-first PDF workspace. Repository stays private. 0.10.0 Alpha 03 is live on Cloudflare. Arnab subsequently authorized committing and pushing the current source to GitHub main. No GitHub release upload or store submission is included.

| State | Task | Owner | Evidence / next step |
| --- | --- | --- | --- |
| Published | Gamified LaTeX tutor and website integration | Codex / Arnab | `:Tutor`, six-page paper, 10 missions / 300 XP, badges and local resume. Full Chromium journey and packaged Chromium/Firefox Tutor checks pass. 41 public download checks and direct PDF SHA-256. Deployment 6fa3c407; docs/TUTOR.md and docs/ALPHA.md |
| Published | Customer-copy audit and mouse/keyboard demos | Codex / Arnab | Removed non-product troubleshooting and one-off development reports; consolidated all interactive demos with Mouse/Keyboard controls and corner keys. Deployment 9f227963; 36 live interaction, 16 docs and 41 public download checks |
| Published | Searchable user documentation | Codex / Arnab | /docs/: 10 topics, 8 generated keyboard sections, local search, mobile layout and no-JavaScript reading. 16 live browser and 41 public download checks; deployment a6e6450b |
| Published | Clear feature explanations instead of slogans | Codex / Arnab | Eight feature groups, shortcuts, current FAQ and explicit limitations. Website-only deployment 9e5e3216; 17 live feature-copy and 41 public download checks |
| Published | Website-builder polish and text-cursor audit | Codex / Arnab | Sites workflow on existing Cloudflare checkout; pointer/input-caret distinctions, selection retained, hover/focus/readability/skip-link refinements. 14 live targeted and 41 download checks; deployment 7b8efa62. Browser F7 caret-browsing remains user-controlled |
| Published | Original browser icons and visual reinspection | Codex / Arnab | 26 October 2026: vendor Chrome/Firefox/Safari artwork, aligned 40px boxes, five viewport widths, 19 live icon/layout checks and 41 public download checks. Website-only deployment d532f765; extension packages unchanged |
| Published | Publisher and institutional PDF discovery | Codex / Arnab | Selected-paper DOI/landing-page lookup, subscriber metadata, toolbar handoff and access recovery. Real ScienceDirect challenge remains unverified |
| Published | Keyboard-first internal file browser | Codex / Arnab | Local-first three columns, Downloads/Documents picker locations, remembered Chromium handle and explicit permission recovery; 13 release browser checks |
| Published | Two-sided dock, reference lens, citation explorer and notebook portability | Codex / Arnab | Included in 0.9.0 Alpha 02; historical feature audits retain their original local-review evidence |
| Published | Feature-first website and 0.9.0 packages | Codex / Arnab | Cloudflare deployment f0ffad11; 41 public HTTPS checks, 37 public browser checks, all three package hashes verified. See docs/ALPHA.md |
| Done | Replace terminal implementation with web reader | Codex | PDF.js rendering and TypeScript UI; no Python runtime dependency |
| Done | Rust WASM reference lookup | Codex | Five Rust unit tests; browser equation, citation, figure and smart-hint checks |
| Done | Chrome default-viewer integration | Codex | Isolated Chromium profile: MIME redirect, query/hash preservation, inline attachment PDFs, explicit downloads, HTML exclusion |
| Done | Keyboard reading tools and themes | Codex | Keyboard, document, and pixel-level recoloring checks; see validation report |
| Done | Build/package workflow | Codex | Version 0.7.0: Chromium ZIP, unsigned Firefox development XPI, Safari source ZIP and SHA-256 files; 304 byte-identical shared assets |
| Done | Native Firefox adapter and shared platform boundary | Codex | Firefox 158 on Windows: 15 browser checks, MIME redirects, inline attachments, local picker, previews/WASM, themes, search, spreads and tab closing |
| Source ready | Safari adapter and macOS packaging helper | Codex | Explicit toolbar/link opening; no automatic MIME interception. See docs/BROWSERS.md |
| Open | Sign and test Safari on macOS | Joint | Generate native project on Mac, select signing team, validate permissions, rendering, keyboard and PDF opening in actual Safari |
| Open | Firefox release signing and broader OS coverage | Joint | XPI is unsigned and temporary-install only; store submission requires separate authorization |
| Accepted initial version | Try representative personal papers | Arnab | User reports it works as expected; retain edge-case testing below |
| Done | Inline PDF opening and glass UX pass | Codex | Version 0.2.1: inline attachment PDFs, URL opener, larger local typography, frosted/solid panels, new SVG/PNG identity |
| Done | Edge-revealed reading workspace and terminal themes | Codex | Version 0.3.0: floating dock, collapsible glass sidebar, borderless selection, colon command menu, 20 additional themes, wheel-only scrollbars; 24 additional browser checks |
| Done | Compact dock and research reading tools | Codex | Version 0.4.0: expanding dock, PDF-only Ctrl+wheel, floating/pinned quick looks, smart mouse/selection jumps, local citation graph/backlinks, notebook/Markdown, section/equation navigation, Lucide icons; see validation |
| Done | Proportional previews, resizing, and palette colors | Codex | Version 0.5.0: minimal centered previews at 95% document zoom, live app proportions, drag/keyboard side-panel resizing, slower continuously blurred dock, nearest theme colors; 23 additional browser checks and 12 palette unit checks |
| Done | Recoloring text quality and dock motion | Codex | Version 0.5.1: grayscale PDF antialiasing, coverage-preserving palette/custom replacements, continuous spring dock with reversible motion and gentle icon magnification; raster and frame-sample checks in validation |
| Ready to reload | Update installed Chrome extension | Arnab | Click Reload in chrome://extensions, then reopen PDF tabs; no reinstall needed |
| Done | Compact keyboard map and complete command shortcuts | Codex | Version 0.6.1: searchable eight-section 4/3/2/1-column glass guide, 75 entries, shared leader registry, g 2 spreads and bindings for remaining commands, notebook Ctrl Enter / Ctrl S, confirmed cache clearing; 53 unit and 97 browser checks |
| Done | Stable recoloring, preview polish, and keyboard ownership | Codex | Version 0.6.0: deterministic continuous color interpolation, WebGL2 worker with CPU fallback, atomic themed zoom/preview swaps, larger dimmed rounded quick looks, full-line preview fit, smart text width, Alt+Enter selection lookup, reserved browser shortcuts and explicit Vimium mode; see validation and theme docs |
| Done | Reduce scrolling/rendering UI stalls | Codex | Version 0.5.2: worker recoloring, bounded/coalesced jobs and stale-result guards, idle extraction, deferred scroll saves, no empty hint DOM churn; three-run evidence and limits in docs/PERFORMANCE.md |
| Open | Test macOS and Linux Chrome | Joint | Browser architecture is portable; no claim of execution on these OSes yet |
| Open | Audit edge PDFs and large-document behavior | Joint | Scans, CJK/RTL, mixed page sizes, complex columns, huge files, enterprise auth |
| Done | Alpha 01 rebrand and download website | Codex | Pipit name, bird identity/Pip art, local browser/platform detection, all three download choices, manual setup, checksum metadata, privacy/credits and live shared reader |
| Done | Cloudflare production publication | Codex | https://pipit-reader.pages.dev/ deployed after device approval; all three public downloads match committed hashes; 41 anonymous HTTPS checks pass |
| Done | Alpha validation and GitHub prerelease | Codex | 208 browser assertions, 83 unit/detection checks, 37 artifact checks; commit 6381798 and v0.8.0-alpha.1 published privately; all three GitHub downloads hash-verified |
| Optional | Store distribution and signing | Arnab | No store submission or paid signing authorized; Firefox unsigned, Safari source-only |

## Resume commands

`npm ci`, `npm test`, `npm run build`, `npm run preview`, `npm run package`.

Read `docs/VALIDATION.md` before interpreting test results. Generated fixtures, screenshots, logs, local browser profiles, distributions, and caches are ignored; do not commit personal PDFs. Preserve the existing Git history and private visibility.
