from __future__ import annotations

from prompt_toolkit.application import Application
from prompt_toolkit.buffer import Buffer
from prompt_toolkit.layout import Layout, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.styles import Style
from prompt_toolkit.formatted_text import FormattedText

from .config import Config, _rgb
from .document import PdfDocument


class PdfViewer:
    def __init__(self, document: PdfDocument, config: Config):
        self.document = document
        self.config = config
        self.page = 0
        self.scroll = 0
        self.message = "? for help"
        self.matches: list[int] = []
        self.match_index = -1
        self.bookmarks: list[int] = []
        self.prompt = Buffer()
        self.control = FormattedTextControl(self._content, focusable=False)
        self.application = Application(
            layout=Layout(Window(self.control, wrap_lines=False)),
            key_bindings=self._bindings(),
            full_screen=True,
            mouse_support=False,
            style=Style.from_dict({"status": f"fg:{config.foreground.removeprefix('#')} bg:{config.background.removeprefix('#')}"}),
        )

    def run(self) -> None:
        self.application.run()

    def _content(self):
        height, width = self.application.output.get_size().rows, self.application.output.get_size().columns
        usable_rows = max(1, height - 1)
        page_width = min(self.config.page_width, max(24, width - 1))
        image_width, image_height, data = self.document.render(self.page, page_width, self.config.render_scale)
        rows = self._pixels_to_rows(image_width, image_height, data, page_width)
        max_scroll = max(0, len(rows) - usable_rows)
        self.scroll = min(self.scroll, max_scroll)
        visible = rows[self.scroll:self.scroll + usable_rows]
        fragments = []
        for row in visible:
            fragments.extend(row)
            fragments.append(("", "\n"))
        status = f" {self.document.path.name} | Page {self.page + 1}/{self.document.page_count} | {self.message} | q quit "
        fragments.append(("class:status", status[:width].ljust(width)))
        return FormattedText(fragments)

    def _pixels_to_rows(self, source_width: int, source_height: int, samples: bytes, target_width: int):
        from PIL import Image

        image = Image.frombytes("RGB", (source_width, source_height), samples)
        target_height = max(1, round(source_height * target_width / source_width))
        image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        pixels = image.load()
        rows = []
        background = _rgb(self.config.background)
        foreground = _rgb(self.config.foreground)
        palette = {_rgb(key): _rgb(value) for key, value in self.config.palette.items()}

        def replace(color):
            if color in palette:
                return palette[color]
            if color == (255, 255, 255):
                return background
            if color == (0, 0, 0):
                return foreground
            return color

        for y in range(0, target_height, 2):
            fragments = []
            for x in range(target_width):
                top = replace(pixels[x, y])
                bottom = replace(pixels[x, y + 1]) if y + 1 < target_height else background
                top_clear = self.config.transparent_background and top == background
                bottom_clear = self.config.transparent_background and bottom == background
                if top_clear and bottom_clear:
                    fragments.append(("", " "))
                    continue
                if top_clear:
                    fragments.append((f"fg:#{_hex(bottom)} bg:default", "▄"))
                elif bottom_clear:
                    fragments.append((f"fg:#{_hex(top)} bg:default", "▀"))
                else:
                    fragments.append((f"fg:#{_hex(top)} bg:#{_hex(bottom)}", "▀"))
            rows.append(fragments)
        return rows

    def _bindings(self):
        bindings = KeyBindings()

        @bindings.add("q")
        def quit_view(event):
            event.app.exit()

        @bindings.add("j")
        @bindings.add("down")
        def scroll_down(event):
            self.scroll += 1
            event.app.invalidate()

        @bindings.add("k")
        @bindings.add("up")
        def scroll_up(event):
            self.scroll = max(0, self.scroll - 1)
            event.app.invalidate()

        @bindings.add("right")
        @bindings.add("pagedown")
        @bindings.add(" ")
        @bindings.add("b")
        def next_page(event):
            self._set_page(self.page + 1)

        @bindings.add("left")
        @bindings.add("pageup")
        def previous_page(event):
            self._set_page(self.page - 1)

        @bindings.add("g")
        def first_page(event):
            self._set_page(0)

        @bindings.add("G")
        def last_page(event):
            self._set_page(self.document.page_count - 1)

        @bindings.add("/")
        def search(event):
            self._ask(event, "Search text: ", self._search)

        @bindings.add("n")
        def next_match(event):
            if self.matches:
                self.match_index = (self.match_index + 1) % len(self.matches)
                self._set_page(self.matches[self.match_index])

        @bindings.add("N")
        def previous_match(event):
            if self.matches:
                self.match_index = (self.match_index - 1) % len(self.matches)
                self._set_page(self.matches[self.match_index])

        @bindings.add("e")
        def equation(event):
            self._ask(event, "Equation number: ", self._equation)

        @bindings.add("c")
        def citation(event):
            self._ask(event, "Citation key: ", self._citation)

        @bindings.add("m")
        def mark(event):
            if self.page not in self.bookmarks:
                self.bookmarks.append(self.page)
            self.message = f"Bookmark saved at page {self.page + 1}"
            event.app.invalidate()

        @bindings.add("'")
        def jump_bookmark(event):
            self._ask(event, "Bookmark number: ", self._bookmark)

        @bindings.add("?")
        def help_keys(event):
            self.message = "j/k scroll  Space/Arrows pages  g/G ends  / search  e equation  c cite  m mark  ' jump  q quit"
            event.app.invalidate()

        @bindings.add(":")
        def page_prompt(event):
            self._ask(event, "Page: ", self._page_number)

        return bindings

    def _ask(self, event, prompt_text, callback):
        from prompt_toolkit.shortcuts import prompt as ask

        with event.app.suspend_to_background():
            value = ask(prompt_text)
        callback(value)
        event.app.invalidate()

    def _search(self, query):
        self.matches = [index for index, text in enumerate(self.document.all_text) if query.casefold() in text.casefold()]
        self.match_index = 0 if self.matches else -1
        if self.matches:
            self._set_page(self.matches[0])
            self.message = f"{len(self.matches)} matching pages"
        else:
            self.message = f"No match for {query!r}"

    def _equation(self, number):
        page = self.document.find_equation(number, self.page)
        self._lookup_result(page, f"equation ({number})")

    def _citation(self, key):
        page = self.document.find_citation(key, self.page)
        self._lookup_result(page, f"citation {key}")

    def _lookup_result(self, page, label):
        if page is None:
            self.message = f"No {label} found"
        else:
            self._set_page(page)
            self.message = f"Found {label} on page {page + 1}"

    def _bookmark(self, value):
        try:
            index = int(value) - 1
            self._set_page(self.bookmarks[index])
        except (ValueError, IndexError):
            self.message = "No bookmark with that number"

    def _page_number(self, value):
        try:
            self._set_page(int(value) - 1)
        except ValueError:
            self.message = "Enter a page number"

    def _set_page(self, page):
        self.page = max(0, min(self.document.page_count - 1, page))
        self.scroll = 0
        self.application.invalidate()


def _hex(rgb):
    return "".join(f"{channel:02x}" for channel in rgb)
