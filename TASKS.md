# Paperterm resumption dashboard

Updated: 2026-10-19. Direction: minimal browser-first PDF workspace, replacing the Python terminal prototype. Repository must stay private.

| State | Task | Owner | Evidence / next step |
| --- | --- | --- | --- |
| Done | Replace terminal implementation with web reader | Codex | PDF.js rendering and TypeScript UI; no Python runtime dependency |
| Done | Rust WASM reference lookup | Codex | Five Rust unit tests; browser equation, citation, figure and smart-hint checks |
| Done | Chrome default-viewer integration | Codex | Isolated Chromium profile: MIME redirect, query/hash preservation, attachment exclusion, HTML exclusion |
| Done | Keyboard reading tools and themes | Codex | Keyboard, document, and pixel-level recoloring checks; see validation report |
| Done | Build/package workflow | Codex | Production dist and Chrome ZIP with SHA-256 |
| Ready for acceptance | Try representative personal papers | Arnab | Check equations, bibliography styles, accessibility, and preferred shortcuts |
| Manual installation | Load unpacked extension in everyday Chrome | Arnab | See README; optionally allow file URLs; normal profile was not changed |
| Open | Test macOS and Linux Chrome | Joint | Browser architecture is portable; no claim of execution on these OSes yet |
| Open | Audit edge PDFs and large-document behavior | Joint | Scans, CJK/RTL, mixed page sizes, complex columns, huge files, enterprise auth |
| Optional | Publication / store distribution | Arnab | Private GitHub only; no Web Store publishing or public hosting authorized |

## Resume commands

`npm ci`, `npm test`, `npm run build`, `npm run preview`, `npm run package`.

Read `docs/VALIDATION.md` before interpreting test results. Generated fixtures, screenshots, logs, local browser profiles, distributions, and caches are ignored; do not commit personal PDFs. Preserve the existing Git history and private visibility.
