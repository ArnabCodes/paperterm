import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';

const modules = new Map();
async function loadModule(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../../src/${name}.ts`, import.meta.url), 'utf8');
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...compiled.matchAll(/from ['"]\.\/([^'"]+)['"]/g)]) {
    compiled = compiled.replaceAll(`'./${match[1]}'`, JSON.stringify(await loadModule(match[1]))).replaceAll(`"./${match[1]}"`, JSON.stringify(await loadModule(match[1])));
  }
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  modules.set(name, url);
  return url;
}
const { createColorTransform, getColorPalette, nearestPaletteColor, transformPixels, recolorPixels, parseColor, COLOR_CACHE_SIZE } = await import(await loadModule('color-palette'));
const { terminalPalettes, terminalPaletteNames } = await import(await loadModule('theme-palettes'));
const { themes } = await import(await loadModule('themes'));
const { defaults, defaultReadingState, readStored, saveStored, recolorCanvas } = await import(await loadModule('preferences'));
const preferences = (extra = {}) => ({ ...defaults, theme: 'dracula', background: '#282a36', foreground: '#f8f8f2', recolor: true, ...extra });
export const cachedColorBenchmark = {
  pixels: 1_000_000, warmups: 1, measuredRuns: 3,
  node: 'v24.15.0', cpu: 'Intel(R) Xeon(R) w9-3595X',
  scope: 'in-place recolorPixels including fresh transform/cache; excludes input copy, canvas readback/upload and PDF rendering',
  settings: 'Dracula, background #282a36, foreground #f8f8f2; fixtures and custom mappings defined in --benchmark below',
  baseline: {
    timestamp: '2026-10-19T12:46:50.040Z', sourceSha256: '5000fdefd84df546aa771b6ca411fcd954b8995ba68c964ed92726df163c9795',
    milliseconds: { white: [125.250, 122.467, 121.984], black: [121.656, 121.525, 121.420], mixed: [126.205, 126.908, 126.766], 'mixed-custom': [64.855, 64.945, 64.708] },
  },
  optimized: {
    timestamp: '2026-10-19T12:47:31.822Z', sourceSha256: '534869191d382b9c3733146faf62bea913510b1f658218091df6b9f7129c9322',
    milliseconds: { white: [14.548, 9.618, 9.606], black: [9.658, 9.670, 9.711], mixed: [13.613, 13.571, 13.688], 'mixed-custom': [16.962, 17.305, 16.921] },
  },
  coveragePreserving: {
    timestamp: '2026-10-19T13:00:11.229Z', sourceSha256: '5a3c74ad8c6fe1a960551968faebdc495505a4e35e9acc5c0cfc822ad3e22555',
    milliseconds: { white: [24.675, 24.705, 24.421], black: [94.114, 94.323, 94.216], mixed: [54.025, 54.082, 54.324], 'mixed-custom': [50.506, 50.739, 50.150], 'glyph-aa': [118.677, 102.186, 102.292] },
    changedOutputSha256: { 'mixed-custom': '36f1137fb2eb9ec7e76aaabe958c3c5587eb5a6d86f8548d1c1305b6c5b0331a', 'glyph-aa': '62fee39b9a7eb4ccfebbd0820cfa9ab057b6adaea43454c4518a8fc0cbc28620' },
    semantics: 'White, black and RGB swatch output hashes unchanged; mixed-custom intentionally changes gray AA to blend against custom white mapping.',
  },
  matchingOutputSha256: {
    white: '78640e0f6706d0d1fc1ce7c2b4c1199cc58d31a2b99cb4c2510e48796d06fc5f',
    black: 'ce64dc30717818783ab5729e194d806489b2473729cfb250e00557a7bfc92522',
    mixed: 'e893f673d94bce9e10f66977e707c5ad423457a8ffc2517cdec660e0ce82021b',
    'mixed-custom': '245e3f8b478d1e0170a5a229c3ccea4976447ef26b0681711a8896649c0b92ce',
  },
};
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }

check('all twenty terminal themes have full sixteen-slot source snapshots', () => {
  assert.equal(Object.keys(terminalPalettes).length, 20);
  for (const theme of themes.slice(3)) {
    assert.equal(terminalPalettes[theme.id].length, 16);
    assert.ok(terminalPaletteNames[theme.id]);
    assert.ok(terminalPalettes[theme.id].every(color => /^#[0-9a-f]{6}$/.test(color)));
    assert.ok(getColorPalette(theme.id).length >= 8);
  }
});

check('neutral endpoints and antialiased grayscale are continuous and exact', () => {
  for (const theme of themes) {
    const transform = createColorTransform(preferences({ theme: theme.id, background: theme.background, foreground: theme.foreground }));
    const background = parseColor(theme.background), foreground = parseColor(theme.foreground);
    assert.deepEqual(transform([255, 255, 255]), background);
    assert.deepEqual(transform([0, 0, 0]), foreground);
    for (const level of [1, 7, 64, 128, 192, 254]) {
      assert.deepEqual(transform([level, level, level]), foreground.map((channel, index) => Math.round(channel + level / 255 * (background[index] - channel))));
    }
  }
});

check('pure pixel helper preserves alpha and input; Paper stays original when disabled', () => {
  const input = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 37, 0, 255, 0, 128, 255, 255, 255, 255]);
  const copy = input.slice();
  const output = transformPixels(input, preferences());
  assert.deepEqual(input, copy);
  for (let offset = 3; offset < input.length; offset += 4) assert.equal(output[offset], input[offset]);
  assert.deepEqual(transformPixels(input, defaults), input);
  assert.notDeepEqual(output, input);
});

check('storage and reading-state APIs remain available', () => {
  const saved = new Map();
  globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  assert.equal(saveStored('test', { page: 3 }), true);
  assert.deepEqual(readStored('test', {}), { page: 3 });
  saved.set('paperterm.preferences.v2', JSON.stringify({ theme: 'paper' }));
  assert.deepEqual(readStored('pipit.preferences.v2', {}), { theme: 'paper' });
  assert.equal(saved.has('paperterm.preferences.v2'), false, 'legacy settings are moved to Pipit storage');
  saved.set('bad', '{');
  assert.equal(readStored('bad', 'fallback'), 'fallback');
  assert.equal(defaultReadingState().page, 1);
  delete globalThis.localStorage;
});

check('continuous palette interpolation keeps primary diagram hues distinct', () => {
  for (const theme of themes.slice(3)) {
    const transform = createColorTransform(preferences({ theme: theme.id }));
    const colors = [[255,0,0], [0,255,0], [0,0,255]].map(transform);
    assert.equal(new Set(colors.map(String)).size, 3);
    assert.ok(colors.flat().every(value => value >= 0 && value <= 255));
  }
});
check('same source pixels are independent of surrounding page colors', () => {
  const colors = [[43,51,48], [12,110,230], [252,253,254]];
  const transform = createColorTransform(preferences());
  for (const color of colors) {
    const input = new Uint8ClampedArray([...color,255, 0,0,0,255, 255,0,0,255]);
    assert.deepEqual([...transformPixels(input, preferences()).slice(0,3)], transform(color));
  }
});
check('smooth source ramps have no isolated palette jumps', () => {
  const transform = createColorTransform(preferences());
  for (const ink of [[0,0,0], [43,51,48], [190,30,40], [38,87,71], [20,60,220]]) {
    let previous = transform([255,255,255]);
    for (let coverage = 1; coverage <= 255; coverage++) {
      const color = transform(ink.map(value => Math.round(255 + coverage / 255 * (value - 255))));
      assert.ok(Math.max(...color.map((value,index) => Math.abs(value - previous[index]))) <= 6);
      previous = color;
    }
  }
});
check('custom black and paper substitutions retain the full grayscale ramp', () => {
  const transform = createColorTransform(preferences({ recolor:false, palette:[{from:'#000000',to:'#123456'},{from:'#ffffff',to:'#f0e8d8'}] }));
  for (let level=0;level<256;level++) assert.deepEqual(transform([level,level,level]), [18,52,86].map((value,index) => Math.round(value + level/255 * ([240,232,216][index]-value))));
});
check('custom chromatic replacements remain exact at source endpoints', () => {
  const transform=createColorTransform(preferences({palette:[{from:'#ff0000',to:'#123456'}]}));
  assert.deepEqual(transform([255,0,0]),[18,52,86]);
});
check('changing only paper leaves opaque primary figure colors intact', () => {
  const transform=createColorTransform(preferences({recolor:false,palette:[{from:'#ffffff',to:'#e8d5b0'}]}));
  for(const ink of [[255,0,0],[0,255,0],[0,0,255],[0,0,0]]) assert.deepEqual(transform(ink),ink);
});
console.log(`${checks} color-palette checks passed.`);

if (process.argv.includes('--benchmark')) {
  const pixels = 1_000_000;
  const settings = preferences();
  const cases = [
    { name: 'white', colors: [[255, 255, 255]], settings },
    { name: 'black', colors: [[0, 0, 0]], settings },
    { name: 'mixed', colors: [...Array(7).fill([255, 255, 255]), [0, 0, 0], [128, 128, 128], [255, 0, 0], [0, 0, 255], [0, 255, 0]], settings },
    { name: 'mixed-custom', colors: [...Array(7).fill([255, 255, 255]), [0, 0, 0], [128, 128, 128], [255, 0, 0], [0, 0, 255], [0, 255, 0]], settings: preferences({ palette: [{ from: '#ffffff', to: '#fffefa' }, { from: '#ff0000', to: '#aabbcc' }] }) },
    { name: 'glyph-aa', colors: [[43, 51, 48], [0, 255, 0], [0, 0, 255]].flatMap(ink => Array.from({ length: 256 }, (_, level) => ink.map(channel => Math.round(255 + level / 255 * (channel - 255))))), settings },
  ];
  const results = [];
  for (const scenario of cases) {
    const input = new Uint8ClampedArray(pixels * 4);
    for (let pixel = 0; pixel < pixels; pixel++) input.set([...scenario.colors[pixel % scenario.colors.length], pixel % 256], pixel * 4);
    const reference = transformPixels(input, scenario.settings);
    const output = new Uint8ClampedArray(input.length);
    const times = [];
    for (let iteration = 0; iteration < 4; iteration++) {
      output.set(input);
      const start = performance.now();
      recolorPixels(output, scenario.settings);
      const elapsed = performance.now() - start;
      if (iteration) times.push(Number(elapsed.toFixed(3)));
    }
    assert.deepEqual(output, reference, scenario.name);
    results.push({ case: scenario.name, milliseconds: times, medianMs: [...times].sort((first, second) => first - second)[1], outputSha256: createHash('sha256').update(output).digest('hex') });
  }
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, pixels, warmups: 1, measuredRuns: 3, scope: 'in-place recolorPixels including transform/cache construction; excludes input copy, canvas readback/upload and PDF rendering', sourceSha256: createHash('sha256').update(readFileSync(new URL('../../src/color-palette.ts', import.meta.url))).digest('hex'), results }, null, 2));
}

if (process.argv.includes('--verify-upstream')) {
  for (const [theme, colors] of Object.entries(terminalPalettes)) {
    const response = await fetch(`https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/ghostty/${encodeURIComponent(terminalPaletteNames[theme])}`);
    assert.equal(response.ok, true, theme);
    const source = await response.text();
    const upstream = Array.from(source.matchAll(/^palette = (\d+)=(#[0-9a-f]{6})$/gm));
    assert.equal(upstream.length, 16, theme);
    for (const match of upstream) assert.equal(colors[Number(match[1])], match[2], `${theme} ANSI ${match[1]}`);
  }
  console.log('PASS all 320 ANSI slots match upstream Ghostty primary sources.');
}
