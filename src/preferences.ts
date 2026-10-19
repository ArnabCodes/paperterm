import type { Preferences, ReadingState } from './types';

export const defaults: Preferences = { theme: 'paper', background: '#fffefa', foreground: '#242c29', recolor: false, palette: [] };
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
  return { theme: ['paper', 'sepia', 'night'].includes(raw.theme) ? raw.theme : 'paper', background: validColor(raw.background) ? raw.background : defaults.background, foreground: validColor(raw.foreground) ? raw.foreground : defaults.foreground, recolor: Boolean(raw.recolor), palette: Array.isArray(raw.palette) ? raw.palette.filter(entry => validColor(entry.from) && validColor(entry.to)).slice(0, 12) : [] };
}
export const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

export function recolorCanvas(canvas: HTMLCanvasElement, preferences: Preferences) {
  if (!preferences.recolor && !preferences.palette.length) return;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const background = rgb(preferences.background);
  const foreground = rgb(preferences.foreground);
  const mappings = preferences.palette.map(entry => ({ from: rgb(entry.from), to: rgb(entry.to) }));
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset], green = image.data[offset + 1], blue = image.data[offset + 2];
    const replacement = mappings.find(entry => Math.max(Math.abs(red - entry.from[0]), Math.abs(green - entry.from[1]), Math.abs(blue - entry.from[2])) < 25);
    if (replacement) {
      image.data[offset] = replacement.to[0]; image.data[offset + 1] = replacement.to[1]; image.data[offset + 2] = replacement.to[2];
    } else if (preferences.recolor) {
      const luminance = (red * .2126 + green * .7152 + blue * .0722) / 255;
      for (let channel = 0; channel < 3; channel++) image.data[offset + channel] = foreground[channel] + luminance * (background[channel] - foreground[channel]);
    }
  }
  context.putImageData(image, 0, 0);
}
