import type { ReferenceHit, ReferenceKind, TextLine } from './types';

export class ReferenceEngine {
  private worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: ReferenceHit[]) => void; reject: (reason: Error) => void }>();

  constructor() {
    this.worker.postMessage({ type: 'initialize', url: new URL('core.wasm', document.baseURI).href });
    this.worker.onmessage = event => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data.result);
    };
    this.worker.onerror = () => {
      for (const request of this.pending.values()) request.reject(new Error('Reference engine could not start. Rebuild the app.'));
      this.pending.clear();
    };
  }

  index(lines: TextLine[]) { this.worker.postMessage({ type: 'index', lines }); }

  lookup(query: string, kind: ReferenceKind): Promise<ReferenceHit[]> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'query', id, query, kind });
    });
  }
}
