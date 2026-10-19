import { PDFDocument, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';

const document = await PDFDocument.create();
document.setTitle('Original palette verification swatches');
const page = document.addPage([612, 792]);
for (const [index, color] of [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)].entries()) page.drawRectangle({ x: 72 + 156 * index, y: 420, width: 120, height: 120, color });
page.drawRectangle({ x: 72, y: 240, width: 120, height: 120, color: rgb(0, 0, 0) });
mkdirSync('output/playwright/fixtures', { recursive: true });
writeFileSync('output/playwright/fixtures/palette.pdf', await document.save());
