export interface PreviewBox { x: number; y: number; width: number; height: number; text: string }
export interface PreviewCrop { x: number; y: number; width: number; height: number; column: 'left' | 'right' | 'full'; cropped: boolean }
export function detectColumns(boxes: readonly PreviewBox[]): boolean {
  const left = boxes.filter(box => box.text.trim().length >= 12 && box.width >= .16 && box.x + box.width <= .51);
  const right = boxes.filter(box => box.text.trim().length >= 12 && box.width >= .16 && box.x >= .49);
  const rows = (values: readonly PreviewBox[]) => new Set(values.map(box => Math.round(box.y * 100))).size;
  return rows(left) >= 3 && rows(right) >= 3 && Math.min(Math.max(...left.map(box => box.y)), Math.max(...right.map(box => box.y))) - Math.max(Math.min(...left.map(box => box.y)), Math.min(...right.map(box => box.y))) > .04;
}
export function previewCrop(boxes: readonly PreviewBox[], image: { data: Uint8ClampedArray; width: number; height: number }, target: { x?: number; y: number; label?: string }, fullPage = false): PreviewCrop {
  const full: PreviewCrop = { x: 0, y: 0, width: 1, height: 1, column: 'full', cropped: false };
  if (fullPage || !image.width || !image.height || !Number.isFinite(target.y)) return full;
  const equation = /equation|\beq\.?\s*[([]/i.test(target.label || ''), figure = /figure|table|\bfig\./i.test(target.label || '');
  let left = 0, right = 1, column: PreviewCrop['column'] = 'full';
  const knownX = target.x !== undefined && Number.isFinite(target.x);
  if (knownX && detectColumns(boxes)) {
    const leftBoxes = boxes.filter(box => box.x + box.width < .51 && box.y > .04 && box.y < .96);
    const rightBoxes = boxes.filter(box => box.x > .49 && box.y > .04 && box.y < .96);
    const leftEnd = Math.max(...leftBoxes.map(box => box.x + box.width)), rightStart = Math.min(...rightBoxes.map(box => box.x));
    const split = (leftEnd + rightStart) / 2;
    column = target.x! < split ? 'left' : 'right';
    const selected = boxes.filter(box => box.y > .04 && box.y < .96 && (column === 'left' ? box.x + box.width <= split : box.x >= split));
    left = Math.max(0, Math.min(...selected.map(box => box.x)) - .018);
    right = Math.min(1, Math.max(...selected.map(box => box.x + box.width)) + .018);
    const spanning = boxes.some(box => Math.abs(box.y - target.y) < .025 && box.x < leftEnd - .04 && box.x + box.width > rightStart + .04);
    const gutterStart = Math.floor((split - .008) * image.width), gutterEnd = Math.ceil((split + .008) * image.width);
    let gutterInk = 0;
    for (let ypos = Math.max(0, Math.floor((target.y - .035) * image.height)); ypos < Math.min(image.height, Math.ceil((target.y + .012) * image.height)); ypos++) {
      for (let xpos = gutterStart; xpos < gutterEnd; xpos++) if (ink(xpos, ypos)) gutterInk++;
    }
    if (spanning || gutterInk > Math.max(6, (gutterEnd - gutterStart) * image.height * .002)) { left = 0; right = 1; column = 'full'; }
  }
  function ink(xpos: number, ypos: number) {
    const index = (ypos * image.width + xpos) * 4, data = image.data;
    return data[index + 3] > 50 && Math.min(data[index], data[index + 1], data[index + 2]) < 225;
  }
  if (!equation && !figure) return { x: left, y: 0, width: right - left, height: 1, column, cropped: column !== 'full' };
  const start = Math.max(0, Math.floor(left * image.width)), end = Math.min(image.width, Math.ceil(right * image.width));
  const occupied: boolean[] = [];
  for (let ypos = 0; ypos < image.height; ypos++) {
    let count = 0;
    for (let xpos = start; xpos < end; xpos++) if (ink(xpos, ypos)) count++;
    occupied.push(count >= Math.max(2, (end - start) * .002));
  }
  const anchor = Math.max(0, Math.min(image.height - 1, Math.floor(target.y * image.height)));
  const gap = Math.max(6, Math.ceil(image.height * .009));
  let top = anchor, bottom = anchor, blank = 0;
  for (let ypos = anchor; ypos >= Math.max(0, anchor - image.height * .55); ypos--) {
    blank = occupied[ypos] ? 0 : blank + 1;
    top = ypos;
    if (blank >= gap && anchor - ypos > gap * 1.5) { top = ypos + blank; break; }
  }
  blank = 0;
  for (let ypos = anchor; ypos < Math.min(image.height, anchor + image.height * .35); ypos++) {
    blank = occupied[ypos] ? 0 : blank + 1;
    bottom = ypos;
    if (blank >= gap && ypos - anchor > gap * 1.5) { bottom = ypos - blank; break; }
  }
  if (figure) {
    const bodyAbove = boxes.filter(box => box.text.length > 40 && box.width > .15 && box.y < target.y - .04 && box.y > target.y - .55 && box.x < right && box.x + box.width > left).sort((first, second) => second.y - first.y)[0];
    top = Math.min(top, Math.max(0, Math.floor((bodyAbove ? bodyAbove.y + bodyAbove.height + .03 : target.y - .38) * image.height)));
    const captionEnd = boxes.filter(box => box.y >= target.y - .005 && box.y < Math.min(target.y + .055, bottom / image.height + .012) && box.x >= left && box.x + box.width <= right + .01);
    bottom = Math.max(bottom, ...captionEnd.map(box => (box.y + box.height) * image.height));
  }
  top = Math.max(0, top - image.height * .015); bottom = Math.min(image.height, Math.max(bottom, anchor + image.height * .018) + image.height * .015);
  if (bottom - top < image.height * .035) return { ...full, x: left, width: right - left, column, cropped: column !== 'full' };
  return { x: left, y: top / image.height, width: right - left, height: (bottom - top) / image.height, column, cropped: true };
}
