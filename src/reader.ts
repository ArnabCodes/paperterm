import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFViewer as ViewerType } from 'pdfjs-dist/types/web/pdf_viewer';
import type { PDFLinkService as LinkType } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus as BusType } from 'pdfjs-dist/types/web/event_utils';
import type { Preferences, ReferenceHit, TextLine } from './types';
import { recolorCanvas } from './preferences';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const { PDFViewer, PDFLinkService, PDFFindController, EventBus } = await import('pdfjs-dist/web/pdf_viewer.mjs');

export interface OutlineEntry { title: string; depth: number; dest: string | unknown[] | null; url?: string }
export interface Location { page: number; top: number; left: number }

export class Reader {
  readonly bus: BusType = new EventBus();
  readonly links: LinkType;
  readonly viewer: ViewerType;
  document: PDFDocumentProxy | null = null;
  task: PDFDocumentLoadingTask | null = null;
  private generation = 0;
  private previewTask?: RenderTask;
  private previewGeneration = 0;
  private original = new WeakMap<HTMLCanvasElement, ImageData>();
  onPage = (_page: number) => {};
  onZoom = (_zoom: number) => {};
  onMatches = (_current: number, _total: number) => {};
  onIndex = (_lines: TextLine[], _complete: boolean) => {};
  onError = (_error: unknown) => {};
  onPassword: (wrong: boolean) => Promise<string | null> = async () => null;
  onProgress = (_percent: number) => {};
  preferences: Preferences;

  constructor(readonly container: HTMLDivElement, preferences: Preferences) {
    this.preferences = preferences;
    this.links = new PDFLinkService({ eventBus: this.bus, externalLinkTarget: 2, externalLinkRel: 'noopener noreferrer', ignoreDestinationZoom: true });
    const findController = new PDFFindController({ eventBus: this.bus, linkService: this.links });
    this.viewer = new PDFViewer({ container, viewer: document.querySelector<HTMLDivElement>('#viewer')!, eventBus: this.bus, linkService: this.links, findController, removePageBorders: true, textLayerMode: 1, annotationMode: 1, enableDetailCanvas: false, imageResourcesPath: new URL('vendor/images/', document.baseURI).href, maxCanvasPixels: 8_000_000 });
    this.links.setViewer(this.viewer);
    this.bus.on('pagechanging', (event: { pageNumber: number }) => this.onPage(event.pageNumber));
    this.bus.on('scalechanging', (event: { scale: number }) => this.onZoom(event.scale));
    this.bus.on('updatefindmatchescount', (event: { matchesCount: { current: number; total: number } }) => this.onMatches(event.matchesCount.current, event.matchesCount.total));
    this.bus.on('updatefindcontrolstate', (event: { state: number; matchesCount: { current: number; total: number } }) => this.onMatches(event.matchesCount.current, event.matchesCount.total));
    this.bus.on('pagerendered', (event: { source: { canvas: HTMLCanvasElement }; cssTransform: boolean; error?: unknown }) => {
      if (event.error) this.onError(event.error);
      const canvas = event.source.canvas;
      if (!canvas || event.cssTransform) return;
      this.original.delete(canvas);
      this.color(canvas);
    });
  }

  async load(source: Uint8Array | string, zoom: string, page: number) {
    const generation = ++this.generation;
    this.cancelPreview();
    this.viewer.setDocument(null);
    this.links.setDocument(null);
    if (this.task) await this.task.destroy();
    this.document = null;
    if (generation !== this.generation) return null;
    this.task = pdfjs.getDocument({
      ...(typeof source === 'string' ? { url: source, withCredentials: true } : { data: source }),
      cMapUrl: new URL('vendor/cmaps/', document.baseURI).href, cMapPacked: true,
      standardFontDataUrl: new URL('vendor/standard_fonts/', document.baseURI).href,
      wasmUrl: new URL('vendor/wasm/', document.baseURI).href,
      enableXfa: false,
    });
    const task = this.task;
    task.onPassword = async (callback: (password: string) => void, reason: number) => {
      const password = await this.onPassword(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
      if (password === null) { void task.destroy(); return; }
      callback(password);
    };
    task.onProgress = (progress: { loaded: number; total: number }) => this.onProgress(progress.total ? Math.round(progress.loaded / progress.total * 100) : 0);
    const pdf = await task.promise;
    if (generation !== this.generation) return null;
    this.document = pdf;
    const initialized = new Promise<void>(resolve => {
      const listener = () => { this.bus.off('pagesinit', listener); resolve(); };
      this.bus.on('pagesinit', listener);
    });
    this.links.setDocument(pdf);
    this.viewer.setDocument(pdf);
    await initialized;
    this.viewer.currentScaleValue = zoom;
    this.viewer.currentPageNumber = Math.max(1, Math.min(pdf.numPages, page));
    const labels = await pdf.getPageLabels();
    if (generation !== this.generation) return null;
    this.viewer.setPageLabels(labels);
    void this.index(pdf, generation).catch(error => { if (generation === this.generation) this.onError(error); });
    return pdf;
  }

  private async index(pdf: PDFDocumentProxy, generation: number) {
    const lines: TextLine[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (generation !== this.generation) return;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const rows: { text: string; x: number; y: number }[][] = [];
      for (const raw of content.items) {
        if (!('str' in raw) || !raw.str.trim()) continue;
        const item = raw as TextItem;
        const [xpos, ypos] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const entry = { text: item.str, x: xpos, y: ypos };
        const row = rows.find(existing => Math.abs(existing[0].y - ypos) < 3);
        if (row) row.push(entry); else rows.push([entry]);
      }
      rows.sort((left, right) => left[0].y - right[0].y);
      for (const row of rows) {
        row.sort((left, right) => left.x - right.x);
        lines.push({ text: row.map(item => item.text).join(' '), page: pageNumber, x: row[0].x / viewport.width, y: row[0].y / viewport.height });
      }
      if (pageNumber % 10 === 0 || pageNumber === pdf.numPages) this.onIndex([...lines], pageNumber === pdf.numPages);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  async outline(): Promise<OutlineEntry[]> {
    if (!this.document) return [];
    const results: OutlineEntry[] = [];
    type Outline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;
    const collect = (items: Outline, depth: number) => items.forEach(item => {
      results.push({ title: item.title, depth, dest: item.dest, url: item.url || undefined });
      collect(item.items, depth + 1);
    });
    collect(await this.document.getOutline() || [], 0);
    return results;
  }

  find(query: string, previous = false, again = false) {
    this.bus.dispatch('find', { source: this, type: again ? 'again' : '', query, phraseSearch: true, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  }

  get location(): Location { return { page: this.viewer.currentPageNumber, top: this.container.scrollTop, left: this.container.scrollLeft }; }
  get offset(): number {
    const view = this.viewer.getPageView(this.viewer.currentPageNumber - 1);
    return view?.div ? (this.container.scrollTop - view.div.offsetTop) / view.div.clientHeight : 0;
  }
  restoreFraction(page: number, offset = 0) {
    this.goTo(page);
    const view = this.viewer.getPageView(this.viewer.currentPageNumber - 1);
    if (view?.div) this.container.scrollTop = view.div.offsetTop + Math.min(1, Math.max(-1, offset)) * view.div.clientHeight;
  }
  restore(location: Location) { this.container.focus({ preventScroll: true }); this.viewer.currentPageNumber = location.page; this.container.scrollTo({ top: location.top, left: location.left, behavior: 'instant' }); this.viewer.update(); }

  goTo(page: number, normalizedY?: number) {
    this.container.focus({ preventScroll: true });
    if (!this.document) return;
    const safePage = Math.max(1, Math.min(this.document.numPages, page));
    this.viewer.currentPageNumber = safePage;
    if (normalizedY !== undefined) {
      const view = this.viewer.getPageView(safePage - 1);
      if (view?.div) this.container.scrollTop = view.div.offsetTop + view.div.clientHeight * normalizedY - 100;
    }
    this.viewer.update();
  }

  async resolveDestination(destination: string | unknown[]): Promise<{ page: number; y: number } | null> {
    if (!this.document) return null;
    const resolved = typeof destination === 'string' ? await this.document.getDestination(destination) : destination;
    if (!resolved) return null;
    const pageNumber = typeof resolved[0] === 'number' ? resolved[0] + 1 : await this.document.getPageIndex(resolved[0] as { num: number; gen: number }) + 1;
    const page = await this.document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const type = (resolved[1] as { name?: string })?.name;
    const top = type === 'XYZ' ? resolved[3] : type === 'FitH' || type === 'FitBH' ? resolved[2] : null;
    return { page: pageNumber, y: typeof top === 'number' ? viewport.convertToViewportPoint(0, top)[1] / viewport.height : 0 };
  }

  async preview(hit: Pick<ReferenceHit, 'page' | 'y'>, canvas: HTMLCanvasElement) {
    this.cancelPreview();
    const generation = this.previewGeneration;
    if (!this.document) return false;
    const page = await this.document.getPage(hit.page);
    if (generation !== this.previewGeneration) return false;
    const width = Math.max(260, (canvas.parentElement?.clientWidth || 400) - 24);
    const base = page.getViewport({ scale: 1 });
    const cssScale = width / base.width;
    const viewport = page.getViewport({ scale: cssScale * Math.min(window.devicePixelRatio || 1, 2) });
    canvas.width = viewport.width; canvas.height = viewport.height;
    canvas.style.width = `${width}px`; canvas.style.height = `${base.height * cssScale}px`;
    this.previewTask = page.render({ canvas, viewport, annotationMode: 0 });
    try { await this.previewTask.promise; } catch (error) { if (generation !== this.previewGeneration) return false; throw error; }
    if (generation !== this.previewGeneration) return false;
    this.original.delete(canvas);
    this.color(canvas);
    return true;
  }

  cancelPreview() { this.previewGeneration++; this.previewTask?.cancel(); this.previewTask = undefined; }

  color(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return;
    const original = this.original.get(canvas);
    if (original && original.width === canvas.width && original.height === canvas.height) context.putImageData(original, 0, 0);
    else if (this.preferences.recolor || this.preferences.palette.length) this.original.set(canvas, context.getImageData(0, 0, canvas.width, canvas.height));
    recolorCanvas(canvas, this.preferences);
  }

  applyPreferences(preferences: Preferences) {
    this.preferences = preferences;
    document.querySelectorAll<HTMLCanvasElement>('.canvasWrapper canvas, #portal-canvas').forEach(canvas => this.color(canvas));
  }
}
