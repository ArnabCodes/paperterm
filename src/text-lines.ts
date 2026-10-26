import type { TextLine } from './types';

export interface PositionedTextItem { text: string; x: number; y: number; width: number }
export const TEXT_LINE_LIMITS = Object.freeze({ items: 50_000, characters: 8_192, baselineTolerance: 3 });
export const TEXT_LINE_LIMITATIONS: readonly string[] = Object.freeze([
  'Heuristic horizontal single/two-column extraction, not general PDF reading-order reconstruction.',
  'Column detection needs at least three substantial rows on each side of a near-center gutter with overlapping vertical coverage.',
  'Center-spanning text rows separate column bands; image-only figures, short off-center headings, tables, RTL and rotated text may be misordered.',
  'Item and line lengths are capped; returned coordinates anchor source text rather than glyph-level citation positions.',
]);

interface Row { items: PositionedTextItem[]; y: number }
interface SplitRow extends Row { left: PositionedTextItem[]; right: PositionedTextItem[]; full: boolean }

function rightEdge(items: readonly PositionedTextItem[]): number {
  let edge = -Infinity;
  for (const item of items) edge = Math.max(edge, item.x + item.width);
  return edge;
}

function centralGap(row: Row, pageWidth: number, minimumGap: number): number | null {
  const items = row.items;
  const totalCharacters = items.reduce((total, item) => total + item.text.length, 0);
  const end = rightEdge(items);
  let prefixEnd = items[0].x + items[0].width;
  let prefixCharacters = items[0].text.length;
  let best: number | null = null;
  for (let index = 1; index < items.length; index++) {
    const item = items[index];
    const middle = (prefixEnd + item.x) / 2;
    if (item.x - prefixEnd >= minimumGap && middle >= pageWidth * 0.44 && middle <= pageWidth * 0.56
      && prefixEnd - items[0].x >= pageWidth * 0.18 && end - item.x >= pageWidth * 0.18
      && prefixCharacters >= 12 && totalCharacters - prefixCharacters >= 12
      && (best === null || Math.abs(middle - pageWidth / 2) < Math.abs(best - pageWidth / 2))) best = middle;
    prefixEnd = Math.max(prefixEnd, item.x + item.width);
    prefixCharacters += item.text.length;
  }
  return best;
}

function splitRow(row: Row, split: number, minimumGap: number): SplitRow {
  const items = row.items;
  let prefixEnd = items[0].x + items[0].width;
  let candidate = -1, distance = Infinity;
  for (let index = 1; index < items.length; index++) {
    const item = items[index];
    if (prefixEnd <= split && item.x >= split && item.x - prefixEnd >= minimumGap) {
      return { ...row, left: items.slice(0, index), right: items.slice(index), full: false };
    }
    if (prefixEnd <= split + minimumGap * 2 && item.x >= split - minimumGap * 2 && item.x - prefixEnd >= minimumGap) {
      const offset = Math.abs((prefixEnd + item.x) / 2 - split);
      if (offset < distance) { candidate = index; distance = offset; }
    }
    prefixEnd = Math.max(prefixEnd, item.x + item.width);
  }
  if (candidate >= 0) return { ...row, left: items.slice(0, candidate), right: items.slice(candidate), full: false };
  if (prefixEnd <= split) return { ...row, left: items, right: [], full: false };
  if (items[0].x >= split) return { ...row, left: [], right: items, full: false };
  return { ...row, left: [], right: [], full: true };
}

function substantial(items: readonly PositionedTextItem[], pageWidth: number): boolean {
  return items.length > 0 && rightEdge(items) - items[0].x >= pageWidth * 0.18
    && items.reduce((total, item) => total + item.text.length, 0) >= 12;
}

export function extractTextLines(items: readonly PositionedTextItem[], page: number, pageWidth: number, pageHeight: number): TextLine[] {
  if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) return [];
  const positioned = items.slice(0, TEXT_LINE_LIMITS.items)
    .map(item => ({ ...item, text: item.text.slice(0, TEXT_LINE_LIMITS.characters) }))
    .filter(item => item.text.trim() && Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isFinite(item.width) && item.width >= 0)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const rows: Row[] = [];
  for (const item of positioned) {
    const previous = rows[rows.length - 1];
    if (previous && item.y - previous.y < TEXT_LINE_LIMITS.baselineTolerance) previous.items.push(item);
    else rows.push({ items: [item], y: item.y });
  }
  const minimumGap = Math.max(8, pageWidth * 0.02);
  const gaps: number[] = [];
  for (const row of rows) {
    row.items.sort((left, right) => left.x - right.x);
    const gap = centralGap(row, pageWidth, minimumGap);
    if (gap !== null) gaps.push(gap);
  }
  gaps.sort((left, right) => left - right);
  const split = gaps.length ? gaps[Math.floor(gaps.length / 2)] : pageWidth / 2;
  const splitRows = rows.map(row => splitRow(row, split, minimumGap));
  let leftCount = 0;
  let rightCount = 0;
  let leftFirst = Infinity;
  let rightFirst = Infinity;
  let leftLast = -Infinity;
  let rightLast = -Infinity;
  for (const row of splitRows) {
    if (substantial(row.left, pageWidth)) { leftCount++; leftFirst = Math.min(leftFirst, row.y); leftLast = row.y; }
    if (substantial(row.right, pageWidth)) { rightCount++; rightFirst = Math.min(rightFirst, row.y); rightLast = row.y; }
  }
  const columns = leftCount >= 3 && rightCount >= 3 && Math.min(leftLast, rightLast) - Math.max(leftFirst, rightFirst) >= 12;
  const result: TextLine[] = [];
  const emit = (group: readonly PositionedTextItem[]) => {
    if (!group.length) return;
    const pieces: string[] = [];
    let remaining = TEXT_LINE_LIMITS.characters;
    for (const item of group) {
      const piece = item.text.slice(0, remaining);
      pieces.push(piece);
      remaining -= piece.length + 1;
      if (remaining <= 0) break;
    }
    result.push({ text: pieces.join(' '), page, x: group[0].x / pageWidth, y: group[0].y / pageHeight });
  };
  let leftBand: PositionedTextItem[][] = [];
  let rightBand: PositionedTextItem[][] = [];
  const flush = () => {
    for (const group of leftBand) emit(group);
    for (const group of rightBand) emit(group);
    leftBand = [];
    rightBand = [];
  };
  for (const row of splitRows) {
    if (!columns || row.full) {
      flush();
      emit(row.items);
    } else {
      if (row.left.length) leftBand.push(row.left);
      if (row.right.length) rightBand.push(row.right);
    }
  }
  flush();
  return result;
}
