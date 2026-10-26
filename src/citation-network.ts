export interface FieldWork {
  id: string; title: string; year: number | null; authors: string[]; citations: number;
  doi: string; topic: string; venue: string; references: string[]; related: string[]; pdfUrl?: string; landingUrl?: string;
}
export interface FieldNetwork {
  seed: FieldWork; works: FieldWork[]; edges: { from: string; to: string }[];
  references: string[]; citations: string[]; related: string[]; fetchedAt: string; warnings: string[];
}
const api = 'https://api.openalex.org';
const fields = 'id,display_name,publication_year,authorships,cited_by_count,doi,primary_topic,primary_location,best_oa_location,referenced_works,related_works';
export type CitationDirection = 'both' | 'references' | 'citations';
export function matchPaperCandidates(works: FieldWork[], title: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
  const exact = works.filter(work => normalize(work.title) === normalize(title));
  if (exact.length === 1) return { work: exact[0], editions: false };
  const sameEditionFamily = exact.length > 1 && exact.every(work => work.year === exact[0].year && work.year !== null && work.authors.length >= 3 && normalize(work.authors.join(' ')) === normalize(exact[0].authors.join(' ')));
  return { work: sameEditionFamily ? exact.slice().sort((first, second) => second.citations - first.citations)[0] : undefined, editions: sameEditionFamily };
}
export function safePdfUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 3000) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function citationRate(work: FieldWork, year = new Date().getUTCFullYear()): number {
  return work.citations / Math.max(1, year - (work.year || year) + 1);
}
export function citationLayers(network: FieldNetwork, direction: CitationDirection, depth: number) {
  const layers = new Map<string, { depth: number; group: string }>([[network.seed.id, { depth: 0, group: 'seed' }]]);
  let frontier = [network.seed.id];
  for (let order = 1; order <= Math.max(1, Math.min(3, depth)); order++) {
    const next: string[] = [];
    for (const parent of frontier) for (const edge of network.edges) {
      const id = direction !== 'citations' && edge.from === parent ? edge.to : direction !== 'references' && edge.to === parent ? edge.from : '';
      if (!id || layers.has(id)) continue;
      const inherited = layers.get(parent)!;
      layers.set(id, { depth: order, group: inherited.depth ? inherited.group : edge.from === parent ? 'reference' : 'citation' });
      next.push(id);
    }
    frontier = next;
  }
  return layers;
}
export function suggestPaperQuery(title: unknown, filename: string, text: { text: string; size: number; x: number; y: number }[] = []): string {
  if (typeof title === 'string' && title.trim().length >= 8 && !/^(untitled|document|microsoft)/i.test(title.trim())) return title.trim().replace(/\s+/g, ' ').slice(0, 500);
  const candidates = text.slice(0, 2000).filter(item => item.text.trim() && item.y >= .05 && item.y <= .4 && Number.isFinite(item.size) && item.size >= 12);
  const size = Math.max(0, ...candidates.map(item => item.size));
  const inferred = candidates.filter(item => item.size >= size * .88).sort((first, second) => Math.abs(first.y - second.y) < .008 ? first.x - second.x : first.y - second.y).map(item => item.text.trim()).join(' ').replace(/\s+/g, ' ');
  return (inferred.length >= 15 ? inferred : filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')).slice(0, 500);
}
export function workId(value: string): string | null {
  return /^(?:https:\/\/openalex\.org\/)?(W\d+)$/i.exec(value)?.[1].toUpperCase() || null;
}
export function normalizeWork(raw: Record<string, any>): FieldWork | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? workId(raw.id) : null;
  if (!id || typeof raw.display_name !== 'string') return null;
  const ids = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((value): value is string => typeof value === 'string').map(workId).filter((value): value is string => !!value))].slice(0, 10000) : [];
  return { id, title: raw.display_name.slice(0, 1000), year: Number.isInteger(raw.publication_year) ? raw.publication_year : null,
    authors: Array.isArray(raw.authorships) ? raw.authorships.slice(0, 6).map((entry: any) => String(entry.author?.display_name || '').slice(0, 150)) : [],
    citations: Number.isFinite(raw.cited_by_count) ? Math.max(0, raw.cited_by_count) : 0,
    doi: typeof raw.doi === 'string' && /^https:\/\/doi\.org\/10\./i.test(raw.doi) ? raw.doi.slice(0, 500) : '',
    topic: String(raw.primary_topic?.display_name || 'Unclassified').slice(0, 160), venue: String(raw.primary_location?.source?.display_name || '').slice(0, 200),
    references: ids(raw.referenced_works), related: ids(raw.related_works),
    landingUrl: safePdfUrl(raw.primary_location?.landing_page_url),
    pdfUrl: safePdfUrl(raw.best_oa_location?.pdf_url) || safePdfUrl(raw.primary_location?.pdf_url) };
}
export function assembleNetwork(seed: FieldWork, references: FieldWork[], citations: FieldWork[], related: FieldWork[], warnings: string[] = []): FieldNetwork {
  const works = [...new Map([seed, ...references, ...citations, ...related].map(work => [work.id, work])).values()];
  const present = new Set(works.map(work => work.id)), edges = new Map<string, { from: string; to: string }>();
  for (const work of works) for (const target of work.references) if (target !== work.id && present.has(target)) edges.set(`${work.id}:${target}`, { from: work.id, to: target });
  return { seed, works, edges: [...edges.values()], references: references.map(work => work.id), citations: citations.map(work => work.id), related: related.map(work => work.id), fetchedAt: new Date().toISOString(), warnings };
}
export function networkLayout(network: FieldNetwork) {
  const left = new Set(network.references), right = new Set(network.citations);
  const ordered = [...network.works].sort((first, second) => (first.year || 0) - (second.year || 0) || first.id.localeCompare(second.id));
  const groups = [ordered.filter(work => work.id !== network.seed.id && left.has(work.id)), ordered.filter(work => work.id !== network.seed.id && !left.has(work.id) && right.has(work.id)), ordered.filter(work => work.id !== network.seed.id && !left.has(work.id) && !right.has(work.id))];
  return [{ work: network.seed, x: 500, y: 295, group: 'seed' }, ...groups.flatMap((works, group) => works.map((work, index) => ({ work,
    x: group === 0 ? 155 + (index % 2) * 150 : group === 1 ? 700 + (index % 2) * 150 : 100 + (index % 5) * 200,
    y: group < 2 ? 85 + index / Math.max(1, works.length - 1) * 340 : 500 + Math.floor(index / 5) * 65,
    group: ['reference', 'citation', 'related'][group] })))];
}
export class OpenAlexClient {
  constructor(private request: typeof fetch = globalThis.fetch.bind(globalThis)) {}
  private async get(path: string, parameters: Record<string, string>, signal: AbortSignal) {
    const url = new URL(path, api);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    const response = await this.request(url.href, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(response.status === 429 ? 'OpenAlex is rate-limiting requests. Please wait before retrying.' : response.status === 401 || response.status === 403 ? 'OpenAlex denied this request. Anonymous access may be restricted; try again later.' : `OpenAlex returned HTTP ${response.status}. Try again later.`);
    return response.json();
  }
  async search(query: string, signal: AbortSignal): Promise<FieldWork[]> {
    const value = query.trim().slice(0, 500);
    if (value.length < 3) throw new Error('Enter a paper title, DOI, or OpenAlex work ID.');
    const id = workId(value), doi = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(value)?.[1];
    if (id || doi) {
      const raw = await this.get(`/works/${id || encodeURIComponent(`https://doi.org/${doi}`)}`, { select: fields }, signal);
      const work = normalizeWork(raw); return work ? [work] : [];
    }
    const raw = await this.get('/works', { search: value, per_page: '6', select: fields }, signal);
    return (Array.isArray(raw.results) ? raw.results : []).map(normalizeWork).filter((work: FieldWork | null): work is FieldWork => !!work);
  }
  async neighborhood(seed: FieldWork, signal: AbortSignal): Promise<FieldNetwork> {
    const warnings: string[] = [];
    const batch = async (ids: string[]) => {
      if (!ids.length) return [];
      const raw = await this.get('/works', { filter: `openalex:${ids.join('|')}`, per_page: String(ids.length), select: fields }, signal);
      return (raw.results || []).map(normalizeWork).filter((work: FieldWork | null): work is FieldWork => !!work) as FieldWork[];
    };
    let references: FieldWork[] = [], citations: FieldWork[] = [], related: FieldWork[] = [];
    for (const group of ['references', 'citations', 'related'] as const) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      try {
        if (group === 'references') references = await batch(seed.references.slice(0, 18));
        else if (group === 'related') related = await batch(seed.related.slice(0, 10));
        else {
          const raw = await this.get('/works', { filter: `cites:${seed.id}`, sort: 'cited_by_count:desc', per_page: '18', select: fields }, signal);
          citations = (raw.results || []).map(normalizeWork).filter((work: FieldWork | null): work is FieldWork => !!work);
        }
      } catch (error) {
        if (signal.aborted) throw error;
        warnings.push(`${group}: ${(error as Error).message}`);
      }
    }
    return assembleNetwork(seed, references, citations, related, warnings);
  }
  async expand(base: FieldNetwork, direction: CitationDirection, depth: number, signal: AbortSignal): Promise<FieldNetwork> {
    let network = { ...base, works: [...base.works], edges: [...base.edges], warnings: [...base.warnings] };
    for (let order = 2; order <= Math.min(3, depth); order++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const layers = citationLayers(network, direction, order - 1);
      const eligible = network.works.filter(work => layers.get(work.id)?.depth === order - 1);
      const frontier = direction === 'both' ? [...eligible.filter(work => layers.get(work.id)?.group === 'reference').slice(0, 8), ...eligible.filter(work => layers.get(work.id)?.group === 'citation').slice(0, 8)] : eligible.slice(0, 16);
      if (!frontier.length || network.works.length >= 120) break;
      for (const branch of ['references', 'citations'] as const) {
        if (direction !== 'both' && direction !== branch) continue;
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const known = new Set(network.works.map(work => work.id));
        const ids = [...new Set(frontier.flatMap(work => work.references))].filter(id => !known.has(id)).slice(0, 18);
        if (branch === 'references' && !ids.length) continue;
        try {
          const raw = await this.get('/works', { filter: branch === 'references' ? `openalex:${ids.join('|')}` : `cites:${frontier.map(work => work.id).join('|')}`, per_page: '18', select: fields, ...(branch === 'citations' ? { sort: 'cited_by_count:desc' } : {}) }, signal);
          const incoming: FieldWork[] = (Array.isArray(raw.results) ? raw.results : []).map(normalizeWork).filter((work: FieldWork | null): work is FieldWork => !!work);
          const works = [...new Map([...network.works, ...incoming].map(work => [work.id, work])).values()].slice(0, 120);
          const present = new Set(works.map(work => work.id));
          const edges = works.flatMap(work => work.references.filter(id => id !== work.id && present.has(id)).map(id => ({ from: work.id, to: id })));
          network = { ...network, works, edges };
        } catch (error) {
          if (signal.aborted) throw error;
          network.warnings.push(`Hop ${order} ${branch}: ${(error as Error).message}`);
          if (/rate-limit|denied/.test((error as Error).message)) return network;
        }
      }
    }
    return { ...network, fetchedAt: new Date().toISOString() };
  }
}
