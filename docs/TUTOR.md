# Pipit Tutor

Run `:Tutor` (colon, Tutor, Enter), use the welcome-screen button, or open the web reader with `?tutor=1`. The compact Flight School screen focuses Play, so Enter starts immediately. Play loads the tutorial paper without editing the previous document. Returning players can choose Practice or Guided play.

The Coherence Atlas is a six-page, two-column LaTeX instructional specimen; its revised PDF keeps the original document ID so existing tutorial notes and bookmarks remain attached. Source: `tutorial/main.tex`; bundled output: `public/tutor.pdf`; source/output SHA-256 receipt: `tutorial/build.json`. Observations and figure data are synthetic. Bibliographic sources are real navigational examples, not evidence for the invented experiment.

Nine core lessons and two optional challenges award 300 XP total. Original SVG bird/platform art, feather rewards, lit keycaps and eleven level tiles show progress. Guided play shows the next instruction and an optional full walkthrough; Practice initially hides help. Guidance also appears inside relevant lookup and notebook dialogs. Ranks unlock at 60, 150, 250 and 300 XP. A centered title introduces each level; every level has its own animated illustration. Confetti celebrates clearing all eleven. Learn and Practice keep independent runs in `pipit.tutor.v3`; earlier v1/v2 records are untouched. Credit requires the taught keyboard sequence and an actual reader outcome.

During a lesson the reading surface and dock block mouse clicks, hover, wheel, context menus, touch and drag, while the game panel remains mouse accessible. Complete the paper actions with the keyboard; pointer actions on the game panel do not earn lesson credit. Outside training, manual hard mode blocks pointer interaction across Pipit. Native keyboard/assistive-technology button activation remains available. Ctrl Shift F12 always exits and pauses training, even in a modal. Hard mode is session-only and resets on reload. `:HardMode` toggles it outside lessons. Browser chrome, OS commands and system file/permission dialogs are outside its scope.

In lesson 6, Enter follows the equation preview; press g then h to return. Backspace also returns. The preview is restored automatically if you resume or select the lesson directly. Elsewhere, ⏎ advances after success (Ctrl Enter remains accepted). Press Shift H to show or hide hints without leaving the paper. Escape closes an open tool, then pauses; Enter resumes from a small pause screen. F2 switches game/paper focus; Tab/Shift Tab and Enter/Space operate controls. A focused game panel scrolls with arrows and PageUp/PageDown. Hints, skips, revisits and a confirmed run reset remain available. Notes/bookmarks survive reset. No telemetry, upload, remote lookup or streak penalty is introduced.

Movement is routed at the window capture layer while the first level is active. The reader is prepared in continuous scrolling mode before play; j/k operate the actual scroll container with immediate feedback, even with a coach button focused. Forwarded webview/assistive key events are accepted; XP is a local learning aid, not a trust boundary. Two-key prefixes do not time out during training. Prefixes and hints are cleared on level changes and pause so stale sequences cannot affect subsequent actions.

Returning players can choose **Speedrun** for a fresh timed run. The timer pauses with the game, and the best complete run is saved locally. Skipping a level makes that run unranked even if it is revisited; notes and guided/practice progress remain separate.

## Appearance and keyboard extensions

The game follows the system light/dark preference on first use. Use the Light/Dark control or press **Shift T** during a lesson; this choice is saved locally and is independent of the PDF theme. Animations honor reduced-motion preferences.

Vimium can intercept keys before a page sees them. During the lesson Pipit uses a labelled, read-only keyboard focus surface; the full course was tested with the actual Vimium extension in Chromium. Other extensions and custom mappings may intercept keys differently. If Pipit cannot acquire focus it pauses, restores pointer input, and explains how to exclude this site. Surfingkeys' default autofocus protection requires a site exception: its default **Alt S** shortcut toggles Surfingkeys for the current site, after which Resume works. This was tested with the actual Surfingkeys extension in an isolated profile. These shortcuts may be customized. Safari's native extension and other keyboard extensions have not been tested here.

## Reproduce

- `node scripts/build-tutor.mjs`: compile twice with pdfLaTeX when source/output hashes change. A verified bundled PDF avoids requiring TeX for ordinary builds.
- `npm test`: includes tutorial transition, validation and XP checks.
- `npm run build`, then `npm run preview -- --port 4173 --strictPort`.
- `node scripts/verification/tutor-keyboard-browser.mjs`: complete all eleven lessons without mouse interaction; verify blocked input, shortcut proof, independent modes, keyboard quote capture, typed colors, emergency exit and persistence. Set `PIPIT_TEST_ENGINE=webkit` to run against Playwright WebKit.
- `node scripts/verification/tutor-arcade-regression.mjs`: immediate J/K without focus correction or delays, four viewport sizes, coach focus, forwarded window keys, Vimium preference, manual hard-mode pause and Enter resume.
- `node scripts/verification/tutor-appearance.mjs`: light/dark, saved choice, keyboard toggle, and reduced motion in Chromium and WebKit.
- `node scripts/verification/tutor-keyboard-conflicts.mjs vimium-repro` (or `surfingkeys`): full course with separately obtained, unpacked extensions in `output/browser-tools/`. Surfingkeys test checks safe pause, then uses its site toggle before resuming.
- `node scripts/verification/history-regression.mjs`: resumed/direct lesson six, page-relative back and forward after pane resizing, input editing and existing notes/bookmarks. Set `PIPIT_TEST_ENGINE=webkit` for WebKit.
- `node scripts/verification/history-vimium.mjs`: real Vimium compatibility for standalone Backspace and resumed home-row tutorial navigation.
- `node scripts/verification/tutor-speedrun-browser.mjs`: complete a timed run; check pointer access, pause, confetti, local best time and skipped-run eligibility. Set `PIPIT_TEST_ENGINE=webkit` for WebKit.
- `node scripts/verification/tutor-scenes-browser.mjs`: check distinct animation and visual themes for all eleven levels.
- `npm run verify:alpha`: reader, browser packages and site release checks.

The existing `?demo=1` sample remains for compatibility and regression fixtures. The welcome screen and website promote the new tutor. Browser storage can be cleared or unavailable; tutorial progress is convenience data, not a durable backup. Mobile remains a compact coaching layout; research reading is best on desktop.


### Advanced route and Feather Relay

Choose **Advanced** in Flight School to practice quickmarks (`m a`, then `' a`), moving the reading ruler (`]` and `[`), and focus mode (`z`). This is a separate course with its own local progress; the original guided course and its 300 XP remain intact. Quickmark `a` is saved in the tutorial paper's own reading state.

**Feather Relay** deals five challenges from a shuffled deck of eight reader actions. Each feather requires the actual keyboard action; hints are available with Shift+H. There is no countdown, and Enter deals a fresh route after a completed relay. Escape pauses, and F2 moves keyboard focus to the game controls. Relay scores last only for the current run.
