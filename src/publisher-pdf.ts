export interface PublisherPdf { url: string; source: string; evidence: string }
const cache = new Map<string, { time: number; links: PublisherPdf[] }>();

export function publisherPage(value: string): boolean {
  try {
    const url = new URL(value);
    return /(^|\.)doi\.org$/i.test(url.hostname) || (/^https?:$/.test(url.protocol) && !/\.(?:pdf)(?:$|\/)|\/pdfft(?:$|\/)|\/pdf(?:$|\/)/i.test(url.pathname) && /\/(?:article|articles|doi|abs|full|record|publication)(?:\/|$)/i.test(url.pathname));
  } catch { return false; }
}

export function extractPublisherPdfs(html: string, source: string): PublisherPdf[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content, found = new Map<string, PublisherPdf>();
  function add(value: string | null | undefined, evidence: string) {
    if (!value || found.size >= 12) return;
    try {
      const url = new URL(value, source);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 6000) return;
      if (new URL(source).protocol === 'https:' && url.protocol !== 'https:') return;
      url.hash = '';
      if (!found.has(url.href)) found.set(url.href, { url: url.href, source, evidence });
    } catch {}
  }
  for (const meta of root.querySelectorAll('meta[name],meta[property]')) {
    if (/^(?:citation_pdf_url|wkhealth_pdf_url|eprints\.document_url)$/i.test(meta.getAttribute('name') || meta.getAttribute('property') || '')) add(meta.getAttribute('content'), 'Publisher PDF metadata');
  }
  for (const link of root.querySelectorAll('link[type="application/pdf"],a[type="application/pdf"]')) add(link.getAttribute('href'), 'Publisher PDF link');
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const visit = (value: unknown, level = 0) => {
        if (!value || typeof value !== 'object' || level > 8) return;
        if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, level + 1)); return; }
        const record = value as Record<string, unknown>;
        if (/pdf/i.test(String(record.encodingFormat || record.fileFormat || ''))) {
          if (typeof record.contentUrl === 'string') add(record.contentUrl, 'Publisher structured PDF metadata');
          else if (typeof record.url === 'string') add(record.url, 'Publisher structured PDF metadata');
        }
        Object.values(record).slice(0, 100).forEach(item => visit(item, level + 1));
      };
      visit(JSON.parse(script.textContent || ''));
    } catch {}
  }
  for (const anchor of root.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href')!, label = `${anchor.textContent} ${anchor.getAttribute('aria-label') || ''} ${anchor.getAttribute('title') || ''}`;
    if (/supplement|supporting|appendix/i.test(label + href)) continue;
    if (/\.pdf(?:[?#]|$)|\/pdfft(?:[?#]|$)|\/pdf(?:[/?#]|$)/i.test(href) || /(?:view|download|full[- ]?text|read)\s*(?:the\s*)?pdf\b/i.test(label)) add(href, 'Publisher page PDF link');
  }
  return [...found.values()].filter(link => link.url !== source);
}

export async function discoverPublisherPdfs(source: string, signal?: AbortSignal): Promise<PublisherPdf[]> {
  const url = new URL(source);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) publisher URL without embedded credentials.');
  const cached = cache.get(url.href);
  if (cached && Date.now() - cached.time < 600000) return cached.links;
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(url.href, { credentials: 'include', redirect: 'follow', signal: controller.signal, referrerPolicy: 'no-referrer' });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Publisher returned HTTP ${response.status}. Open its page to sign in or complete its access check, then retry. Institutional access is not guaranteed from an extension.`); }
    const finalUrl = response.url || url.href;
    if (/^application\/pdf(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      return [{ url: finalUrl, source: url.href, evidence: 'PDF response from publisher' }];
    }
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new Error('The publisher did not return a PDF or an article page.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Publisher response is empty.');
    const decoder = new TextDecoder();
    let html = '', size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) throw new Error('Publisher page exceeded the 2 MB discovery limit. Open its PDF link directly.');
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const links = extractPublisherPdfs(html, finalUrl);
    if (!links.length) throw new Error('No PDF link found in this page. It may require institutional sign-in, a browser access check, or JavaScript. Open the publisher page and use its PDF link with Pipit.');
    cache.set(url.href, { time: Date.now(), links });
    return links;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Publisher lookup cancelled.' : 'Publisher lookup timed out. Open its page and try the PDF link directly.');
    if (error instanceof TypeError) throw new Error('Publisher lookup was blocked by network, browser permissions or CORS. Use the extension with site access, or open the publisher page first.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
