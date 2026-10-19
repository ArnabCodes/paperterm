import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from 'pdf-lib';

mkdirSync('public/vendor', { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(`node_modules/pdfjs-dist/${folder}`, `public/vendor/${folder}`, { recursive: true });
cpSync('node_modules/pdfjs-dist/LICENSE', 'public/vendor/PDFJS-LICENSE');
cpSync('node_modules/pdfjs-dist/web/images', 'public/vendor/images', { recursive: true });

const pdf = await PDFDocument.create();
pdf.setTitle('The art of following an idea');
pdf.setAuthor('Paperterm');
pdf.setSubject('An original interactive field guide to reading in Paperterm');
const roman = await pdf.embedFont(StandardFonts.TimesRoman);
const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
const sans = await pdf.embedFont(StandardFonts.Helvetica);
const mono = await pdf.embedFont(StandardFonts.Courier);
const ink = rgb(0.17, 0.2, 0.19);
const muted = rgb(0.4, 0.44, 0.42);
const green = rgb(0.15, 0.34, 0.28);
const pages = Array.from({ length: 6 }, () => pdf.addPage([612, 792]));
function text(page, value, x, y, size = 12, font = roman, color = ink) {
  page.drawText(value, { x, y, size, font, color });
}
function paragraph(page, value, y) {
  const words = value.split(' ');
  let line = '';
  for (const word of words) {
    if (roman.widthOfTextAtSize(line + ' ' + word, 12) > 460) {
      text(page, line, 76, y); y -= 19; line = word;
    } else line = line ? line + ' ' + word : word;
  }
  if (line) text(page, line, 76, y);
  return y - 32;
}
pages.forEach((page, index) => {
  text(page, 'P A P E R T E R M   /   F I E L D   N O T E S', 76, 750, 8, sans, muted);
  page.drawLine({ start: { x: 76, y: 735 }, end: { x: 536, y: 735 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.79) });
  text(page, 'A quiet workspace for complex ideas', 76, 39, 8, sans, muted);
  text(page, String(index + 1).padStart(2, '0'), 520, 39, 9, mono, muted);
});
const page = pages[0];
text(page, 'The art of', 76, 666, 40, roman);
text(page, 'following an idea', 76, 617, 40, italic);
text(page, 'A FIELD GUIDE TO READING WITH PAPERTERM', 77, 576, 9, sans, green);
text(page, 'Paperterm  /  Reading tools  /  October 2026', 77, 548, 9, sans, muted);
text(page, 'Abstract', 76, 492, 13, bold);
let y = paragraph(page, 'Reading a technical paper is rarely a straight line. An equation points to a definition; a citation opens another conversation. This guide is a small, real PDF for exploring a workspace that keeps those connections close and your place intact.', 469);
text(page, '1. Read at the speed of thought', 76, y - 10, 20, bold);
y = paragraph(page, 'Start with the page. The interface stays at its edges, leaving a generous space for text, diagrams, and the pauses between them. Scroll with j and k. Press / to search, and n to move through matches. Use the command palette whenever a shortcut escapes you.', y - 40);
y = paragraph(page, 'The value of a reading tool is not how many controls it shows. It is how easily you can follow an idea and return. The simple model in equation (2) illustrates this workflow. The bibliography entry [1] is another place to begin.', y);
text(page, 'Try it: press e, enter 2, then press Enter to peek.', 76, y - 4, 11, italic, green);
text(pages[1], '2. A map, not a maze', 76, 673, 29, roman);
y = paragraph(pages[1], 'Open the document outline with t. Chapters give you a map, while bookmarks leave a trail of your own. Press b to bookmark a page, m followed by a letter to set a named mark, and apostrophe followed by that letter to return.', 624);
y = paragraph(pages[1], 'Navigation has a history. After following a reference or jumping to another page, press Alt+Left to return to the exact scroll position you left. Alt+Right retraces your path. Page numbers are one-based, just as they appear in the toolbar.', y);
text(pages[1], 'Keyboard essentials', 76, y - 15, 17, bold);
[['j / k', 'Scroll down / up'], ['Ctrl+d / Ctrl+u', 'Move half a viewport'], ['gg / G', 'First / last page'], [':', 'Go to a page number'], ['e / c', 'Equation / citation lookup'], ['f / Shift+f', 'Follow a link / preview a link'], ['Ctrl+k', 'Search every command']].forEach(([key, help], index) => {
  text(pages[1], key, 76, y - 56 - index * 31, 11, mono, green);
  text(pages[1], help, 255, y - 56 - index * 31, 12);
});
text(pages[2], '3. Keep the context', 76, 673, 29, roman);
y = paragraph(pages[2], 'A reference preview is a second view into the same document. The main page stays exactly where it is. Open a preview from an equation or citation result, inspect the original typesetting, and press Escape to return to reading.', 624);
text(pages[2], 'A small model', 76, y - 15, 18, bold);
y = paragraph(pages[2], 'For this illustrative example, let the reading time be composed of time spent understanding an idea and time spent finding its context. This is a demonstration of navigation, not an empirical result.', y - 43);
text(pages[2], 'T = T_read + T_find', 169, y - 25, 19, italic);
text(pages[2], '(1)', 511, y - 25, 12);
text(pages[2], 'T_find = N_jumps x t_return', 133, y - 95, 19, italic);
text(pages[2], '(2)', 511, y - 95, 12);
y = paragraph(pages[2], 'Equation (2) makes the motivation concrete: a tool that keeps a return path can make navigation less disruptive. Use Shift+Enter in the lookup panel to jump to the original location instead of opening a preview.', y - 151);
text(pages[2], 'A reference is most useful when the way back is obvious.', 76, y - 20, 14, italic, green);
text(pages[3], '4. Follow the connections', 76, 673, 29, roman);
y = paragraph(pages[3], 'PDFs come in many forms. Some contain proper internal links, bookmarks, and selectable text. Others are scanned images. Paperterm follows embedded links directly and uses extracted text to find likely equation numbers, figure captions, and bibliography entries.', 624);
for (let index = 0; index < 3; index++) {
  const xpos = 76 + index * 164;
  pages[3].drawRectangle({ x: xpos, y: 343, width: 132, height: 94, color: rgb(0.93, 0.95, 0.92), borderWidth: 0.7, borderColor: rgb(0.7, 0.77, 0.7) });
  text(pages[3], ['READ', 'PEEK', 'RETURN'][index], xpos + 30, 383, 12, sans, green);
  if (index < 2) text(pages[3], '>', xpos + 143, 383, 15, mono, green);
}
text(pages[3], 'Figure 1. The reading loop: context stays within reach.', 76, 312, 12, italic);
y = paragraph(pages[3], 'Press v to look up figure captions. Press f to label the links on the visible pages, then type the hint to follow one. Shift+f opens an internal link in the preview pane. The same actions are available from the command palette.', 269);
text(pages[4], '5. Make room for focus', 76, 673, 29, roman);
y = paragraph(pages[4], 'Paper, Sepia, and Night change the workspace and document colors. Open Reading settings to choose your own foreground and background, preserve the original page colors, or map individual colors to a replacement palette.', 624);
y = paragraph(pages[4], 'Press z to hide the toolbars and sidebar. A small exit control remains, and z brings the interface back. Press r for a reading ruler and move it with the bracket keys. Use + and - to zoom, w to fit the width, and a to fit a whole page.', y);
y = paragraph(pages[4], 'Your reading position, named marks, and bookmarks stay in this browser. Documents are not uploaded. Download saves the original PDF. The standalone web app opens local PDFs; the Chrome extension can also intercept normal PDF navigations.', y);
text(pages[4], 'A note on trust', 76, y - 10, 18, bold);
paragraph(pages[4], 'Text-based lookup is a useful shortcut, not a semantic proof. Check the preview before relying on a reference. Image-only documents need OCR from another tool before text search or equation lookup can work.', y - 38);
text(pages[5], 'References & further reading', 76, 673, 27, roman);
text(pages[5], '[1] Bush, V. As We May Think. The Atlantic, 1945.', 76, 610, 12);
text(pages[5], '[2] Engelbart, D. C. Augmenting Human Intellect. SRI, 1962.', 76, 569, 12);
text(pages[5], '[3] Sioyek. Documentation: commands and reference navigation.', 76, 528, 12);
text(pages[5], '[4] Mozilla. PDF.js: a general-purpose platform for parsing PDFs.', 76, 487, 12);
paragraph(pages[5], 'This field guide is original demo content. The numbered equations are deliberately simple so that you can explore reference lookup, previews, and navigation history before opening your own research.', 407);
text(pages[5], 'Your next paper is one shortcut away.', 76, 276, 22, italic, green);
text(pages[5], 'Press o to open a PDF from your computer.', 76, 241, 12);
function link(source, target, rect, top) {
  const ref = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], Dest: [pages[target].ref, 'XYZ', 0, top, null] }));
  const annotations = source.node.lookup(PDFName.of('Annots')) || pdf.context.obj([]);
  annotations.push(ref); source.node.set(PDFName.of('Annots'), annotations);
}
link(pages[0], 2, [76, 100, 300, 125], 550);
link(pages[0], 5, [310, 100, 535, 125], 640);
text(pages[0], 'Open equation (2)', 76, 108, 10, sans, green);
text(pages[0], 'Open reference [1]', 320, 108, 10, sans, green);
const outline = pdf.context.register(pdf.context.obj({ Type: 'Outlines' }));
const titles = ['1. Read at the speed of thought', '2. A map, not a maze', '3. Keep the context', '4. Follow the connections', '5. Make room for focus', 'References & further reading'];
const entries = titles.map((title, index) => pdf.context.register(pdf.context.obj({ Title: PDFString.of(title), Parent: outline, Dest: [pages[index].ref, 'Fit'] })));
entries.forEach((ref, index) => {
  const dictionary = pdf.context.lookup(ref);
  if (index) dictionary.set(PDFName.of('Prev'), entries[index - 1]);
  if (index + 1 < entries.length) dictionary.set(PDFName.of('Next'), entries[index + 1]);
});
const root = pdf.context.lookup(outline);
root.set(PDFName.of('First'), entries[0]); root.set(PDFName.of('Last'), entries.at(-1)); root.set(PDFName.of('Count'), pdf.context.obj(entries.length));
pdf.catalog.set(PDFName.of('Outlines'), outline);
writeFileSync('public/sample.pdf', await pdf.save());

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
for (const size of [16, 48, 128]) {
  const data = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const xpos = column / size; const ypos = row / size;
    const page = xpos > .29 && xpos < .71 && ypos > .23 && ypos < .77;
    const stroke = page && (xpos < .33 || xpos > .67 || ypos < .27 || ypos > .73 || (xpos > .39 && xpos < .6 && ((ypos > .45 && ypos < .49) || (ypos > .57 && ypos < .61))));
    const offset = row * (size * 4 + 1) + 1 + column * 4;
    data.set(stroke ? [246, 244, 236, 255] : [37, 76, 67, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  writeFileSync(`public/icon${size}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]));
}
console.log('Bundled PDF fonts, character maps, decoders, icons, and the original field guide.');
