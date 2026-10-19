import { getColorPalette, recolorPixels } from './color-palette';
import { buildColorLut, continuousTransform } from './continuous-color';
import { GpuColorizer } from './gpu-color';
import type { Preferences } from './types';

let gpu: GpuColorizer | null | undefined;
const tables = new Map<string, { color: Uint8Array; neutral: Uint8Array }>();
self.onmessage = (event: MessageEvent<{ pixels: ArrayBuffer; preferences: Preferences; width: number; height: number }>) => {
  try {
    let pixels = new Uint8ClampedArray(event.data.pixels);
    const { preferences, width, height } = event.data;
    let backend = 'cpu';
    if (gpu === undefined) { try { gpu = new GpuColorizer(); } catch { gpu = null; } }
    if (gpu) {
      try {
        const key = JSON.stringify(preferences);
        let table = tables.get(key);
        if (!table) {
          const transform = continuousTransform({ ...preferences, palette: preferences.palette.filter(entry => entry.from.toLowerCase() === '#ffffff') }, getColorPalette(preferences.theme));
          const neutral = new Uint8Array(256 * 4);
          for (let level = 0; level < 256; level++) neutral.set([...transform(level, level, level), 255], level * 4);
          table = { color: buildColorLut(transform), neutral };
          if (tables.size >= 4) tables.delete(tables.keys().next().value!);
          tables.set(key, table);
        }
        pixels = gpu.render(pixels, width, height, table.color, table.neutral, key, preferences); backend = 'webgl2';
      } catch { gpu = null; }
    }
    if (backend === 'cpu') recolorPixels(pixels, preferences);
    self.postMessage({ pixels: pixels.buffer, backend }, { transfer: [pixels.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
