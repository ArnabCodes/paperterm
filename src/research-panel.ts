import { element, escapeHtml as esc } from './types';
import { icon } from './icons';
import { extractSelectionIdentifiers, type DocumentMap, type ResearchReference } from './research';

interface ResearchHooks {
  map(): DocumentMap;
  ready(): boolean;
  show(dialog: string): void;
  close(dialog: HTMLDialogElement): void;
  peek(target: { page: number; y: number; x?: number; label: string; citation?: string }): void;
  jump(page: number, y: number): void;
  toast(message: string): void;
}

export function initializeResearch(hooks: ResearchHooks) {
  const dialog = element<HTMLDialogElement>('#research-dialog');
  const filter = element<HTMLInputElement>('#research-filter');
  let selectedId = '';
  let visible: ResearchReference[] = [];

  function references(): ResearchReference[] {
    const map = hooks.map();
    const unresolved = new Map<string, ResearchReference>(map.unresolvedReferenceIds.map(id => [id, { id, label: `[${id.split(':')[1]}]`, page: 0, x: 0, y: 0, lineIndex: -1, text: 'Bibliography entry not located', lineIndices: [], definitions: [], mentions: [] }]));
    for (const mention of map.mentions) unresolved.get(mention.referenceId)?.mentions.push(mention);
    return [...map.references, ...unresolved.values()];
  }

  function graph(reference: ResearchReference | undefined) {
    const map = hooks.map();
    const entries = visible.slice(0, 14);
    if (reference && !entries.includes(reference)) { entries.pop(); entries.push(reference); }
    const ids = new Set(entries.map(entry => entry.id));
    const edges = map.edges.filter(edge => ids.has(edge.referenceId));
    const pages = [...new Set(edges.map(edge => edge.page))].sort((left, right) => left - right).slice(0, 18);
    const ypos = (index: number, length: number) => 28 + index * (304 / Math.max(1, length - 1));
    const nodes = entries.map((entry, index) => `<g class="graph-node ${entry.id === selectedId ? 'selected' : ''}" tabindex="0" role="button" aria-label="Reference ${esc(entry.label)}, ${entry.mentions.length} mentions" data-reference="${esc(entry.id)}"><title>${esc(entry.text.slice(0, 180))}</title><circle cx="402" cy="${ypos(index, entries.length)}" r="${7 + Math.min(5, Math.sqrt(entry.mentions.length))}"/><text x="424" y="${ypos(index, entries.length) + 4}">${esc(entry.label)}</text></g>`);
    const paths = edges.filter(edge => pages.includes(edge.page)).map(edge => {
      const start = ypos(pages.indexOf(edge.page), pages.length);
      const end = ypos(entries.findIndex(entry => entry.id === edge.referenceId), entries.length);
      return `<path class="graph-edge ${edge.referenceId === selectedId ? 'active' : ''}" d="M 86 ${start} C 210 ${start}, 270 ${end}, 402 ${end}"/>`;
    });
    const pageNodes = pages.map((page, index) => `<g class="graph-node" tabindex="0" role="button" aria-label="Go to citing page ${page}" data-graph-page="${page}"><circle cx="86" cy="${ypos(index, pages.length)}" r="7"/><text x="16" y="${ypos(index, pages.length) + 4}">Page ${page}</text></g>`);
    element('#citation-graph').innerHTML = [...paths, ...pageNodes, ...nodes].join('');
    element('.graph-caption').textContent = edges.length ? `Pages → references · ${pages.length} pages, ${entries.length} references shown. Filter to explore more.` : 'No numeric citation connections found. Try a paper with [number] citations.';
  }

  function backlinks(reference: ResearchReference | undefined) {
    const panel = element('#research-backlinks');
    if (!reference) { panel.innerHTML = ''; return; }
    const identifier = extractSelectionIdentifiers(reference.text)[0];
    panel.innerHTML = `<div class="backlink-heading"><h3>${esc(reference.label)} · ${reference.mentions.length} ${reference.mentions.length === 1 ? 'mention' : 'mentions'}</h3><div class="preview-actions">${reference.page ? '<button class="text-button" data-research-action="peek">Quick look</button>' : ''}<button class="text-button" data-research-action="copy" aria-label="Copy reference">${icon('copy')}</button>${identifier ? `<button class="text-button" data-research-action="identifier" title="Open ${esc(identifier.kind)} in a new tab">${esc(identifier.kind.toUpperCase())} ${icon('arrow')}</button>` : ''}${reference.page ? '<button class="text-button" data-research-action="scholar" title="Search this reference in Google Scholar">Scholar ↗</button>' : ''}</div></div><div class="backlink-list">${reference.mentions.length ? reference.mentions.slice(0, 200).map((mention, index) => `<button class="backlink" data-mention="${index}"><span>Page ${mention.page}</span><span>${esc(mention.text)}</span>${icon('arrow')}</button>`).join('') : '<p class="research-summary">No numeric mentions located in this document.</p>'}</div>`;
  }

  function render() {
    const map = hooks.map();
    const terms = filter.value.trim().toLowerCase().split(/\s+/);
    visible = references().filter(reference => terms.every(term => `${reference.label} ${reference.text}`.toLowerCase().includes(term)));
    if (!visible.some(reference => reference.id === selectedId)) selectedId = visible.find(reference => reference.page && reference.mentions.length)?.id || visible[0]?.id || '';
    const reference = visible.find(entry => entry.id === selectedId);
    element('#research-summary').textContent = `${map.references.length} bibliography entries · ${map.mentions.length} numeric mentions · ${map.pages.filter(page => page.citationCount).length} citing pages${hooks.ready() ? '' : ' · Indexing…'}. Local numeric matching can include code/math; inspect the passage. Author–year citations and scans are not mapped.${map.truncated ? ' Large input was clipped.' : ''}`;
    element('#research-references').innerHTML = visible.length ? visible.slice(0, 300).map(entry => `<button class="reference-card" data-reference="${esc(entry.id)}" aria-pressed="${entry.id === selectedId}"><span class="reference-label">${esc(entry.label)}</span><span><p>${esc(entry.text.replace(/^\s*\[\d+\]\s*/, '').slice(0, 300))}</p><small>${entry.page ? `Bibliography p. ${entry.page}` : 'Unresolved numeric marker'} · ${entry.mentions.length} mentions</small></span></button>`).join('') : '<p class="empty-state">No references match. Numeric [1] style citations work best.</p>';
    graph(reference); backlinks(reference);
  }

  function select(id: string) {
    const graphFocused = element('#citation-graph').contains(document.activeElement);
    selectedId = id;
    element('#research-references').querySelectorAll<HTMLElement>('[data-reference]').forEach(card => card.setAttribute('aria-pressed', String(card.dataset.reference === id)));
    const reference = visible.find(entry => entry.id === id);
    graph(reference); backlinks(reference);
    if (graphFocused) [...element('#citation-graph').querySelectorAll<SVGElement>('[data-reference]')].find(node => node.dataset.reference === id)?.focus({ preventScroll: true });
  }

  dialog.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-reference], [data-mention], [data-graph-page], [data-research-action]') : null;
    if (!target) return;
    if (target.dataset.reference) { select(target.dataset.reference); return; }
    const reference = visible.find(entry => entry.id === selectedId);
    if (target.dataset.graphPage) { hooks.close(dialog); hooks.jump(Number(target.dataset.graphPage), 0); return; }
    if (!reference) return;
    if (target.dataset.mention !== undefined) {
      const mention = reference.mentions[Number(target.dataset.mention)];
      if (mention) { hooks.close(dialog); hooks.jump(mention.page, mention.y); }
    }
    if (target.dataset.researchAction === 'peek') { hooks.close(dialog); hooks.peek({ page: reference.page, y: reference.y, x: reference.x, label: `Reference ${reference.label}`, citation: reference.label.replace(/[\[\]]/g, '') }); }
    if (target.dataset.researchAction === 'copy') {
      if (navigator.clipboard) void navigator.clipboard.writeText(reference.text).then(() => hooks.toast('Reference copied.')).catch(() => hooks.toast('Clipboard access is unavailable in this browser.'));
      else hooks.toast('Clipboard access is unavailable in this browser.');
    }
    if (target.dataset.researchAction === 'identifier') { const identifier = extractSelectionIdentifiers(reference.text)[0]; if (identifier) window.open(identifier.url, '_blank', 'noopener,noreferrer'); }
    if (target.dataset.researchAction === 'scholar') window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(reference.text.slice(0, 1800))}`, '_blank', 'noopener,noreferrer');
  });
  element('#citation-graph').addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key !== 'Enter' && (event as KeyboardEvent).key !== ' ') return;
    const target = event.target as HTMLElement;
    if (target.dataset.reference) { event.preventDefault(); select(target.dataset.reference); }
    if (target.dataset.graphPage) { event.preventDefault(); hooks.close(dialog); hooks.jump(Number(target.dataset.graphPage), 0); }
  });
  filter.addEventListener('input', render);
  return {
    open(label?: string) {
      filter.value = '';
      selectedId = label ? `reference:${label.replace(/[\[\]]/g, '')}` : '';
      render();
      if (!dialog.open) hooks.show('#research-dialog');
      filter.focus();
    },
    update() { if (dialog.open) render(); },
    reset() { if (dialog.open) dialog.close(); selectedId = ''; },
  };
}
