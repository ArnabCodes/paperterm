# Scrolling performance

## Measured result: 0.5.1 → 0.5.2

Local Windows Chromium, 1440×960 viewport, cached Mozilla TraceMonkey research paper (14 pages), Dracula theme. Three six-second full-document scrolls per build, using the same Playwright session and script. This measures UI-thread responsiveness during rendering, not PDF correctness, total rendering throughput, or superiority over other readers.

| Metric | 0.5.1 baseline | 0.5.2 |
| --- | --- | --- |
| Total long-task time, three runs (ms) | 1409 / 1172 / 1212 | 52 / 51 / 100 |
| Long-task count | 13 / 13 / 13 | 1 / 1 / 2 |
| Frames longer than 34 ms | 13 / 13 / 13 | 2 / 2 / 2 |
| Worst frame, each run (ms) | 333.7 / 133.4 / 133.5 | 50.1 / 50.1 / 50.2 |
| 95th-percentile frame interval (ms) | 16.8 / 16.8 / 16.8 | 16.8 / 16.8 / 16.8 |

Median total long-task time falls from 1212 to 52 ms (95.7% lower). All six runs reach page 14. These are requestAnimationFrame-driven scrolls, not a physical touchpad benchmark; headless/browser graphics, display refresh, caching, hardware, document content, zoom, and UI effects affect results. Occasional 50 ms frames remain. The unchanged 95th percentile is why the tail metrics matter here. No claim that all stutter is eliminated or that every PDF reader is slower is supported.

Raw logs are retained in ignored `output/playwright/v052-scroll-before.txt` and `v052-scroll-after.txt`. Baseline distribution is retained as `artifacts/paperterm-0.5.1-chrome.zip` (SHA-256 `332f5fa03bbaf20a1d40e353a5c0d379cfbd76845749ab86dd51950b151ca5f5`). An earlier exploratory optimized run is not used in the table.

## Changes

- Move palette inference and all per-pixel recoloring to a bundled local module worker. PDF.js keeps its own rendering worker. Text-edge/color algorithms are unchanged and pass the existing pixel tests.
- Transfer the working pixel buffer instead of structured-cloning it. Keep an untouched source raster for exact theme resets. Read a canvas once rather than twice on its first recoloring; avoid restoring the old raster before every new recoloring pass.
- Bound worker dispatch to one active image, coalesce queued updates per canvas, and delay readback until dispatch. Replaced, detached, resized, rerendered, and previous-document jobs cannot overwrite current page pixels. Reset invalidates in-flight results immediately.
- Give reference extraction idle opportunities between pages, retaining a timeout for progress. Defer scroll-driven reading-position storage by 250 ms; explicit actions, document switches, and unload still flush it.
- Avoid clearing the hint DOM on every scroll when no hints are present. Keep native scrolling and the existing smooth dock; do not replace wheel handling with a JavaScript scrolling loop.

The UI may briefly show original page colors while the asynchronous theme pass completes. Canvas readback/upload, text-layer construction, PDF.js main-thread drawing, indexing batches, and frosted-panel compositing still have costs. The source-raster cache is retained with PDF.js canvases; large zoom levels still consume memory. Performance on scans, giant/vector-heavy documents, macOS/Linux, actual high-DPI touchpads, and sustained memory pressure needs separate testing.

## Reproduce

### 0.6.0 quality/acceleration follow-up

The new continuous/interpolated shader changes output semantics; it is not a bit-identical speed optimization. Three retained runs in v060-scroll.txt report total long-task time 277 / 0 / 50 ms, frames over 34 ms 7 / 7 / 7, worst frames 160.2 / 53.4 / 36.1 ms, and p95 intervals 18.3 / 18.2 / 18.3 ms. All reach page 14. This does not demonstrate a scrolling win over 0.5.2: headless software GL, cold lookup creation, GPU scheduling, and host load remain possible costs, and the 0.5.2 baseline was not rerun alongside it. The 0.6.0 improvement demonstrated here is elimination of exposed default-white zoom frames and stable page-independent color mapping, not a new universal speedup claim. Hardware-GPU and cross-reader comparisons remain open.

Build and serve the production bundle; cache the TraceMonkey fixture as described in `VALIDATION.md`. Then run:

```sh
npx --yes --package @playwright/cli playwright-cli -s=perf open "http://127.0.0.1:4173/?demo=1"
npx --yes --package @playwright/cli playwright-cli -s=perf run-code --filename scripts/verification/scroll-performance.js
```

The benchmark records frame intervals and Long Tasks API entries, not an estimate derived from source inspection. To compare another build, serve that build under the same conditions and retain its logs separately. Chrome DevTools MCP was unavailable for this run; no DevTools trace or cross-reader benchmark is claimed.
