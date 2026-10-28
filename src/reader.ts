import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFViewer as ViewerType } from 'pdfjs-dist/types/web/pdf_viewer';
import type { PDFLinkService as LinkType } from 'pdfjs-dist/types/web/pdf_link_service';
import type { EventBus as BusType } from 'pdfjs-dist/types/web/event_utils';
import type { Preferences, ReferenceHit, TextLine } from './types';
import { CanvasColorizer } from './canvas-colorizer';
import { extractTextLines } from './text-lines';
import { detectColumns, previewCrop, type PreviewBox } from './preview-region';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const { PDFViewer, PDFLinkService, PDFFindController, EventBus } = await import('pdfjs-dist/web/pdf_viewer.mjs');

export interface OutlineEntry { title: string; depth: number; dest: string | unknown[] | null; url?: string }
export interface Location { page: number; top: number; left: number; offset?: number; leftFraction?: number; zoom?: string; rotation?: number }

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
  private colors = new CanvasColorizer();
  private colorVersions = new WeakMap<HTMLCanvasElement, number>();
  private covers = new Map<HTMLElement, HTMLCanvasElement>();
  private appliedColors = '';
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
    this.bus.on('pagerender', (event: { source: { canvas?: HTMLCanvasElement; div: HTMLDivElement } }) => {
      const canvas = event.source.canvas;
      if (canvas) {
        if (this.preferences.recolor || this.preferences.palette.length) {
          canvas.dataset.colorPending = 'true';
          const page = event.source.div;
          const previous = page.querySelector<HTMLCanvasElement>('.canvasWrapper canvas');
          if (!this.covers.has(page) && previous && previous !== canvas && previous.width && previous.height) {
            if (this.covers.size >= 4) {
              const oldest = this.covers.keys().next().value!;
              this.covers.get(oldest)!.remove(); this.covers.delete(oldest);
            }
            const cover = document.createElement('canvas');
            cover.className = 'page-color-cover'; cover.setAttribute('aria-hidden', 'true');
            cover.width = previous.width; cover.height = previous.height;
            cover.getContext('2d')!.drawImage(previous, 0, 0);
            page.append(cover); this.covers.set(page, cover);
          }
        }
        this.colors.cancel(canvas);
        this.colorVersions.set(canvas, (this.colorVersions.get(canvas) || 0) + 1);
        delete canvas.dataset.recoloring;
        canvas.getContext('2d', { alpha: true, willReadFrequently: true });
      }
    });
    this.bus.on('pagechanging', (event: { pageNumber: number }) => this.onPage(event.pageNumber));
    this.bus.on('scalechanging', (event: { scale: number }) => this.onZoom(event.scale));
    this.bus.on('updatefindmatchescount', (event: { matchesCount: { current: number; total: number } }) => this.onMatches(event.matchesCount.current, event.matchesCount.total));
    this.bus.on('updatefindcontrolstate', (event: { state: number; matchesCount: { current: number; total: number } }) => this.onMatches(event.matchesCount.current, event.matchesCount.total));
    this.bus.on('pagerendered', (event: { source: { canvas: HTMLCanvasElement }; cssTransform: boolean; error?: unknown }) => {
      if (event.error) this.onError(event.error);
      const canvas = event.source.canvas;
      if (!canvas || event.cssTransform) return;
      this.original.delete(canvas);
      void this.color(canvas).catch(this.onError);
    });
  }

  async load(source: Uint8Array | string, zoom: string, page: number) {
    const generation = ++this.generation;
    for (const cover of this.covers.values()) cover.remove();
    this.covers.clear();
    this.colors.cancel();
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
      await new Promise<void>(resolve => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 250 });
        else setTimeout(resolve, 16);
      });
      if (generation !== this.generation) return;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: { text: string; x: number; y: number; width: number }[] = [];
      for (const raw of content.items) {
        if (!('str' in raw) || !raw.str.trim()) continue;
        const item = raw as TextItem;
        const [xpos, ypos] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        items.push({ text: item.str, x: xpos, y: ypos, width: item.width });
      }
      lines.push(...extractTextLines(items, pageNumber, viewport.width, viewport.height));
      if (pageNumber % 10 === 0 || pageNumber === pdf.numPages) this.onIndex([...lines], pageNumber === pdf.numPages);
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

  get location(): Location {
    const page = this.viewer.currentPageNumber;
    const view = this.viewer.getPageView(page - 1);
    return { page, top: this.container.scrollTop, left: this.container.scrollLeft,
      offset: this.offset, leftFraction: view?.div?.clientWidth ? this.container.scrollLeft / view.div.clientWidth : undefined,
      zoom: this.viewer.currentScaleValue, rotation: this.viewer.pagesRotation };
  }
  get offset(): number {
    const view = this.viewer.getPageView(this.viewer.currentPageNumber - 1);
    return view?.div ? (this.container.scrollTop - view.div.offsetTop) / view.div.clientHeight : 0;
  }
  restoreFraction(page: number, offset = 0) {
    this.goTo(page);
    const view = this.viewer.getPageView(this.viewer.currentPageNumber - 1);
    if (view?.div) this.container.scrollTop = view.div.offsetTop + Math.min(1, Math.max(-1, offset)) * view.div.clientHeight;
  }
  restore(location: Location) {
    this.container.focus({ preventScroll: true });
    if (location.rotation !== undefined) this.viewer.pagesRotation = location.rotation;
    if (location.zoom) this.viewer.currentScaleValue = location.zoom;
    this.viewer.currentPageNumber = location.page;
    const view = this.viewer.getPageView(location.page - 1);
    const top = view?.div && Number.isFinite(location.offset) ? view.div.offsetTop + location.offset! * view.div.clientHeight : location.top;
    const left = view?.div && Number.isFinite(location.leftFraction) ? location.leftFraction! * view.div.clientWidth : location.left;
    this.container.scrollTo({ top, left, behavior: 'instant' });
    this.viewer.update();
  }

  goTo(page: number, normalizedY?: number) {
    this.container.focus({ preventScroll: true });
    if (!this.document) return;
    const safePage = Math.max(1, Math.min(this.document.numPages, page));
    this.viewer.currentPageNumber = safePage;
    const view = this.viewer.getPageView(safePage - 1);
    if (view?.div) {
      const top = this.container.scrollTop + view.div.getBoundingClientRect().top - this.container.getBoundingClientRect().top;
      this.container.scrollTop = top + (normalizedY === undefined ? 0 : view.div.clientHeight * normalizedY - Math.min(this.container.clientHeight / 2, view.div.clientHeight * .65));
    }
    this.viewer.update();
  }

  async smartWidth() {
    const pdf = this.document, generation = this.generation;
    if (!pdf) return;
    const pageNumber = this.viewer.currentPageNumber;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + this.viewer.pagesRotation) % 360 });
    const content = await page.getTextContent();
    if (generation !== this.generation) return;
    const boxes = content.items.filter((item): item is TextItem => 'str' in item && !!item.str.trim()).map(item => {
      const first = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const last = viewport.convertToViewportPoint(item.transform[4] + item.width, item.transform[5] + item.height);
      return [Math.min(first[0], last[0]), Math.max(first[0], last[0])];
    });
    if (!boxes.length) { this.viewer.currentScaleValue = 'page-width'; return; }
    const left = Math.max(0, Math.min(...boxes.map(box => box[0]), viewport.width * .2) - 12);
    const right = Math.min(viewport.width, Math.max(...boxes.map(box => box[1]), viewport.width * .8) + 12);
    const scale = Math.max(.2, Math.min(5, (this.container.clientWidth - 32) / (right - left) / (96 / 72)));
    this.viewer.currentScale = scale;
    const view = this.viewer.getPageView(pageNumber - 1);
    this.container.scrollLeft = Math.max(0, (view?.div.offsetLeft || 0) + left * scale * (96 / 72) - 16);
  }

  async resolveDestination(destination: string | unknown[]): Promise<{ page: number; y: number; x?: number } | null> {
    if (!this.document) return null;
    const resolved = typeof destination === 'string' ? await this.document.getDestination(destination) : destination;
    if (!resolved) return null;
    const pageNumber = typeof resolved[0] === 'number' ? resolved[0] + 1 : await this.document.getPageIndex(resolved[0] as { num: number; gen: number }) + 1;
    const page = await this.document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const type = (resolved[1] as { name?: string })?.name;
    const top = type === 'XYZ' ? resolved[3] : type === 'FitH' || type === 'FitBH' ? resolved[2] : null;
    const xpos = type === 'XYZ' && typeof resolved[2] === 'number' ? resolved[2] : undefined;
    return { page: pageNumber, y: typeof top === 'number' ? viewport.convertToViewportPoint(0, top)[1] / viewport.height : 0, x: xpos === undefined ? undefined : xpos / viewport.width };
  }

  async preview(hit: Pick<ReferenceHit, 'page' | 'y'> & { x?: number; label?: string }, canvas: HTMLCanvasElement, magnification = 1, fullPage = false) {
    this.cancelPreview();
    this.colors.cancel(canvas);
    this.colorVersions.set(canvas, (this.colorVersions.get(canvas) || 0) + 1);
    delete canvas.dataset.recoloring;
    const generation = this.previewGeneration;
    if (!this.document) return false;
    const page = await this.document.getPage(hit.page);
    if (generation !== this.previewGeneration) return false;
    const rotation = (page.rotate + this.viewer.pagesRotation) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const availableWidth = Math.max(120, canvas.parentElement!.clientWidth);
    const cssScale = Math.min(this.viewer.currentScale * (96 / 72) * .95, availableWidth / base.width);
    const viewport = page.getViewport({ scale: Math.min(700 / base.width, 1200 / base.height), rotation });
    const buffer = document.createElement('canvas');
    buffer.width = viewport.width; buffer.height = viewport.height;
    buffer.getContext('2d', { alpha: true, willReadFrequently: true });
    this.previewTask = page.render({ canvas: buffer, viewport, annotationMode: 0 });
    try { await this.previewTask.promise; } catch (error) { if (generation !== this.previewGeneration) return false; throw error; }
    if (generation !== this.previewGeneration) return false;
    const content = await page.getTextContent();
    if (generation !== this.previewGeneration) return false;
    const boxes: PreviewBox[] = content.items.filter((item): item is TextItem => 'str' in item && !!item.str.trim()).map(item => {
      const first = base.convertToViewportPoint(item.transform[4], item.transform[5]);
      const last = base.convertToViewportPoint(item.transform[4] + item.width, item.transform[5] + item.height);
      return { x: Math.min(first[0], last[0]) / base.width, y: Math.min(first[1], last[1]) / base.height, width: Math.abs(last[0] - first[0]) / base.width, height: Math.abs(last[1] - first[1]) / base.height, text: item.str };
    });
    const analysis = buffer;
    const analysisContext = analysis.getContext('2d', { willReadFrequently: true })!;
    const originalViewport = page.getViewport({ scale: 1 });
    const point = originalViewport.convertToPdfPoint((hit.x ?? .5) * originalViewport.width, hit.y * originalViewport.height);
    const rotatedPoint = base.convertToViewportPoint(point[0], point[1]);
    const number = /^Equation\s*(\(.+\))$/i.exec(hit.label || '')?.[1];
    const numberBox = number ? boxes.find(box => box.text.trim() === number && Math.abs(box.y + box.height - rotatedPoint[1] / base.height) < .035) : undefined;
    const targetX = numberBox ? numberBox.x + numberBox.width / 2 : hit.x === undefined ? undefined : rotatedPoint[0] / base.width;
    const crop = previewCrop(boxes, analysisContext.getImageData(0, 0, analysis.width, analysis.height), { ...hit, x: targetX, y: rotatedPoint[1] / base.height }, fullPage);
    const contextCrop = { ...crop, y: 0, height: 1 };
    const displayScale = crop.cropped ? availableWidth / (base.width * crop.width) * magnification : cssScale * magnification;
    const cropped = document.createElement('canvas');
    const detailRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (base.width * contextCrop.width * base.height * displayScale * displayScale)));
    const detailViewport = page.getViewport({ scale: displayScale * detailRatio, rotation });
    cropped.width = Math.max(1, Math.round(detailViewport.width * contextCrop.width)); cropped.height = Math.max(1, Math.round(detailViewport.height));
    cropped.getContext('2d', { willReadFrequently: true });
    this.previewTask = page.render({ canvas: cropped, viewport: detailViewport, transform: [1, 0, 0, 1, -detailViewport.width * contextCrop.x, 0], annotationMode: 0 });
    try { await this.previewTask.promise; } catch (error) { if (generation !== this.previewGeneration) return false; throw error; }
    if (generation !== this.previewGeneration) return false;
    await this.color(cropped, true);
    if (generation !== this.previewGeneration) return false;
    canvas.width = cropped.width; canvas.height = cropped.height;
    canvas.style.width = `${base.width * contextCrop.width * displayScale}px`; canvas.style.height = `${base.height * displayScale}px`;
    canvas.dataset.documentScale = String(displayScale / (96 / 72));
    canvas.dataset.crop = JSON.stringify(crop); canvas.dataset.column = crop.column;
    canvas.dataset.contextCrop = JSON.stringify(contextCrop);
    canvas.dataset.twoColumns = String(detectColumns(boxes)); canvas.dataset.sourceX = String(hit.x);
    canvas.dataset.targetY = String(Math.max(0, rotatedPoint[1] / base.height));
    canvas.dataset.colorBackend = cropped.dataset.colorBackend || 'original';
    canvas.getContext('2d', { alpha: true, willReadFrequently: true })!.drawImage(cropped, 0, 0);
    const source = this.original.get(cropped);
    if (source) this.original.set(canvas, source); else this.original.delete(canvas);
    return true;
  }

  cancelPreview() { this.previewGeneration++; this.previewTask?.cancel(); this.previewTask = undefined; }

  async color(canvas: HTMLCanvasElement, allowDetached = false) {
    const version = (this.colorVersions.get(canvas) || 0) + 1;
    this.colorVersions.set(canvas, version);
    const generation = this.generation;
    this.colors.cancel(canvas);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return;
    const original = this.original.get(canvas);
    if (!this.preferences.recolor && !this.preferences.palette.length) {
      if (original && original.width === canvas.width && original.height === canvas.height) context.putImageData(original, 0, 0);
      delete canvas.dataset.recoloring;
      this.revealCanvas(canvas);
      return;
    }
    canvas.dataset.recoloring = 'true';
    const width = canvas.width, height = canvas.height;
    try {
      const image = await this.colors.transform(canvas, () => {
        if (generation !== this.generation || version !== this.colorVersions.get(canvas) || (!allowDetached && !canvas.isConnected) || canvas.width !== width || canvas.height !== height) return null;
        let source = this.original.get(canvas);
        if (!source || source.width !== width || source.height !== height) {
          source = context.getImageData(0, 0, width, height);
          this.original.set(canvas, source);
        }
        return source;
      }, this.preferences);
      if (image && generation === this.generation && version === this.colorVersions.get(canvas) && (allowDetached || canvas.isConnected) && canvas.width === width && canvas.height === height) {
        context.putImageData(image, 0, 0); this.revealCanvas(canvas);
      }
    } finally {
      if (version === this.colorVersions.get(canvas)) delete canvas.dataset.recoloring;
    }
  }

  private revealCanvas(canvas: HTMLCanvasElement) {
    delete canvas.dataset.colorPending;
    const page = canvas.closest<HTMLElement>('.page');
    if (page) { this.covers.get(page)?.remove(); this.covers.delete(page); }
  }

  applyPreferences(preferences: Preferences) {
    this.preferences = preferences;
    const key = JSON.stringify({ ...preferences, glass: false });
    if (this.appliedColors === key) return;
    this.appliedColors = key;
    document.querySelectorAll<HTMLCanvasElement>('.canvasWrapper canvas, #portal-canvas').forEach(canvas => {
      if (!canvas.hidden) void this.color(canvas).catch(this.onError);
    });
  }
}
