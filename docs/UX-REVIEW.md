# Reader consolidation — local review, 2026-10-21

No deployment, push, commit, or store publication is authorized. Earlier reader and website work is preserved. This is a focused refinement, not a claim that all ten proposed upgrades are complete.

## One lens, two intentions

- `f` follows embedded links, including external links. It does not guess destinations from paper text.
- `F` is the reference lens: it labels visible equations, figures, tables, numeric citations, and non-duplicate internal links. Unlinked references and PDF links no longer require different preview tools. `s` remains a compatibility alias, not a separate menu item or feature.
- `e`, `c`, and `v` remain useful for finding an equation, citation, or figure/table that is not visible. Select text and use `Alt Enter` to peek, or `Alt Shift Enter` to jump.
- The lens initially shows just the inferred object at column width. Its canvas retains the entire source page height, so wheel, arrows, `j/k`, `d/u`, Space and PageUp/PageDown can reveal surrounding text without moving the main paper. `Alt PageUp/PageDown` independently changes preview pages. It is not a continuous multi-page column browser.
- `Enter` follows the target; `Shift P` pins/unpins; the separator supports dragging and Left/Right/Home/End. `Alt Up/Down` traverses lookup results. `g P` restores full-page width when column/object inference is wrong or surrounding content spans columns. Shift F10/right-click reveals transient actions.
- Reflows and zooms preserve the preview's vertical center instead of repeatedly snapping back to the object. New destinations wait for their themed raster before appearing; the entrance fades without interpolating a stale, differently sized transform. No unthemed swap is introduced.

## Dock: targets first, animation second

The compact dock has fixed core geometry: contents, page, search, commands, tools. The latest local refinement expands its background to both sides of that core, with three named tool categories on each side, rather than the earlier fan above it. Narrow windows stack the side tools. Core hit targets stay unobstructed while the background expands.

Hovering a category reveals its command menu; leaving both it and its source button by more than 28px closes it. Menus render outside the dock's backdrop-filter root so their 24%-surface / 28px-blur glass actually blurs the page rather than trapping an empty backdrop. Text stays opaque. Menus are positioned relative to their originating option, including narrow windows, so users can cross the gap safely. F6, Tab, arrows, Enter and Escape retain keyboard access; Escape restores category focus without reopening the menu. The command registry, disabled contextual actions, named theme choices and reduced-motion behavior remain shared.

## Review of the ten proposals

| Proposal | Retained / improved | Honest boundary |
| --- | --- | --- |
| Unified reference lens | One `F` lens, original-PDF rendering, semantic lookup plus embedded destinations, column/object crop, scrollable context | Extraction/object boundaries are heuristic; scans, rotated layouts and unusual caption placement can require `g P` |
| Snapshots and split views | Existing pinnable lens, pointer/keyboard resizing; new independent preview-page navigation | One preview pane, not multiple saved snapshot cards |
| Navigation memory | Existing bookmarks and letter marks; history now restores scale and rotation as well as both scroll coordinates | Jump history is session-local, not a portable browsing-history database |
| Portable annotations | Existing anchored notes/excerpts and cited Markdown; new JSON backup/import, conflict-safe merge, undo/redo | Sidecars only. No PDF-embedded annotation authoring or new highlight editor; text anchors use source page, vertical fraction and excerpt, not semantic reattachment after PDF revisions |
| Search | Existing incremental PDF.js search, highlight traversal and document/reference lookup | No new search-results/snippets sidebar. PDF.js text search and the column-aware reference index are different pipelines; arbitrary two-column search order is not guaranteed |
| Command system | Shared searchable commands, scoped preview keys, categorized dock, eight-section guide, existing Vimium mode | No new shortcut-remapping editor. Browser-reserved keys remain reserved; Vimium cannot inject into another extension |
| Reading geometry | Existing smart width, fit modes, spreads; column-aware preview and full-page fallback | No automatic main-view column progression. A full-width object should not be forced into a column |
| Comfort modes | Retained continuous recoloring, GPU/CPU fallback, atomic themed swaps, original-color toggle and ruler | No claim of artifact-free rendering for every PDF or semantic figure-only theme preservation; use original colors for scientific color fidelity |
| Local workspace | Existing bounded local recent library, saved positions, bookmarks and notes | Cached copies are limited to six PDFs / 25 MiB per PDF; this is not a new OS file-permission/session manager |
| Broader citations | Retained explicit OpenAlex identification/confirmation, provenance, bounded network, caching, graph and details/filter navigation | Relatedness is not a citation; provider coverage is incomplete. Queries/public IDs leave the browser only on explicit research actions, never PDF bytes or notebook content |

## Notebook portability and undo

Open `Q`, then **History & portable backup**. Save a JSON backup and import it with the same original PDF in another browser. Import checks format/version, PDF fingerprint, page bounds, duplicate IDs, text sizes and entry limits before changing anything. Matching notes are idempotent; conflicting edited notes are rejected rather than silently overwritten. Import adds notes and never deletes local notes. A merge can be undone.

Undo/redo covers note creation, deletion, import and grouped text edits, with up to 40 snapshots per active document. Toolbar controls work with the keyboard; outside a textarea, Ctrl/Cmd Z and Ctrl/Cmd Shift Z (or Ctrl Y) operate on notebook changes. Inside textareas the browser keeps its normal editing undo. History is cleared when documents change. Quotes and notes are escaped as literal content; backup files contain private notebook text and should be shared deliberately. Markdown exports remain cited with document name and page number. Neither export modifies the original PDF.

## Evidence and limits

Build, unit, native-browser and performance logs use the ignored `output/playwright/refinement-*` prefix. Tests include the original six-page guide, a two-column equation/figure/table fixture, and the cached 14-page Mozilla TraceMonkey research paper. Native Chromium and Firefox 158 were exercised on Windows, including extension CSP, MIME interception, real rendering, text search, preview scrolling, dock commands and notebook persistence. JSON sidecar round trips are exercised in both browser engines; unit checks reject invalid/conflicting backups. Screenshots cover compact/fanned dock and centered column equation content.

Performance comparison uses the previous local `site-dist/reader` build and current `dist`, the same headless Chromium 155 profile, 1440×960 viewport, DPR 1, Dracula theme, and three six-second requestAnimationFrame-driven scrolls through TraceMonkey. Before: p95 16.8 ms in all three runs, frames over 34 ms: 2/1/2; long tasks: 2/0/0 (259/0/0 ms). After: p95 16.8 ms in all runs, frames over 34 ms: 2/2/1; no >50 ms long tasks. All runs reached page 14. This supports no observed scrolling regression on this workload, not a general speedup or superiority over other readers. Individual local equation-opening flows were approximately 0.10–0.16 s including keyboard/palette automation; this is diagnostic, not an input-latency benchmark. Preview rasters remain bounded to approximately eight million pixels.

Native Safari/macOS, screen-reader usability, revised-PDF annotation reattachment, handwritten/scanned PDFs, and large or unusual scientific layouts remain unverified. Safari still uses explicit opening, not automatic default-viewer replacement; its package is developer source, not a signed permanent installer. No Safari runtime result is inferred from shared code or user-agent spoofing.

Final post-polish rerun: p95 remains 16.8 ms; frames over 34 ms = 2/2/2; zero Long Tasks; all runs reach page 14. The previous comparison build is retained at `output/playwright/refinement-baseline-reader` before regenerating the local website/downloads. Current totals: 96 unit checks, 16 archive checks, 217 reader browser assertions, plus 12 browser-detection and 21 website artifact checks. The latest local website and extension packages contain the refined reader; production remains untouched.
