import { element, escapeHtml as esc } from './types';
import { OpenAlexClient, citationLayers, citationRate, safePdfUrl, matchPaperCandidates, type CitationDirection, type FieldNetwork, type FieldWork } from './citation-network';
import { readStored, saveStored } from './preferences';
import { icon } from './icons';
import { discoverPublisherPdfs, type PublisherPdf } from './publisher-pdf';

interface FieldHooks { show(id: string): void; local(): void; suggestion(): Promise<string>; documentId(): string; doi(): Promise<string>; }
export function initializeFieldMap(hooks: FieldHooks) {
  const dialog = document.createElement('dialog');
  dialog.id = 'field-dialog'; dialog.setAttribute('aria-labelledby', 'field-title');
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">FOLLOW THE RESEARCH</span><h2 id="field-title">Citation map</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close citation map">${icon('close')}</button></div>
    <details class="field-identification" open><summary>Identify or change paper</summary><p class="field-consent">OpenAlex receives the paper title or DOI when you open this explorer, never PDF bytes or notes. Exact matches open directly; ambiguous matches need your confirmation.</p><form id="field-search"><label for="field-query">Paper title, DOI, or OpenAlex ID</label><div><input id="field-query" type="search" maxlength="500" autocomplete="off" required/><button class="primary" type="submit">Search OpenAlex</button></div></form><label class="field-auto"><input id="field-auto" type="checkbox" checked> Identify papers automatically when opening this explorer</label><div id="field-results"></div></details>
    <div class="field-toolbar" hidden><label>Connections <select id="field-direction"><option value="both">References &amp; citing papers</option><option value="references">References this paper cites</option><option value="citations">Papers citing this paper</option></select></label><label class="field-depth-control">Hops <input id="field-depth" type="range" min="1" max="3" step="1" value="1" aria-label="Citation separation"><output id="field-depth-value" for="field-depth">1</output></label><button id="field-view" class="text-button" aria-pressed="false">List view</button></div>
    <p id="field-status" role="status" aria-live="polite">No network request until you open this explorer.</p><div id="field-map" hidden><div class="field-graphic"><svg id="field-svg" viewBox="0 0 1000 610" role="group" aria-label="Citation network: arrows point from citing paper to cited paper"></svg><div id="field-list" hidden role="group" aria-label="Papers in citation network"></div></div><div id="field-details"></div></div>
    <details id="field-tools"><summary>Filter, sources &amp; more</summary><div class="field-more-tools"><label id="field-filter-label">Filter map <input id="field-filter" type="search" placeholder="Title, author, topic…"/></label><label><input id="field-related" type="checkbox"> Include related work (not citation links)</label><button class="text-button" id="field-refresh" hidden>Refresh from OpenAlex</button><button class="text-button" id="field-local">Within-PDF references &amp; backlinks</button></div><p class="field-provenance" id="field-provenance"></p></details>`;
  document.body.append(dialog);
  dialog.querySelector('.field-consent')!.textContent += ' If the selected paper has no indexed PDF, Pipit checks its publisher page using available browser credentials. Publisher links can require institutional access; no PDF bytes or notes are sent to OpenAlex.';
  const query = element<HTMLInputElement>('#field-query'), status = element('#field-status'), results = element('#field-results');
  const identify = dialog.querySelector<HTMLDetailsElement>('.field-identification')!;
  const automatic = element<HTMLInputElement>('#field-auto');
  automatic.checked = readStored<boolean>('pipit.field.auto', true) !== false;
  automatic.addEventListener('change', () => saveStored('pipit.field.auto', automatic.checked));
  const direction = element<HTMLSelectElement>('#field-direction'), depth = element<HTMLInputElement>('#field-depth');
  const filter = element<HTMLInputElement>('#field-filter'), related = element<HTMLInputElement>('#field-related');
  const client = new OpenAlexClient();
  let controller = new AbortController(), generation = 0, candidates: FieldWork[] = [], network: FieldNetwork | null = null, baseNetwork: FieldNetwork | null = null, selected = '', listView = false;
  let matchNote = '';
  const publisherLinks = new Map<string, PublisherPdf[]>(), publisherErrors = new Map<string, string>();
  let publisherController = new AbortController(), publisherSelected = '';
  function publisherActions(work: FieldWork) {
    const links = publisherLinks.get(work.id) || [];
    const pdf = safePdfUrl(work.pdfUrl) || links[0]?.url;
    const source = safePdfUrl(work.doi) || safePdfUrl(work.landingUrl);
    if (source && !pdf && publisherSelected !== work.id && !publisherErrors.has(work.id)) {
      publisherController.abort(); publisherController = new AbortController(); publisherSelected = work.id;
      const signal = publisherController.signal;
      void discoverPublisherPdfs(source, signal).then(found => { if (!signal.aborted) publisherLinks.set(work.id, found); }).catch(error => { if (!signal.aborted) publisherErrors.set(work.id, (error as Error).message); }).finally(() => {
        if (!signal.aborted && selected === work.id && dialog.open) element('#field-pdf-actions').innerHTML = publisherActions(work);
      });
    }
    const viewer = pdf ? new URL(`?file=${encodeURIComponent(pdf)}`, location.href).href : '';
    return `${pdf ? `<a class="secondary" href="${esc(viewer)}" target="_blank" rel="noopener noreferrer">${icon('document')} Open PDF ↗</a><small>${links.length ? esc(links[0].evidence) + ' · access checked when opened' : 'OpenAlex PDF link · may require institutional access'}</small>` : `<span class="field-no-pdf" role="status">${esc(publisherErrors.get(work.id) || (source ? 'Looking for publisher PDF…' : 'No PDF or publisher URL indexed'))}</span>`}${publisherErrors.has(work.id) ? `<a class="secondary" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Open publisher ↗</a><button class="text-button" data-publisher-retry="${work.id}">Retry publisher lookup</button>` : ''}`;
  }
  const cancel = () => { controller.abort(); controller = new AbortController(); generation++; };
  const cacheKey = (id: string) => `pipit.field.v1:${id}`;
  const nodeRadius = (work: FieldWork) => 6 + Math.sqrt(Math.log1p(citationRate(work))) * 2.8;
  const expandedKey = (id: string) => `pipit.field.v2:${id}:${direction.value}:${depth.value}`;
  const associationKey = () => `pipit.field.paper:${hooks.documentId()}`;
  function cachedNetwork(key: string, id: string) {
    const value = readStored<FieldNetwork | null>(key, null);
    return value?.seed?.id === id && Array.isArray(value.works) && Array.isArray(value.edges) && Array.isArray(value.warnings) && Date.now() - Date.parse(value.fetchedAt) < 86400000 ? value : null;
  }
  function visibleNodes() {
    if (!network) return [];
    const layers = citationLayers(network, direction.value as CitationDirection, Number(depth.value));
    const term = filter.value.toLowerCase().trim();
    const works = network.works.filter(work => work.id === network!.seed.id || ((layers.has(work.id) || (related.checked && network!.related.includes(work.id))) && `${work.title} ${work.authors.join(' ')} ${work.topic}`.toLowerCase().includes(term)));
    const nodes = works.map(work => ({ work, ...(layers.get(work.id) || { depth: 1, group: 'related' }), x: 500, y: 295 }));
    for (const group of ['reference', 'citation', 'related']) for (let order = 1; order <= 3; order++) {
      const ring = nodes.filter(node => node.group === group && node.depth === order).sort((first, second) => first.work.id.localeCompare(second.work.id));
      ring.forEach((node, index) => {
        const angle = direction.value !== 'both' && group !== 'related' ? -Math.PI / 2 + (index + .5) / ring.length * Math.PI * 2 : group === 'reference' ? Math.PI / 2 + (index + .5) / ring.length * Math.PI : group === 'citation' ? -Math.PI / 2 + (index + .5) / ring.length * Math.PI : Math.PI * 2 * index / ring.length;
        const radius = group === 'related' ? 420 : 185 + (order - 1) * 105;
        node.x = 500 + Math.cos(angle) * radius;
        node.y = 295 + Math.sin(angle) * radius * .65;
      });
    }
    return nodes;
  }
  function render() {
    if (!network) return;
    const positions = visibleNodes(), points = new Map(positions.map(node => [node.work.id, node]));
    if (!points.has(selected)) selected = network.seed.id;
    const edges = network.edges.filter(edge => points.has(edge.from) && points.has(edge.to));
    const paths = edges.map(edge => {
      const start = points.get(edge.from)!, end = points.get(edge.to)!;
      const control = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 20 };
      const startLength = Math.max(1, Math.hypot(control.x - start.x, control.y - start.y));
      const endLength = Math.max(1, Math.hypot(end.x - control.x, end.y - control.y));
      const startOffset = nodeRadius(start.work) + 2, endOffset = nodeRadius(end.work) + 5;
      return `<path class="field-edge ${edge.from === selected || edge.to === selected ? 'active' : ''}" style="--edge-depth:${Math.max(start.depth, end.depth)}" marker-end="url(#field-arrow)" d="M${start.x + (control.x - start.x) / startLength * startOffset},${start.y + (control.y - start.y) / startLength * startOffset} Q${control.x},${control.y} ${end.x - (end.x - control.x) / endLength * endOffset},${end.y - (end.y - control.y) / endLength * endOffset}"/>`;
    });
    const topics = [...new Set(network.works.map(work => work.topic))];
    const similarity = positions.filter(node => node.group === 'related').map(node => `<path class="field-similar" d="M500,295L${node.x},${node.y}"/>`);
    element('#field-svg').innerHTML = `<defs><marker id="field-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${similarity.join('')}${paths.join('')}${positions.map(node => {
      const radius = nodeRadius(node.work);
      const label = `${node.work.title}, ${node.work.year || 'year unknown'}, ${node.group}, ${node.depth} hops, ${citationRate(node.work).toFixed(1)} citations per year`;
      return `<g class="field-node ${node.group} ${selected === node.work.id ? 'selected' : ''}" tabindex="${selected === node.work.id ? '0' : '-1'}" role="button" aria-pressed="${selected === node.work.id}" aria-label="${esc(label)}" data-work="${node.work.id}" data-depth="${node.depth}"><title>${esc(label)}</title><circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="var(--field-topic-${topics.indexOf(node.work.topic) % 5})"/><text x="${node.x}" y="${node.y + radius + 18}" text-anchor="middle">${esc(node.work.title.slice(0, 44))}${node.work.title.length > 44 ? '…' : ''}</text></g>`;
    }).join('')}`;
    element('#field-list').innerHTML = positions.map(node => `<button data-work="${node.work.id}" aria-pressed="${selected === node.work.id}"><span>${esc(node.work.title)}</span><small>${node.work.year || 'Year unknown'} · ${node.depth ? `${node.depth} hops` : 'This paper'} · ${citationRate(node.work).toFixed(1)} citations/year</small></button>`).join('');
    const work = network.works.find(work => work.id === selected) || network.seed;
    if (publisherSelected && publisherSelected !== work.id) { publisherController.abort(); publisherSelected = ''; }
    element('#field-details').innerHTML = `<div><span class="eyebrow">${work.id === network.seed.id ? 'THIS PAPER' : 'SELECTED PAPER'} · ${work.year || 'YEAR UNKNOWN'}</span><h3>${esc(work.title)}</h3><p>${esc(work.authors.join(', '))}${work.venue ? ` · ${esc(work.venue)}` : ''}</p><p>${work.citations.toLocaleString()} indexed citations · ${citationRate(work).toFixed(1)} citations/year</p></div><div class="field-detail-actions"><div id="field-pdf-actions">${publisherActions(work)}</div><button class="secondary" data-recenter="${work.id}">Explore from here</button><details><summary>Source links</summary><a href="https://openalex.org/${work.id}" target="_blank" rel="noopener noreferrer">OpenAlex record ↗</a>${work.doi ? `<a href="${esc(work.doi)}" target="_blank" rel="noopener noreferrer">Publisher / DOI ↗</a>` : ''}</details></div>`;
    element('#field-provenance').textContent = `OpenAlex · retrieved ${new Date(network.fetchedAt).toLocaleString()} · ${network.works.length} fetched works, ${network.edges.length} directed links; ${positions.length} works currently shown. References ${network.references.length}/${network.seed.references.length}; direct citing works ${network.citations.length}/${network.seed.citations}. Bounded neighborhood: up to 120 works, at most 16 expansion parents and 18 new works per direction per hop. Citing samples prioritize highly cited works, not exhaustive coverage. Up to 3 shortest-path hops in the selected direction; related work is not a citation. Circle area uses log-scaled citations per publication-year (an age-adjusted attention proxy, not quality or field-normalized impact). Older/newer disciplines and indexing coverage differ. Deeper circles fade; text stays opaque. Open PDFs are provider-indexed links, not guaranteed accessible. ${matchNote} ${network.warnings.join(' ')}`;
  }
  function showNetwork(animate = true) {
    element('#field-map').hidden = false; element('#field-refresh').hidden = false; element('.field-toolbar').hidden = false;
    identify.open = false;
    render();
    const graphic = element('.field-graphic');
    graphic.getAnimations().forEach(animation => animation.cancel());
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) graphic.animate([{ transform: 'scale(.975)' }, { transform: 'scale(1.012)', offset: .65 }, { transform: 'scale(1)' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  async function load(work: FieldWork, refresh = false, associate = false) {
    cancel(); const token = generation;
    candidates = []; results.innerHTML = ''; status.textContent = 'Loading connections…';
    const cached = cachedNetwork(cacheKey(work.id), work.id);
    try {
      const data = !refresh && cached ? cached : await client.neighborhood(work, controller.signal);
      if (token !== generation) return;
      baseNetwork = data; network = data; selected = work.id; filter.value = ''; depth.value = '1'; element('#field-depth-value').textContent = '1';
      if (!data.warnings.length) saveStored(cacheKey(work.id), data);
      if (associate && hooks.documentId()) saveStored(associationKey(), { ...work, matchNote });
      status.textContent = `${cached && !refresh ? 'Cached · ' : ''}${data.works.length} papers · ${data.warnings.length ? 'Partial results — see sources' : 'Choose a paper to explore'}`;
      showNetwork();
    } catch (error) { if (token === generation) { status.textContent = (error as Error).message; identify.open = !network; } }
  }
  async function search(autoselect = false, value = query.value) {
    cancel(); const token = generation;
    status.textContent = autoselect ? 'Identifying this paper…' : 'Searching OpenAlex…'; results.innerHTML = '';
    try {
      const works = await client.search(value, controller.signal);
      if (token !== generation) return;
      const match = matchPaperCandidates(works, query.value);
      if (autoselect && (match.work || (value === query.value && /^(?:doi:|https?:\/\/doi\.org\/|10\.\d{4,9}\/|W\d+$)/i.test(value) && works.length === 1))) {
        matchNote = match.editions ? 'Several indexed editions share this exact title, author list and year. Showing the most cited edition; use Identify or change paper to choose another. Edition identity is not guaranteed.' : '';
        await load(match.work || works[0], false, true); return;
      }
      candidates = works; identify.open = true;
      results.innerHTML = works.map((work, index) => `<button class="field-match" data-candidate="${index}"><strong>${esc(work.title)}</strong><span>${work.year || 'Year unknown'} · ${esc(work.authors.join(', '))}</span><small>Use this paper →</small></button>`).join('');
      status.textContent = works.length ? 'Choose the correct paper; similar titles need confirmation.' : 'No match found. Try a DOI or a more specific title.';
    } catch (error) { if (token === generation) { status.textContent = (error as Error).message; identify.open = true; } }
  }
  async function expand() {
    if (!baseNetwork) return;
    cancel(); const token = generation;
    const order = Number(depth.value);
    element('#field-depth-value').textContent = String(order);
    if (order === 1) { network = baseNetwork; render(); status.textContent = 'Direct connections'; return; }
    status.textContent = `Loading up to ${order} hops…`;
    render();
    const cached = cachedNetwork(expandedKey(baseNetwork.seed.id), baseNetwork.seed.id);
    try {
      const data = cached || await client.expand(baseNetwork, direction.value as CitationDirection, order, controller.signal);
      if (token !== generation) return;
      network = data;
      if (!data.warnings.length) saveStored(expandedKey(data.seed.id), data);
      render(); status.textContent = `${cached ? 'Cached · ' : ''}Up to ${order} hops · ${visibleNodes().length} papers${data.warnings.length ? ' · Partial results — see sources' : ' · Bounded sample'}`;
    } catch (error) { if (token === generation) status.textContent = (error as Error).message; }
  }
  dialog.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); void search(); });
  dialog.addEventListener('click', event => {
    const retry = (event.target as Element).closest<HTMLElement>('[data-publisher-retry]');
    if (retry && network) {
      const work = network.works.find(item => item.id === retry.dataset.publisherRetry);
      if (work) { publisherErrors.delete(work.id); publisherSelected = ''; element('#field-pdf-actions').innerHTML = publisherActions(work); }
    }
    const target = (event.target as Element).closest<HTMLElement>('[data-candidate], [data-work], [data-recenter]');
    if (!target) return;
    if (target.dataset.candidate !== undefined && candidates[Number(target.dataset.candidate)]) { matchNote = ''; void load(candidates[Number(target.dataset.candidate)], false, true); }
    if (target.dataset.work) {
      selected = target.dataset.work;
      const inList = !!target.closest('#field-list'); render();
      [...element(inList ? '#field-list' : '#field-svg').querySelectorAll<SVGElement | HTMLButtonElement>('[data-work]')].find(node => node.dataset.work === selected)?.focus({ preventScroll: true });
    }
    if (target.dataset.recenter && network) { const work = network.works.find(work => work.id === target.dataset.recenter); if (work) { matchNote = ''; void load(work); } }
  });
  element('#field-svg').addEventListener('keydown', event => {
    const key = (event as KeyboardEvent).key, target = event.target as SVGElement;
    if (key === 'Enter' || key === ' ') { event.preventDefault(); target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
      event.preventDefault(); const nodes = [...element('#field-svg').querySelectorAll<SVGElement>('[data-work]')], index = nodes.indexOf(target);
      nodes[key === 'Home' ? 0 : key === 'End' ? nodes.length - 1 : (index + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length]?.focus();
    }
  });
  filter.addEventListener('input', render); related.addEventListener('change', render);
  depth.addEventListener('input', () => { element('#field-depth-value').textContent = depth.value; });
  depth.addEventListener('change', () => { void expand(); });
  direction.addEventListener('change', () => { void expand(); });
  element('#field-view').addEventListener('click', () => { listView = !listView; element('#field-svg').toggleAttribute('hidden', listView); element('#field-list').hidden = !listView; element('#field-view').setAttribute('aria-pressed', String(listView)); element('#field-view').textContent = listView ? 'Graph view' : 'List view'; });
  element('#field-refresh').addEventListener('click', () => { if (baseNetwork) void load(baseNetwork.seed, true); });
  element('#field-local').addEventListener('click', () => { dialog.close(); hooks.local(); });
  dialog.addEventListener('close', () => { cancel(); publisherController.abort(); publisherSelected = ''; });
  return {
    async open() {
      if (!dialog.open) hooks.show('#field-dialog');
      if (network) { showNetwork(false); return; }
      const associated = readStored<(FieldWork & { matchNote?: string }) | null>(associationKey(), null);
      if (associated?.id && /^W\d+$/.test(associated.id) && typeof associated.title === 'string') { query.value = associated.title; matchNote = typeof associated.matchNote === 'string' ? associated.matchNote.slice(0, 400) : ''; await load(associated); return; }
      const token = generation;
      const [suggestion, doi] = await Promise.all([hooks.suggestion().catch(() => ''), hooks.doi().catch(() => '')]);
      if (token !== generation || !dialog.open) return;
      if (!query.value) query.value = suggestion;
      if (automatic.checked && (doi || suggestion.trim().length >= 8)) await search(true, doi || suggestion);
      else { status.textContent = 'No network request until you search.'; query.focus(); }
    },
    reset() {
      publisherController.abort(); publisherSelected = '';
      cancel(); query.value = ''; network = baseNetwork = null; candidates = []; results.innerHTML = ''; selected = ''; matchNote = '';
      element('#field-map').hidden = true; element('#field-refresh').hidden = true; element('.field-toolbar').hidden = true;
      identify.open = true; status.textContent = 'No network request until you open this explorer.';
      if (dialog.open) dialog.close();
    },
  };
}
