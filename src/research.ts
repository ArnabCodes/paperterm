import type { TextLine } from './types';

export const RESEARCH_LIMITS = Object.freeze({
  lines: 100_000,
  lineCharacters: 8_192,
  groupCharacters: 256,
  referencesPerGroup: 256,
  referenceNumber: 999_999,
  mentions: 200_000,
  bibliographyCharacters: 8_192,
  excerptCharacters: 240,
  selectionCharacters: 16_384,
  selectionIdentifiers: 100,
});

export const RESEARCH_LIMITATIONS: readonly string[] = Object.freeze([
  'Heuristic text-only map, not a PDF outline or a validated bibliographic index; input order is reading order.',
  'Only positive numeric square-bracket citations are indexed; author-year, superscripts and split-line groups are unsupported.',
  'Bibliography entries need a References/Bibliography heading or a line-start [n] with author, year or identifier evidence.',
  'Bibliography continuations and headings are heuristic; merged columns, running headers and OCR may produce incorrect boundaries.',
  'Bibliography regions end at recognized headings; arbitrary unnumbered trailing headings cannot be inferred from plain text.',
  'Mention coordinates identify the source line, not individual glyphs; start/end are UTF-16 offsets with an exclusive end.',
  'Repeated numbers and locations are retained; page counts count expanded mentions, not bracket groups or unique references.',
  'Numeric brackets may be non-citations; duplicate bibliography labels share backlinks and keep alternative definitions.',
  'Malformed, descending and oversized groups are skipped whole; fixed limits bound work and truncated marks clipped document data.',
  'Identifier extraction returns unverified candidates from a bounded selection; it never resolves or fetches an identifier.',
]);

export interface ResearchLocation { page: number; x: number; y: number; lineIndex: number }
export interface ResearchMention extends ResearchLocation {
  id: string;
  referenceId: string;
  label: string;
  text: string;
  start: number;
  end: number;
}
export interface ResearchDefinition extends ResearchLocation { text: string; lineIndices: number[] }
export interface ResearchReference extends ResearchDefinition {
  id: string;
  label: string;
  mentions: ResearchMention[];
  definitions: ResearchDefinition[];
}
export interface ResearchSection extends ResearchLocation {
  id: string;
  title: string;
  depth: number;
  endLineIndex: number;
  kind: 'section' | 'bibliography';
}
export interface PageCitationSummary {
  page: number;
  citationCount: number;
  uniqueReferenceCount: number;
  referenceIds: string[];
  mentionIds: string[];
}
export interface PageReferenceEdge {
  page: number;
  referenceId: string;
  count: number;
  mentionIds: string[];
}
export interface DocumentMap {
  sections: ResearchSection[];
  references: ResearchReference[];
  mentions: ResearchMention[];
  pages: PageCitationSummary[];
  edges: PageReferenceEdge[];
  unresolvedReferenceIds: string[];
  truncated: boolean;
  limitations: readonly string[];
}
export interface NumericCitationGroup { numbers: number[]; raw: string; start: number; end: number }
export interface SelectionIdentifier { kind: 'doi' | 'arxiv'; id: string; url: string; start: number; end: number }

export function parseNumericCitationGroup(content: string): number[] | null {
  if (!content.length || content.length > RESEARCH_LIMITS.groupCharacters || /[\r\n]/.test(content)) return null;
  const numbers: number[] = [];
  for (const token of content.split(/[,;]/)) {
    const match = /^\s*(\d{1,6})(?:\s*[-–—−]\s*(\d{1,6}))?\s*$/.exec(token);
    if (!match) return null;
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first < 1 || last < first || last > RESEARCH_LIMITS.referenceNumber || numbers.length + last - first + 1 > RESEARCH_LIMITS.referencesPerGroup) return null;
    for (let number = first; number <= last; number++) numbers.push(number);
  }
  return numbers;
}

export function findNumericCitations(text: string): NumericCitationGroup[] {
  const groups: NumericCitationGroup[] = [];
  const bounded = text.slice(0, RESEARCH_LIMITS.lineCharacters);
  const pattern = /\[([^\[\]\r\n]{1,256})\]/g;
  for (const match of bounded.matchAll(pattern)) {
    if (bounded[match.index - 1] === '[' || bounded[match.index + match[0].length] === ']') continue;
    const numbers = parseNumericCitationGroup(match[1]);
    if (numbers) groups.push({ numbers, raw: match[0], start: match.index, end: match.index + match[0].length });
  }
  return groups;
}

function heading(text: string): { title: string; depth: number; kind: ResearchSection['kind'] } | null {
  const title = text.trim();
  if (!title || title.length > 140) return null;
  const prefix = /^(\d{1,3}(?:\.\d{1,3}){0,4}|[IVXLCDM]+)[.)]?\s+(.+)$/i.exec(title);
  const name = (prefix ? prefix[2] : title).replace(/[:.]$/, '').trim();
  const bibliography = /^(?:references|bibliography|literature cited|works cited)(?:\s+(?:&|and)\s+further reading)?$/i.test(name);
  const common = /^(?:abstract|introduction|background|related work|theory|methods|materials and methods|results|discussion|results and discussion|conclusions?|summary|acknowledg(?:e)?ments|notes|author contributions|(?:data|code) availability(?: statement)?|funding|conflicts? of interest|competing interests|appendix(?:\s+[A-Z])?(?:\s*[:.].*)?|supplementary (?:information|materials?))$/i.test(name);
  const numbered = prefix && /^\d/.test(prefix[1]) && /^\p{Lu}/u.test(name) && !/[.!?;]$/.test(title);
  if (!bibliography && !common && !numbered) return null;
  return { title, depth: prefix ? prefix[1].split('.').length : 1, kind: bibliography ? 'bibliography' : 'section' };
}

function definitionStart(text: string): { number: number; body: string } | null {
  const match = /^\s*\[(\d{1,6})\]\s*(.*)$/.exec(text);
  return match && Number(match[1]) > 0 ? { number: Number(match[1]), body: match[2] } : null;
}

function bibliographyEvidence(text: string): boolean {
  return /\b(?:18|19|20)\d{2}[a-z]?\b|\b10\.\d{4,9}\/|\barxiv\s*:|\barxiv\.org\//i.test(text)
    || /^(?:\p{Lu}\.\s*){1,3}\p{Lu}[\p{L}'’-]+|^\p{Lu}[\p{L}'’-]+,\s*\p{Lu}\.|^\p{Lu}[\p{L}'’-]+\s+et\s+al\./u.test(text);
}

function excerpt(text: string, start: number): string {
  if (text.length <= RESEARCH_LIMITS.excerptCharacters) return text;
  const offset = Math.max(0, Math.min(start - 80, text.length - RESEARCH_LIMITS.excerptCharacters + 2));
  const length = RESEARCH_LIMITS.excerptCharacters - (offset > 0 ? 1 : 0) - 1;
  const end = offset + length;
  return `${offset > 0 ? '…' : ''}${text.slice(offset, end)}${end < text.length ? '…' : ''}`;
}

export function buildDocumentMap(lines: readonly TextLine[]): DocumentMap {
  const sections: ResearchSection[] = [];
  const references: ResearchReference[] = [];
  const mentions: ResearchMention[] = [];
  const byReference = new Map<string, ResearchReference>();
  const byPage = new Map<number, PageCitationSummary>();
  const byEdge = new Map<string, PageReferenceEdge>();
  const suppressed = new Set<number>();
  const length = Math.min(lines.length, RESEARCH_LIMITS.lines);
  const texts: string[] = [];
  let truncated = lines.length > length;
  let inBibliography = false;
  let active: ResearchDefinition | undefined;
  let activeReference: ResearchReference | undefined;
  let previous: TextLine | undefined;
  const sectionStack: ResearchSection[] = [];

  for (let lineIndex = 0; lineIndex < length; lineIndex++) {
    const line = lines[lineIndex];
    const text = line.text.slice(0, RESEARCH_LIMITS.lineCharacters);
    texts.push(text);
    truncated ||= line.text.length > text.length;
    const location: ResearchLocation = { page: line.page, x: line.x, y: line.y, lineIndex };
    if (!byPage.has(line.page)) byPage.set(line.page, { page: line.page, citationCount: 0, uniqueReferenceCount: 0, referenceIds: [], mentionIds: [] });
    const section = heading(text);
    if (section) {
      while (sectionStack.length && (sectionStack[sectionStack.length - 1].depth >= section.depth || sectionStack[sectionStack.length - 1].kind === 'bibliography')) sectionStack.pop()!.endLineIndex = lineIndex;
      const entry: ResearchSection = { ...location, ...section, id: `section:${lineIndex}`, endLineIndex: length };
      sections.push(entry);
      sectionStack.push(entry);
      inBibliography = section.kind === 'bibliography';
      active = undefined;
      activeReference = undefined;
      previous = line;
      continue;
    }
    if (inBibliography) suppressed.add(lineIndex);
    const candidate = definitionStart(text);
    if (candidate && (inBibliography || bibliographyEvidence(candidate.body))) {
      const id = `reference:${candidate.number}`;
      active = { ...location, text: text.trim(), lineIndices: [lineIndex] };
      activeReference = byReference.get(id);
      if (!activeReference) {
        activeReference = { ...active, id, label: `[${candidate.number}]`, mentions: [], definitions: [] };
        references.push(activeReference);
        byReference.set(id, activeReference);
      }
      activeReference.definitions.push(active);
      suppressed.add(lineIndex);
    } else if (active && activeReference && text.trim() && (inBibliography || (
      previous && previous.page === line.page && line.y >= previous.y && line.y - previous.y <= 0.04
      && line.x >= active.x - 0.02 && active.lineIndices.length < 8 && !candidate && !findNumericCitations(text).length
    ))) {
      const addition = ` ${text.trim()}`;
      const available = RESEARCH_LIMITS.bibliographyCharacters - active.text.length;
      active.text += addition.slice(0, Math.max(0, available));
      truncated ||= addition.length > available;
      active.lineIndices.push(lineIndex);
      suppressed.add(lineIndex);
    } else {
      active = undefined;
      activeReference = undefined;
    }
    if (active && activeReference && activeReference.definitions[0] === active) activeReference.text = active.text;
    previous = line;
  }

  const unresolved = new Set<string>();
  mentionLines: for (let lineIndex = 0; lineIndex < length; lineIndex++) {
    if (suppressed.has(lineIndex)) continue;
    const line = lines[lineIndex];
    const page = byPage.get(line.page)!;
    for (const group of findNumericCitations(texts[lineIndex])) {
      const text = excerpt(texts[lineIndex], group.start);
      for (let member = 0; member < group.numbers.length; member++) {
        if (mentions.length >= RESEARCH_LIMITS.mentions) { truncated = true; break mentionLines; }
        const number = group.numbers[member];
        const referenceId = `reference:${number}`;
        const mention: ResearchMention = {
          id: `mention:${lineIndex}:${group.start}:${member}`, referenceId, label: `[${number}]`, text,
          page: line.page, x: line.x, y: line.y, lineIndex, start: group.start, end: group.end,
        };
        mentions.push(mention);
        const reference = byReference.get(referenceId);
        if (reference) reference.mentions.push(mention); else unresolved.add(referenceId);
        page.citationCount++;
        page.mentionIds.push(mention.id);
        const key = `${line.page}:${referenceId}`;
        let edge = byEdge.get(key);
        if (!edge) {
          edge = { page: line.page, referenceId, count: 0, mentionIds: [] };
          byEdge.set(key, edge);
          page.referenceIds.push(referenceId);
          page.uniqueReferenceCount++;
        }
        edge.count++;
        edge.mentionIds.push(mention.id);
      }
    }
  }
  return {
    sections, references, mentions, pages: [...byPage.values()].sort((left, right) => left.page - right.page),
    edges: [...byEdge.values()], unresolvedReferenceIds: [...unresolved], truncated, limitations: RESEARCH_LIMITATIONS,
  };
}

function trimIdentifier(candidate: string): string {
  let result = candidate.replace(/[.,;:!?]+$/, '');
  let balance = 0;
  for (const character of result) {
    if (character === '(') balance++;
    if (character === ')') balance--;
  }
  while (balance < 0 && result.endsWith(')')) {
    result = result.slice(0, -1).replace(/[.,;:!?]+$/, '');
    balance++;
  }
  return result;
}

export function extractSelectionIdentifiers(selection: string): SelectionIdentifier[] {
  const text = selection.slice(0, RESEARCH_LIMITS.selectionCharacters);
  const candidates: SelectionIdentifier[] = [];
  const doiPattern = /\b10\.\d{4,9}\/[^\s<>"\[\]{}]+/gi;
  for (const match of text.matchAll(doiPattern)) {
    if (candidates.length >= RESEARCH_LIMITS.selectionIdentifiers) break;
    const id = trimIdentifier(match[0]);
    if (!id.split('/')[1]) continue;
    candidates.push({ kind: 'doi', id, url: `https://doi.org/${encodeURI(id).replace(/[?#]/g, character => encodeURIComponent(character))}`, start: match.index, end: match.index + id.length });
  }
  const arxivPattern = /(?:\barxiv\s*:\s*|(?:https?:\/\/)?(?:www\.)?arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v[1-9]\d{0,3})?|[a-z][a-z.-]*\/\d{7}(?:v[1-9]\d{0,3})?)(?![\w])/gi;
  for (const match of text.matchAll(arxivPattern)) {
    if (candidates.length >= RESEARCH_LIMITS.selectionIdentifiers * 2) break;
    const id = match[1];
    const digits = id.includes('/') ? id.split('/')[1] : id;
    const month = Number(digits.slice(2, 4));
    if (month < 1 || month > 12) continue;
    const start = match.index + match[0].length - id.length;
    candidates.push({ kind: 'arxiv', id, url: `https://arxiv.org/abs/${id}`, start, end: start + id.length });
  }
  const seen = new Set<string>();
  return candidates.sort((left, right) => left.start - right.start).filter(candidate => {
    const key = `${candidate.kind}:${candidate.id.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, RESEARCH_LIMITS.selectionIdentifiers);
}

export function extractDois(selection: string): string[] {
  return extractSelectionIdentifiers(selection).filter(identifier => identifier.kind === 'doi').map(identifier => identifier.id);
}

export function extractArxivIds(selection: string): string[] {
  return extractSelectionIdentifiers(selection).filter(identifier => identifier.kind === 'arxiv').map(identifier => identifier.id);
}
