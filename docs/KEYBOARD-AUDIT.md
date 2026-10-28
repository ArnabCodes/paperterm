# Keyboard access audit — 27 October 2026

## Home-row and reading-history review

The commands and their displayed keys are reviewed against [Sioyek's default key file](https://github.com/ahrm/sioyek/blob/main/pdf_viewer/keys.config) and [Zathura's key bindings](https://pwmt.org/projects/zathura/documentation/). The guide and command menu share one shortcut registry. These choices keep familiar movement and preserve existing Pipit actions where Sioyek and Zathura disagree:

| Area | Binding and decision |
| --- | --- |
| Movement | `h j k l`, `gg`, `G`, Space and Shift Space remain Vim-style; `d`/`u` move half a viewport. |
| Reading trail | `g h` / `g l` use adjacent home-row direction keys; Sioyek's Backspace / Shift Backspace and the previous Alt arrow aliases also work. Backspace edits text normally in inputs. |
| Open and browser controls | `o`, `O` and Ctrl/Cmd O retain Sioyek/browser file-opening muscle memory. Zathura's Ctrl O conflicts with opening files and Ctrl I can overlap Tab on some platforms, so the home-row leader pair provides an alternative. `x`, `X`, `J`, and `K` remain available to browser/Vimium tab navigation. |
| Search and links | `/`, `n`, `N` and `f` follow common Vim/Sioyek/Zathura habits; `F` opens Pipit's reference lens. `e`, `c`, `v`, and `s` remain direct research shortcuts. |
| Zoom and layout | `+`/`-` change zoom; `=` or `w` fit page width, as in Sioyek; `W` uses smart width and `a` fits the page. `g 2` retains the spread command. |
| Marks and notes | `m` plus a letter and apostrophe plus a letter preserve Vim/Zathura quickmarks. `b` bookmarks, `Q` opens the notebook, and `g q` captures a passage. |
| Other leaders | `g h` and `g l` replace the former demo/glass bindings; the demo is now `g A` and glass is `g a`. Other `g` commands remain available in the searchable guide. Modifier keydown events no longer discard a pending leader before its uppercase key. |
| Extension conflicts | An extension such as Vimium can intercept keys before the standalone web reader receives them. Its defaults reserve `H`/`L` for browser history and `J`/`K` for tabs, so the reader does not claim those. With Vimium's defaults, Backspace/Shift Backspace reach Pipit; `g h`/`g l` may require Vimium insert mode or a site exclusion in the ordinary web reader. The tutorial's focused keyboard surface allows the home-row pair without changing Vimium settings. Custom mappings can differ. |

Lesson six restores its equation preview when resumed or selected directly. Enter follows the preview from the paper or preview; the lesson confirms a return to the actual source page and page-relative position. Pinned-pane changes can resize the page, so reading history stores a relative position in addition to the previous pixel values. The updated tutorial PDF retains its original first document identifier, preserving existing notes and bookmarks.

Hard mode is an input policy for the reader page, not a browser kiosk. Manual hard mode blocks pointer events, wheel, touch, drag and context menus while preserving native zero-detail keyboard/assistive clicks. During tutorial lessons the game panel remains mouse-accessible while reader actions stay keyboard-driven. Ctrl Shift F12 exits hard mode and pauses the tutor. Reload clears it. System file choosers, browser controls and OS shortcuts remain outside the reader's control.

| Capability | Keyboard path |
| --- | --- |
| Files, folders, recent documents and URLs | o / Shift O / g o; file-browser arrows or h/j/k/l; Tab for folder grants/import buttons |
| Scroll, page jumps, zoom, layout and history | j/k/h/l, arrows, p, +/−, w/=/W/a, g 2, R, g h/g l, Backspace/Shift Backspace; Alt Left/Right remain available |
| Search and references | / then n/N; e/c/v; f/F hints; g P full-page fallback |
| Preview focus, movement and pinning | g i / g m; Shift P; Alt Up/Down, Alt PageUp/PageDown; Enter follows |
| Resize pinned pane | Tab to separator; arrows, Home/End |
| Dock and settings | F6; Tab/Shift Tab, arrows and Enter/Space; comma; searchable commands |
| Color picker alternative | : Set colors by hex; : Add palette mapping by hex; type two #RRGGBB values |
| Quotes and notes | New g q text-line lookup captures an anchored quote; Shift Q opens notebook; Ctrl/Cmd Enter adds a note; typing saves |
| Backups, undo and export | Notebook Tab controls, Ctrl/Cmd S Markdown export; Tab to backup/import/undo/redo |
| Citation exploration | g c / g L; Tab controls; graph arrows/Enter or accessible list; range controls use arrows |
| Scholar without text selection | g / opens a typed query when no PDF text is selected |
| Flight School and progression | Enter starts and advances; Esc closes a tool, then pauses; Enter resumes; F2, Tab/Shift Tab and Enter/Space operate controls; arrows/PageUp/PageDown scroll the game panel |

The original mouse-only gap was selecting PDF text for quote capture. The new searchable text-line capture provides a keyboard path with a real page anchor. Keyboard lookup does not provide arbitrary rectangular image selection or OCR; neither is an existing annotation feature. Custom color entry now avoids dependence on native color-picker keyboard behavior. Preview/document focus has direct commands.

Validation uses actual key events plus real outcomes, and includes forwarded webview KeyboardEvents. Event.isTrusted is intentionally not an input eligibility requirement: embedded browsers and assistive bridges may forward valid keys. XP is a local learning aid. Tutorial credit still requires the taught sequence and a real outcome; a GUI control alone cannot stand in for the shortcut. See tutor-keyboard-browser.mjs, tutor-arcade-regression.mjs and tutor-unit.mjs. Browser-extension runtime evidence is recorded in docs/ALPHA.md; Safari must not be inferred from source parity alone.
