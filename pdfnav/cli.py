from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .config import load_config
from .document import PdfDocument
from .view import PdfViewer


def main() -> int:
    parser = argparse.ArgumentParser(prog="paperterm", description="Keyboard-driven PDF reader for the terminal")
    parser.add_argument("pdf", nargs="?", type=Path, help="PDF file to open")
    parser.add_argument("--version", action="version", version=f"paperterm {__version__}")
    parser.add_argument("--config", type=Path, help="use a specific TOML configuration file")
    args = parser.parse_args()
    if args.pdf is None:
        parser.print_help()
        return 0
    if not args.pdf.is_file():
        parser.error(f"PDF does not exist: {args.pdf}")
    try:
        config = load_config(args.config)
        document = PdfDocument(args.pdf)
        try:
            PdfViewer(document, config).run()
        finally:
            document.close()
    except (OSError, ValueError, RuntimeError) as error:
        print(f"paperterm: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
