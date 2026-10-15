# Paperterm

Paperterm is a cross-platform PDF reader that runs entirely in a terminal. It combines keyboard-first page navigation with configurable colors, terminal-background transparency, and quick equation and citation lookups.

## Features

- Terminal-only interface with no mouse controls or graphical window.
- PDF page rendering with true-color terminal output.
- Configurable foreground/background replacement and arbitrary color substitutions.
- Transparent page background by mapping it to the terminal's default background.
- Keyboard navigation, text search, page jumps, and saved bookmarks.
- Equation-number and citation-key lookup across the open document.

## Install

Requires Python 3.10 or newer and a terminal with Unicode half-block and 24-bit color support. Install from a checkout with:

```console
python -m pip install .
```

Open a document:

```console
paperterm paper.pdf
```

## Keys

| Key | Action |
| --- | --- |
| `j` / `k`, Down / Up | Scroll one line |
| `Space` / `b`, PageDown / PageUp | Next / previous page |
| `Right` / `Left` | Next / previous page |
| `g` / `G` | First / last page |
| `:<number>` | Go to page |
| `/` | Search document text |
| `n` / `N` | Next / previous search match |
| `e` | Find an equation number |
| `c` | Find a citation key |
| `m` | Save bookmark on current page |
| `'` | Jump to a saved bookmark |
| `?` | Show key summary |
| `q` | Quit |

Lookup uses extracted PDF text. Equation lookup finds numbered equations whose extracted text contains the requested number. Citation lookup searches extracted text for the requested citation key; it does not resolve bibliography records over the network.

## Configuration

Paperterm reads `~/.config/paperterm/config.toml` on Linux and macOS, and `%APPDATA%\\paperterm\\config.toml` on Windows. A sample is in [`config.example.toml`](config.example.toml).

```toml
background = "#f7f3e8"
foreground = "#25231f"
transparent_background = true
page_width = 100
render_scale = 1.5

[palette]
"#ffffff" = "#f7f3e8"
"#000000" = "#25231f"
```

The `[palette]` table maps source RGB colors to replacement RGB colors. `transparent_background = true` renders pixels matching `background` using the terminal's default background. It preserves the terminal's configured transparency; the application cannot set operating-system or terminal-window opacity.

## Development

```console
python -m pip install -e .
python -m pdfnav --help
```

## Limits

This is a terminal page viewer. It rasterizes each page to colored Unicode half-blocks, so legibility depends on terminal dimensions, font, and true-color support. PDF text extraction quality affects search and lookup results. Encrypted PDFs requiring a password are not supported yet.

## License

MIT. See [LICENSE](LICENSE).
