import type { TextLine } from './types';
import { escapeHtml } from './types';
import { icon } from './icons';

interface VisualModeHooks {
  lines(): readonly TextLine[];
  ready(): boolean;
  page(): number;
  offset(): number;
  highlight(): void;
  note(): void;
  toast(message: string): void;
}
export interface VisualModeController { start(): void; handleKey(event: KeyboardEvent): boolean; documentChanged(): void; active(): boolean }
interface Boundary { first: Text; last: Text }

function textBoundary(line: TextLine): Boundary | null {
  const page = document.querySelector<HTMLElement>(`#viewer .page[data-page-number="${line.page}"]`);
  const layer = page?.querySelector<HTMLElement>('.textLayer');
  if (!page || !layer) return null;
  const pageRect = page.getBoundingClientRect();
  const expectedY = pageRect.top + line.y * pageRect.height;
  const expectedX = pageRect.left + line.x * pageRect.width;
  const spans = [...layer.querySelectorAll<HTMLElement>('span')].filter(span => {
    const parent = span.parentElement;
    return !!span.textContent?.trim() && parent !== null && parent.closest('.textLayer') === layer;
  }).map(span => ({ span, rect: span.getBoundingClientRect() })).filter(item => item.rect.width && item.rect.height);
  if (!spans.length) return null;
  const best = spans.reduce((chosen, item) => {
    const score = Math.abs(item.rect.top + item.rect.height / 2 - expectedY) + Math.abs(item.rect.left - expectedX) * .08;
    const chosenScore = Math.abs(chosen.rect.top + chosen.rect.height / 2 - expectedY) + Math.abs(chosen.rect.left - expectedX) * .08;
    return score < chosenScore ? item : chosen;
  });
  const bestY = best.rect.top + best.rect.height / 2;
  const rowTolerance = Math.max(4, best.rect.height * .52);
  const sameRow = spans.filter(item => Math.abs(item.rect.top + item.rect.height / 2 - bestY) <= rowTolerance);
  const middle = pageRect.left + pageRect.width / 2;
  const rightColumn = expectedX > middle;
  const columnSpans = sameRow.filter(item => (item.rect.left + item.rect.right) / 2 > middle === rightColumn).sort((a, b) => a.rect.left - b.rect.left);
  const row = columnSpans.length ? columnSpans : sameRow.sort((a, b) => a.rect.left - b.rect.left);
  let start = row.reduce((chosen, item, index) => Math.abs(item.rect.left - expectedX) < Math.abs(row[chosen].rect.left - expectedX) ? index : chosen, 0);
  while (start > 0 && row[start].rect.left - row[start - 1].rect.right <= Math.max(8, pageRect.width * .012)) start--;
  let end = start;
  const maxGap = Math.max(14, pageRect.width * .022);
  while (end + 1 < row.length && row[end + 1].rect.left - row[end].rect.right <= maxGap) end++;
  const nodeEdge = (span: HTMLElement, first: boolean): Text | null => {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) if ((node as Text).length) nodes.push(node as Text);
    return first ? nodes[0] || null : nodes[nodes.length - 1] || null;
  };
  const first = nodeEdge(row[start].span, true), last = nodeEdge(row[end].span, false);
  return first && last ? { first, last } : null;
}

export function initializeVisualMode(hooks: VisualModeHooks): VisualModeController {
  const stage = document.querySelector<HTMLElement>('#reading-stage')!;
  const hud = document.createElement('div');
  hud.className = 'visual-mode-hud'; hud.hidden = true; hud.setAttribute('role', 'status'); hud.setAttribute('aria-live', 'polite');
  stage.append(hud);
  let enabled = false;
  let anchor = 0;
  let head = 0;

  function announce() {
    const lines = hooks.lines();
    const count = Math.abs(head - anchor) + 1;
    const selection = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() || '';
    hud.innerHTML = `<span class="visual-mode-label">${icon('keyboard')} VISUAL</span><span>${count} ${count === 1 ? 'line' : 'lines'} selected${selection ? ` · ${escapeHtml(selection.slice(0, 72))}` : ''}</span><span class="visual-mode-keys"><kbd>j/k</kbd> extend <kbd>y</kbd> copy <kbd>h</kbd> highlight <kbd>n</kbd> note <kbd>Esc</kbd> exit</span>`;
    hud.dataset.selectionCount = String(count);
    void lines;
  }

  function select() {
    const lines = hooks.lines();
    const startLine = lines[Math.min(anchor, head)], endLine = lines[Math.max(anchor, head)];
    if (!startLine || !endLine) return false;
    const first = textBoundary(startLine), last = textBoundary(endLine);
    if (!first || !last) return false;
    const range = document.createRange();
    range.setStart(first.first, 0); range.setEnd(last.last, last.last.length);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges(); selection.addRange(range);
    const target = (head >= anchor ? last.last : first.first).parentElement;
    if (target) {
      const box = target.getBoundingClientRect();
      const view = document.querySelector<HTMLElement>('#viewer-container');
      if (view && (box.top < view.getBoundingClientRect().top || box.bottom > view.getBoundingClientRect().bottom)) target.scrollIntoView({ block: 'nearest' });
    }
    announce();
    return true;
  }

  function exit(clearSelection = true) {
    enabled = false; hud.hidden = true; document.body.classList.remove('visual-mode-active');
    if (clearSelection) window.getSelection()?.removeAllRanges();
  }

  function start() {
    if (!hooks.lines().length) { hooks.toast('This PDF has no selectable text to enter visual mode.'); return; }
    if (!hooks.ready()) { hooks.toast('Pipit is still reading the PDF text. Try visual mode again in a moment.'); return; }
    const lines = hooks.lines();
    const page = hooks.page();
    const onPage = lines.map((line, index) => ({ line, index })).filter(item => item.line.page === page);
    const targetY = Math.max(0, Math.min(1, hooks.offset() + .04));
    const closest = onPage.reduce((best, item) => Math.abs(item.line.y - targetY) < Math.abs(lines[best].y - targetY) ? item.index : best, onPage[0]?.index ?? 0);
    anchor = head = closest;
    enabled = true; document.body.classList.add('visual-mode-active'); hud.hidden = false;
    if (!select()) { exit(); hooks.toast('Text for this page is still rendering. Try again in a moment.'); return; }
    hooks.toast('Visual mode · j/k selects lines, h highlights, n adds a note.');
  }

  async function copySelection() {
    const text = window.getSelection()?.toString() || '';
    if (!text.trim()) { hooks.toast('No PDF text is selected.'); return; }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove();
      if (!copied) { hooks.toast('Clipboard access is unavailable in this browser.'); return; }
    }
    hooks.toast(`${text.trim().length.toLocaleString()} characters copied.`);
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (!enabled) return false;
    if (document.querySelector('dialog[open]')) return false;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.matches('input,textarea,select,[contenteditable="true"]') && !target.matches('#tutor-keyboard,#tutor-preview-keyboard')) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'Escape' || event.key === 'v') { event.preventDefault(); event.stopImmediatePropagation(); exit(); return true; }
    const lines = hooks.lines();
    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (head < lines.length - 1 && lines[head + 1].page === lines[anchor].page) { head++; select(); }
      else hooks.toast(head < lines.length - 1 ? 'End of this page. Exit Visual mode and start again on the next page.' : 'End of the PDF’s selectable text.');
      return true;
    }
    if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (head > 0 && lines[head - 1].page === lines[anchor].page) { head--; select(); }
      else hooks.toast(head > 0 ? 'Beginning of this page. Exit Visual mode and start again on the previous page.' : 'You are at the beginning of the PDF’s selectable text.');
      return true;
    }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); event.stopImmediatePropagation(); void copySelection(); return true; }
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); event.stopImmediatePropagation(); hooks.highlight(); announce(); return true; }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); event.stopImmediatePropagation(); exit(false); hooks.note(); return true; }
    if (event.key.length === 1 || event.key.startsWith('Arrow')) { event.preventDefault(); event.stopImmediatePropagation(); return true; }
    return false;
  }

  return { start, handleKey, documentChanged: () => exit(), active: () => enabled };
}
