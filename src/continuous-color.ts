import type { Preferences } from './types';

type Color = readonly number[];
const parse = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const mix = (first: Color, second: Color, amount: number) => first.map((value, index) => value + (second[index] - value) * amount);
const hue = (color: Color) => {
  const maximum = Math.max(...color), minimum = Math.min(...color), range = maximum - minimum;
  if (!range) return 0;
  const angle = maximum === color[0] ? (color[1] - color[2]) / range : maximum === color[1] ? 2 + (color[2] - color[0]) / range : 4 + (color[0] - color[1]) / range;
  return (angle / 6 + 1) % 1;
};

export function continuousTransform(preferences: Preferences, palette: readonly Color[]) {
  const anchors = palette.map(color => ({ color: color.map(value => value / 255), hue: hue(color) })).sort((first, second) => first.hue - second.hue).filter((anchor, index, all) => !index || anchor.hue - all[index - 1].hue > .001);
  const foreground = parse(preferences.foreground);
  const mappings = preferences.palette.map(entry => ({ from: parse(entry.from), to: parse(entry.to) }));
  const paper = mappings.find(entry => entry.from.every(value => value === 1))?.to || (preferences.recolor ? parse(preferences.background) : [1, 1, 1]);
  return (red: number, green: number, blue: number): number[] => {
    const source = [red / 255, green / 255, blue / 255];
    const depth = 1 - Math.min(...source);
    if (depth < 1e-8) return paper.map(value => Math.round(value * 255));
    const ink = source.map(value => 1 - (1 - value) / depth);
    let target = ink;
    if (preferences.recolor) {
      let chromatic: Color = foreground;
      if (anchors.length) {
        const angle = hue(ink);
        const upper = anchors.findIndex(anchor => anchor.hue > angle);
        const right = anchors[upper < 0 ? 0 : upper], left = anchors[(upper < 0 ? anchors.length : upper || anchors.length) - 1];
        const span = (right.hue - left.hue + 1) % 1;
        const amount = span ? ((angle - left.hue + 1) % 1) / span : 0;
        chromatic = mix(left.color, right.color, amount);
      }
      const chroma = Math.max(...ink) - Math.min(...ink);
      const amount = chroma * chroma * (3 - 2 * chroma);
      target = mix(foreground, chromatic, amount);
    }
    let result = mix(paper, target, depth);
    for (const entry of [...mappings].reverse()) {
      const sourceDepth = 1 - Math.min(...entry.from);
      if (sourceDepth < 1e-8) continue;
      const ray = entry.from.map(value => 1 - (1 - value) / sourceDepth);
      const separation = Math.max(...ink.map((value, index) => Math.abs(value - ray[index])));
      const radius = .08;
      const similarity = Math.max(0, 1 - separation / radius);
      const coverage = Math.min(1, depth / sourceDepth);
      const support = Math.max(0, 1 - Math.max(0, depth - sourceDepth) / .08);
      result = mix(result, mix(paper, entry.to, coverage), similarity * similarity * (3 - 2 * similarity) * support);
    }
    return result.map(value => Math.round(Math.max(0, Math.min(1, value)) * 255));
  };
}

export const LUT_SIZE = 65;
export function buildColorLut(transform: ReturnType<typeof continuousTransform>) {
  const table = new Uint8Array(LUT_SIZE ** 3 * 4);
  for (let blue = 0; blue < LUT_SIZE; blue++) for (let green = 0; green < LUT_SIZE; green++) for (let red = 0; red < LUT_SIZE; red++) {
    const offset = ((blue * LUT_SIZE + green) * LUT_SIZE + red) * 4;
    table.set([...transform(red * 255 / (LUT_SIZE - 1), green * 255 / (LUT_SIZE - 1), blue * 255 / (LUT_SIZE - 1)), 255], offset);
  }
  return table;
}
