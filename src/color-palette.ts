import { continuousTransform } from './continuous-color';
import type { Preferences } from './types';
import { terminalPalettes } from './theme-palettes';
import { getTheme } from './themes';

export type RGB = readonly [number, number, number];
export const COLOR_CACHE_SIZE = 32 ** 3;
export const colorTransformLimitations = 'Deterministic continuous hue interpolation and white-matte coverage; no page-dependent ink inference. Raster-only transforms cannot recover source geometry, nonwhite paper, or scientific color fidelity. Disable recoloring when original colors matter.';

export const parseColor = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const packed = (color: RGB) => (color[0] << 16) | (color[1] << 8) | color[2];
const saturation = (color: RGB) => (Math.max(...color) - Math.min(...color)) / (Math.max(...color) || 1);
const neutral = (color: RGB) => Math.max(...color) - Math.min(...color) <= 12 || saturation(color) <= .10;

function perceptual(color: RGB) {
  const [red, green, blue] = color.map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const long = Math.cbrt(.4122214708 * red + .5363325363 * green + .0514459929 * blue);
  const medium = Math.cbrt(.2119034982 * red + .6806995451 * green + .1073969566 * blue);
  const short = Math.cbrt(.0883024619 * red + .2817188376 * green + .6299787005 * blue);
  const lightness = .2104542553 * long + .793617785 * medium - .0040720468 * short;
  const axisRed = 1.9779984951 * long - 2.428592205 * medium + .4505937099 * short;
  const axisYellow = .0259040371 * long + .7827717662 * medium - .808675766 * short;
  const chroma = Math.hypot(axisRed, axisYellow) || 1;
  return { lightness, hueRed: axisRed / chroma, hueYellow: axisYellow / chroma, saturation: saturation(color) };
}

export function getColorPalette(theme: string): readonly RGB[] {
  const source = Object.hasOwn(terminalPalettes, theme) ? terminalPalettes[theme] : undefined;
  return (source ? [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14].map(index => source[index]) : getTheme(theme).colors).map(parseColor).filter(color => !neutral(color));
}

function distance(source: ReturnType<typeof perceptual>, target: ReturnType<typeof perceptual>) {
  return (source.hueRed - target.hueRed) ** 2 + (source.hueYellow - target.hueYellow) ** 2
    + .35 * (source.lightness - target.lightness) ** 2 + .5 * (source.saturation - target.saturation) ** 2;
}

export function nearestPaletteColor(color: RGB, palette: readonly RGB[]): RGB {
  if (!palette.length) return color;
  const source = perceptual(color);
  let best = palette[0], bestDistance = Infinity;
  for (const candidate of palette) {
    const score = distance(source, perceptual(candidate));
    if (score < bestDistance) { best = candidate; bestDistance = score; }
  }
  return best;
}

export function createColorTransform(preferences: Preferences): (color: RGB) => RGB {
  const transform = continuousTransform(preferences, getColorPalette(preferences.theme));
  return color => transform(...color) as unknown as RGB;
}

export function transformPixels(data: Uint8ClampedArray, preferences: Preferences): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data);
  recolorPixels(output, preferences);
  return output;
}

export function recolorPixels(data: Uint8ClampedArray, preferences: Preferences): void {
  if (!preferences.recolor && !preferences.palette.length) return;
  const transform = continuousTransform(preferences, getColorPalette(preferences.theme));
  const cache = new Map<number, number[]>();
  for (let offset = 0; offset + 3 < data.length; offset += 4) {
    const key = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
    let color = cache.get(key);
    if (!color) {
      color = transform(data[offset], data[offset + 1], data[offset + 2]);
      if (cache.size < 65536) cache.set(key, color);
    }
    data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2];
  }
}
