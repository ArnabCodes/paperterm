import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
const pdf = await PDFDocument.create();
pdf.setTitle('Column-aware preview verification');
const font = await pdf.embedFont(StandardFonts.TimesRoman), page = pdf.addPage([612, 792]);
const text = (value, x, y, size = 10) => page.drawText(value, { x, y, size, font });
for (const xpos of [50, 323]) for (let row = 0; row < 10; row++) text('Substantial column text keeps the discussion close.', xpos, 725 - row * 14, 9);
text('E = m c^2', 100, 548, 15); text('(1)', 270, 548, 11);
text('a^2 + b^2 = c^2', 365, 548, 15); text('(2)', 555, 548, 11);
for (const xpos of [50, 323]) {
  for (let row = 0; row < 3; row++) text('A new paragraph introduces the results below.', xpos, 505 - row * 14, 9);
  page.drawRectangle({ x: xpos + 10, y: 285, width: 190, height: 160, color: rgb(.3, .55, .7) });
  text(xpos < 100 ? 'Figure 1. Left column results.' : 'Table 1. Right column results.', xpos, 265, 10);
  for (let row = 0; row < 7; row++) text('Following discussion belongs below the illustration.', xpos, 225 - row * 14, 9);
}
mkdirSync('output/playwright/fixtures', { recursive: true });
writeFileSync('output/playwright/fixtures/column-previews.pdf', await pdf.save());
console.log('Created two-column equation and graphic fixture.');
