import type { Preferences, ReadingState } from './types';
import { getTheme } from './themes';
import { recolorPixels } from './color-palette';
export { createColorTransform, getColorPalette, nearestPaletteColor, transformPixels } from './color-palette';

export const defaults: Preferences = { theme: 'paper', background: '#fffefa', foreground: '#242c29', recolor: false, glass: true, palette: [] };
export const readStored = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};
export const saveStored = (key: string, value: unknown): boolean => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
export const defaultReadingState = (): ReadingState => ({ page: 1, zoom: 'auto', marks: {}, bookmarks: [] });

const validColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
export function loadPreferences(): Preferences {
  const raw = readStored<Preferences>('paperterm.preferences.v2', defaults);
  return { theme: getTheme(raw.theme).id, background: validColor(raw.background) ? raw.background : defaults.background, foreground: validColor(raw.foreground) ? raw.foreground : defaults.foreground, recolor: Boolean(raw.recolor), glass: raw.glass !== false, palette: Array.isArray(raw.palette) ? raw.palette.filter(entry => validColor(entry.from) && validColor(entry.to)).slice(0, 12) : [] };
}
export const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

export function recolorCanvas(canvas: HTMLCanvasElement, preferences: Preferences) {
  if (!preferences.recolor && !preferences.palette.length) return;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  recolorPixels(image.data, preferences);
  context.putImageData(image, 0, 0);
}
