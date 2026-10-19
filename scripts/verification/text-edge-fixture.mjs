import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';

const document = await PDFDocument.create();
document.setTitle('Original text edge verification');
const page = document.addPage([612, 792]);
const font = await document.embedFont(StandardFonts.Helvetica);
const colors = [[0, 0, 0], [43, 51, 48], [190, 30, 40], [38, 87, 71], [20, 60, 220]];
for (const [index, color] of colors.entries()) {
  const base = 710 - index * 125;
  for (const [line, size] of [9, 12, 18].entries()) page.drawText('Research H0: sin(x) = alpha + beta, 0123456789', { x: 64, y: base - line * 28, size, font, color: rgb(...color.map(value => value / 255)) });
}
mkdirSync('output/playwright/fixtures', { recursive: true });
writeFileSync('output/playwright/fixtures/text-edges.pdf', await document.save());
