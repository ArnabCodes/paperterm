# Pipit Tutor

Run `:Tutor` (colon, Tutor, Enter), use the welcome-screen button, or open the web reader with `?tutor=1`. The intro explicitly confirms replacing the current view with the tutorial paper; the previous document is not edited.

The Coherence Atlas is a six-page, two-column LaTeX instructional specimen. Source: `tutorial/main.tex`; bundled output: `public/tutor.pdf`; source/output SHA-256 receipt: `tutorial/build.json`. Observations and figure data are synthetic. Bibliographic sources are real navigational examples, not evidence for the invented experiment.

Eight core missions and two optional challenges award 300 XP total. Four badges unlock at 60, 150, 250 and 300 XP. Checks observe real reader state, with no passive-time awards. Free hints, skips, mission revisits, pause/resume and a confirmed progress reset keep the route forgiving. Progress uses `pipit.tutor.v1` browser-local storage. No account, telemetry, document upload, network lookup or streak penalty is involved. Notes and bookmarks use the existing document storage and survive tutorial reset.

## Reproduce

- `node scripts/build-tutor.mjs`: compile twice with pdfLaTeX when source/output hashes change. A verified bundled PDF avoids requiring TeX for ordinary builds.
- `npm test`: includes tutorial transition, validation and XP checks.
- `npm run build`, then `npm run preview -- --port 4173 --strictPort`.
- `node scripts/verification/tutor-browser.mjs`: complete the ten real actions, verify persistence/reset, and capture desktop/mobile screenshots.
- `npm run verify:alpha`: reader, browser packages and site release checks.

The existing `?demo=1` sample remains for compatibility and regression fixtures. The welcome screen and website promote the new tutor. Browser storage can be cleared or unavailable; tutorial progress is convenience data, not a durable backup. Mobile remains a compact coaching layout; research reading is best on desktop.
