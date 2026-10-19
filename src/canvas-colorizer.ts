import type { Preferences } from './types';

interface Job {
  read: () => ImageData | null;
  preferences: Preferences;
  resolve: (image: ImageData | null) => void;
  reject: (error: Error) => void;
}

export class CanvasColorizer {
  private worker?: Worker;
  private queue = new Map<HTMLCanvasElement, Job>();
  private active?: { canvas: HTMLCanvasElement; job: Job; width: number; height: number };
  private scheduled = false;

  transform(canvas: HTMLCanvasElement, read: Job['read'], preferences: Preferences): Promise<ImageData | null> {
    return new Promise((resolve, reject) => {
      this.queue.get(canvas)?.resolve(null);
      this.queue.set(canvas, { read, preferences: structuredClone(preferences), resolve, reject });
      this.schedule();
    });
  }

  cancel(canvas?: HTMLCanvasElement) {
    for (const [key, job] of this.queue) {
      if (!canvas || canvas === key) { job.resolve(null); this.queue.delete(key); }
    }
  }

  private schedule() {
    if (this.scheduled || this.active || !this.queue.size) return;
    this.scheduled = true;
    setTimeout(() => { this.scheduled = false; this.pump(); }, 0);
  }

  private pump() {
    if (this.active) return;
    const entry = this.queue.entries().next().value;
    if (!entry) return;
    const [canvas, job] = entry;
    this.queue.delete(canvas);
    try {
      const image = job.read();
      if (!image) { job.resolve(null); this.schedule(); return; }
      if (!this.worker) {
        this.worker = new Worker(new URL('./color-worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event: MessageEvent<{ pixels?: ArrayBuffer; error?: string; backend?: string }>) => {
          const active = this.active;
          this.active = undefined;
          if (active) {
            if (event.data.backend) active.canvas.dataset.colorBackend = event.data.backend;
            if (event.data.error || !event.data.pixels) active.job.reject(new Error(event.data.error || 'Recoloring failed'));
            else active.job.resolve(new ImageData(new Uint8ClampedArray(event.data.pixels), active.width, active.height));
          }
          this.schedule();
        };
        this.worker.onerror = () => {
          const error = new Error('The local color worker could not run. Original page colors are preserved.');
          this.active?.job.reject(error); this.active = undefined;
          for (const queued of this.queue.values()) queued.reject(error);
          this.queue.clear(); this.worker?.terminate(); this.worker = undefined;
        };
      }
      this.active = { canvas, job, width: image.width, height: image.height };
      const pixels = image.data.slice().buffer;
      this.worker.postMessage({ pixels, preferences: job.preferences, width: image.width, height: image.height }, [pixels]);
    } catch (error) {
      this.active = undefined;
      job.reject(error instanceof Error ? error : new Error(String(error)));
      this.schedule();
    }
  }
}
