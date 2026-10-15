from __future__ import annotations

import re
from pathlib import Path

import fitz


class PdfDocument:
    def __init__(self, path: Path):
        self.path = path
        try:
            self.document = fitz.open(path)
        except (fitz.FileDataError, RuntimeError) as error:
            raise ValueError(f"Cannot open PDF: {error}") from error
        if self.document.needs_pass:
            self.document.close()
            raise ValueError("Password-protected PDFs are not supported yet")
        if not self.document.page_count:
            raise ValueError("The PDF contains no pages")
        self._text: list[str] | None = None

    @property
    def page_count(self) -> int:
        return self.document.page_count

    def page_text(self, page_number: int) -> str:
        return self.document.load_page(page_number).get_text("text")

    @property
    def all_text(self) -> list[str]:
        if self._text is None:
            self._text = [self.page_text(number) for number in range(self.page_count)]
        return self._text

    def find(self, query: str, start_page: int = 0, reverse: bool = False) -> tuple[int, str] | None:
        pages = self.all_text
        order = list(range(len(pages)))
        if reverse:
            order = list(reversed(order[:start_page + 1])) + list(reversed(order[start_page + 1:]))
        else:
            order = order[start_page + 1:] + order[:start_page + 1]
        needle = query.casefold()
        for number in order:
            if needle in pages[number].casefold():
                return number, pages[number]
        return None

    def find_equation(self, number: str, start_page: int = 0) -> int | None:
        escaped = re.escape(number.strip().strip("()[]"))
        if not escaped:
            return None
        pattern = re.compile(rf"(?:\({escaped}\)|\[{escaped}\])")
        for page_number, text in self._ordered_pages(start_page):
            if pattern.search(text):
                return page_number
        return None

    def find_citation(self, key: str, start_page: int = 0) -> int | None:
        needle = key.strip().lstrip("@").casefold()
        if not needle:
            return None
        for page_number, text in self._ordered_pages(start_page):
            if needle in text.casefold():
                return page_number
        return None

    def render(self, page_number: int, width: int, scale: float) -> tuple[int, int, bytes]:
        page = self.document.load_page(page_number)
        factor = min(scale, width / max(page.rect.width, 1))
        pixmap = page.get_pixmap(matrix=fitz.Matrix(factor, factor), alpha=False, colorspace=fitz.csRGB)
        return pixmap.width, pixmap.height, pixmap.samples

    def _ordered_pages(self, start_page: int):
        pages = self.all_text
        order = list(range(len(pages)))
        order = order[start_page + 1:] + order[:start_page + 1]
        return ((number, pages[number]) for number in order)

    def close(self) -> None:
        self.document.close()
