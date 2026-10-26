# Field citation map and content previews — local review 0.9.0

Status: **local review only**, per Arnab's 2026-10-21 instruction. This update has not been deployed, committed, pushed, or uploaded to a GitHub release. The public website and downloadable 0.8.0 release remain unchanged.

The subsequent [reader consolidation](UX-REVIEW.md) makes `F` the unified reference lens. Object crops are initial viewports over a full-height column canvas, not permanently clipped images: scroll up/down for context, or use `Alt PageUp/PageDown` for independent preview pages. `g P` remains the full-page-width escape hatch.

The latest quiet-explorer review adds the automatic/cached identification and multi-hop controls described below. Both-direction graphs separate earlier/citing work left/right; a single-direction view uses full rings to avoid wasting half the plotting area. Labels stay opaque, and arrows stop outside their destination circles. Provider PDF-location fields are documented in [OpenAlex work attributes](https://help.openalex.org/data/works/attributes/).

## The paper in the broader field

`g c` opens the new citation map. It uses OpenAlex's public scholarly graph rather than interpreting within-PDF page links as a literature network.

1. Opening the explorer identifies the paper automatically using locally extracted title/DOI metadata. Opening a PDF alone never calls OpenAlex. A previously identified PDF restores its associated work and cached graph without searching again.
2. Exact title matches open directly. Multiple records with the same exact title, full available author list (at least three names) and year use the most-cited indexed edition, with an edition caveat under sources. Other ambiguous matches require confirmation. This is not a guarantee of edition identity. **Identify or change paper** keeps manual title/DOI/work-ID lookup and an automatic-identification opt-out accessible.
3. Choose references, papers citing this work, or both. The separation slider requests up to three hops, not just a recoloring of first-hop neighbors. Deeper circles have progressively fainter fills; all text remains opaque. A full-title list is available alongside keyboard-navigable graph nodes.
4. Select a paper to see its title, authors, citation counts and citation rate. **Open PDF** appears when OpenAlex indexes an HTTPS open-access PDF location; it opens the source directly in a new tab. The source can still fail, require authentication, or have stale metadata. **Explore from here** recenters. Source/DOI links, related works, filtering, refresh and the offline bibliography remain under disclosures rather than being removed.

Solid directed arrows run **from citing paper to cited paper**, including citation edges between the displayed neighbors. Dashed lines indicate optional OpenAlex relatedness, not a citation. Node size uses log-scaled citations per publication-year, with square-root radius scaling: an age-adjusted attention proxy, not quality or field-normalized scientific impact. Colors reflect indexed topics and can repeat. References grow left, citing work right; ring distance indicates shortest-path separation in the selected direction. In Both mode hops can follow either citation direction. This is not a learned semantic embedding or proof of influence.

The first hop requests up to 18 references, 18 citing papers and 10 related works. Additional hops use at most 16 frontier parents (balanced 8/8 for Both), with up to 18 new records per direction per hop and a hard cap of 120 works. A cold three-hop Both view uses at most seven sequential API requests after identification. This is a bounded, citation-count-biased sample, never an exhaustive field map; recent or unindexed work can be absent. Coverage, retrieval time, provider attribution and partial failures remain available under **Filter, sources & more**. Rate-limited expansion stops rather than exhausting remaining requests.

Anonymous OpenAlex API calls are used; no shared API key, account signup or paid backend was added. Requests are sequential, bounded and abortable. HTTP failures and rate limits become visible messages without automatic retry storms. Successful neighborhoods are cached in browser-local storage for 24 hours, subject to browser quotas. Refresh explicitly fetches new data. Closing the map, switching documents, or starting another search cancels stale work. Reopening an existing map does not refetch its OpenAlex neighborhood; selected-paper publisher discovery can resume separately as described below.

Metadata can be incomplete, stale or merged across editions/versions. Apparent chronological inconsistencies or missing links need checking against original papers. Graph position and citation counts are navigational aids, not scientific evidence of influence.

**Privacy:** opening the citation explorer can send the inferred title or DOI and public work IDs directly to OpenAlex, with credentials omitted and no referrer. Disable automatic identification in **Identify or change paper** if you want to inspect/edit queries before submitting them. PDF bytes, notes, selections and reading history are not uploaded. Titles themselves may be sensitive. PDF rendering and in-document lookup stay local; OpenAlex still receives normal connection information. Successful neighborhoods and expansions are cached for 24 hours; the work association is local to the PDF fingerprint. Closing or changing papers cancels stale requests.

The previous page-to-bibliography view remains under **Within-PDF references & backlinks**, or `g L`. It continues to work offline and has the original numeric-citation limitations. `g B` still opens mentions of a previewed local bibliography entry.

## Publisher PDF discovery (local review)

Open PDF now opens the shared Pipit reader directly, including on Safari where automatic MIME interception is unavailable. OpenAlex's primary-location PDF URL is retained even if it is not open access: institutional authorization is evaluated when the publisher serves it. If a selected paper has no indexed PDF, its DOI (or primary landing page) is fetched with available browser credentials. Inert HTML parsing checks citation PDF metadata, typed PDF links, JSON-LD PDF encodings and explicit main-paper PDF links, without executing publisher JavaScript or guessing download endpoints. Supplementary links are not selected from generic anchors.

Only the selected paper is checked, not the entire graph. This contacts the publisher as well as OpenAlex, potentially with its existing browser cookies; no PDF content or annotations are uploaded. Requests time out after 12 seconds, HTML reads stop at 2 MB, discovery returns at most 12 candidate links, and successful lookups are cached in memory for ten minutes. Closing the map/changing selection cancels pending lookups. Failed lookups show an explicit publisher link and retry button. Discovered links are not a promise of access; login, session expiry, cookie partitioning, CORS, missing extension host access, JavaScript and anti-bot challenges may still block them. The standalone webpage cannot override CORS. No authentication, CAPTCHA, paywall or browser security protection is bypassed.

The extension toolbar now opens the current HTTP(S) article in the shared discovery flow; Safari retains its direct-PDF HEAD check and uses article discovery for non-PDF responses. Explicit download bypasses remain honored. The reported ScienceDirect article URL is recognized as HTML needing discovery, rather than being sent blindly to PDF.js. The live URL returned HTTP 403 to web fetching and showed "Just a moment..." in the in-app browser here, so institutional success on that exact article is not established. Use the publisher's normal access flow and its actual PDF link if discovery is blocked.

## Content-only previews

The central preview has no visible title bar, page badge, toolbar, border, or internal padding. The PDF content fills its viewport; the dimmed underlying page and subtle external shadow separate the surfaces. Source labels remain available through the preview's accessible name.

- Equation/figure/table lookups use target coordinates, text boxes, and a bounded original-raster analysis to infer column and vertical content bounds.
- Two-column detection requires sustained substantial text on both sides. Equation-number boxes refine the horizontal target when a source line groups adjacent content. Column extents include short equation labels. Full-width content crossing the gutter falls back to full width.
- Figures/tables include content above their caption. This is a text/whitespace heuristic, **not a PDF object-segmentation model**. Scans, complex multi-column layouts, unusual captions, image-internal text, rotated pages, and internal destinations with unknown coordinates may fall back to a page or crop imperfectly.
- A low-resolution original-color analysis locates bounds; a separate direct PDF.js render at the final crop's display resolution keeps glyphs sharp. Recoloring applies to that fresh crop before it replaces the displayed canvas. Pixel allocation is bounded at eight million pixels. No performance superiority claim is made for the extra crop-analysis pass.
- `g P` toggles complete-page fallback. Escape closes, Enter follows the passage, Shift+P pins/unpins, and `+`/`-` zoom the focused preview. Right-click or Shift+F10 exposes transient mouse/keyboard actions. Pinned panels retain drag and keyboard resizing.

## Implementation and evidence

- `src/citation-network.ts`: normalized provider records, bounded requests, directed graph and deterministic layout.
- `src/field-panel.ts` / `src/field.css`: opt-in matching, graph interaction, cache, provenance, keyboard controls and content-only preview surfaces.
- `src/preview-region.ts`: column/raster crop heuristics; `src/reader.ts`: high-resolution cropped rendering.
- `src/text-lines.ts`: conservative fallback for equation rows whose labels extend into the learned gutter. Existing bibliography-order tests remain intact.
- `scripts/verification/field-preview-unit.mjs`: graph identity/direction, malformed records, privacy request options, partial failures/rate limits/cancellation, column reading order, crop isolation, spanning fallback and full-page override.
- `scripts/verification/field-preview.js`: actual OpenAlex DOI lookup and neighborhood, explicit confirmation, offline local map access, cache reuse, controlled 429 handling, both equation columns, figure extent, context menu, full-page override and pinning. Public-paper metadata and screenshots are cached under ignored `output/playwright/v090-*`; the result includes a normalized network snapshot.

Current evidence: 88 unit checks, 16 archive checks and 183 browser assertions pass, including native Chromium and Firefox 158. The example snapshot contains 43 works and 114 directed citation links. No native Safari execution or public deployment of 0.9.0 is claimed.

## API sources

- [OpenAlex citation-neighborhood recipes](https://help.openalex.org/how-to/api-recipes/)
- [OpenAlex authentication and anonymous-access limits](https://help.openalex.org/api/authentication/)
- [OpenAlex public API reference](https://help.openalex.org/api/)
