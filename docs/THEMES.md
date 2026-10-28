# Reading palettes

Pipit adds 20 terminal-inspired presets to Paper, Sepia, and Night. This is a curated set of established terminal theme families, not a claim of a universal popularity ranking. There is no authoritative cross-terminal top-20 chart.

## Dark

Dracula, Nord, Gruvbox Dark, Catppuccin Mocha, Catppuccin Macchiato, Catppuccin Frappé, Tokyo Night, One Dark, Solarized Dark, Rosé Pine, Kanagawa Wave, Everforest Dark.

## Light

Catppuccin Latte, Gruvbox Light, Solarized Light, Rosé Pine Dawn, Tokyo Night Day, One Light, Everforest Light, GitHub Light.

Open `:` and type a theme name, or open settings with `,` and use the All / Light / Dark filters. `g d` cycles all 23 presets. Each preset supplies page background/foreground, interface colors, and palette swatches. Applying a preset turns on document recoloring (except Paper). Disable document recoloring to preserve original scientific figure colors while retaining the interface theme. Custom color replacement mappings are preserved.

Background, foreground, and swatch colors were checked against the [iTerm2 Color Schemes Ghostty collection](https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/ghostty) on 2026-10-19; upstream authors are listed in its [credits](https://github.com/mbadolato/iTerm2-Color-Schemes/blob/master/CREDITS.md). UI surfaces and accents are adapted for reading rather than copying a terminal emulator's full ANSI behavior.

Source names differing from display names: `Atom One Dark/Light`, `iTerm2 Solarized Dark/Light`, `TokyoNight/Day`, `Everforest Dark/Light Med`, and `GitHub Light Default`. Rosé Pine and Catppuccin Frappé use accented display names. UI definitions are in `src/themes.ts`; full 16-slot terminal snapshots are in `src/theme-palettes.ts`. All 320 ANSI slots were checked against the collection on 2026-10-19. No runtime network access is required.

## Continuous recoloring (0.6.0)

The old page-dependent opaque-ink guesses and nearest-swatch snapping are replaced by a deterministic continuous transform. Identical source colors now get the same result on every page and at every zoom. Chromatic hues interpolate between neighboring palette anchors; neutral inks blend smoothly between the selected foreground and paper. Edge coverage is retained using a white-paper matte model. Custom replacements use smooth source-color support and coverage blending, not hard RGB boxes. Nearby gray inks may intentionally share part of a black replacement.

A bundled worker uses an OffscreenCanvas/WebGL2 shader with a cached 65³ color lookup texture and exact 256-level neutral lookup. Custom substitutions run analytically in the shader, avoiding narrow replacement bands being lost in lookup interpolation. Up to four lookup tables are retained (about 4.4 MiB). The CPU worker fallback uses the same continuous equations and retains alpha; GPU lookup interpolation can differ by a few RGB units. WebGL2 capability does not prove physical GPU acceleration: headless browsers or driver policy may use software GL.

This follows the shader approach seen in [Sioyek's custom-color fragment shader](https://github.com/ahrm/sioyek/blob/development/pdf_viewer/shaders/custom_colors.fragment). [Zathura's render implementation](https://github.com/pwmt/zathura/blob/develop/zathura/render.c) instead interpolates its endpoint colors in the render thread and can preserve image regions. Pipit is an independent implementation; it does not reproduce their exact appearance or identify PDF image regions.

PDF.js still renders with grayscale antialiasing. During zoom, up to four scaled copies of previous themed rasters cover pending replacement pages; raw new canvases remain hidden until recoloring completes. Initial pages use the themed paper placeholder. Preview pages render into a detached buffer and swap atomically. Rapid theme changes coalesce, and stale results cannot overwrite current pages. Original raster caches permit exact reset. No document pixels leave the browser.

This is a reading adaptation, not colorimetric reproduction. White-matte inference cannot distinguish translucent gray text from solid gray ink, and nonwhite paper, photographs, coincident colors, or complex scientific figures remain ambiguous without PDF object geometry. Palette interpolation can merge hues and reduce saturation. Disable recoloring whenever original color information matters.
