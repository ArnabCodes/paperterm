async (page) => {
  page.setDefaultTimeout(10000);
  const checks = [];
  const assert = (value, message, details) => { if (!value) throw new Error(message + (details ? `: ${JSON.stringify(details)}` : '')); checks.push(message); };
  await page.keyboard.press('Escape');
  await page.locator('#file-input').setInputFiles('output/playwright/fixtures/text-edges.pdf');
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '1' && document.querySelector('#loading').hidden && document.querySelector('.canvasWrapper canvas')?.width > 100);
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click(); await page.keyboard.press('Escape');
  await page.keyboard.press('w');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.canvasWrapper canvas');
    return canvas.width >= Math.floor(canvas.clientWidth * Math.min(devicePixelRatio, 2)) - 3 && !canvas.hidden && !canvas.closest('.page').querySelector('.loadingIcon');
  });
  await page.evaluate(() => {
    const canvas = document.querySelector('.canvasWrapper canvas');
    window.__nativeTextEdges = { width: canvas.width, height: canvas.height, pixels: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data };
  });
  const compare = () => page.waitForFunction(() => !document.querySelector('canvas[data-recoloring]')).then(() => page.evaluate(() => {
    const canvas = document.querySelector('.canvasWrapper canvas');
    const source = window.__nativeTextEdges;
    if (canvas.width !== source.width || canvas.height !== source.height) throw new Error('Canvas scale changed during edge comparison');
    const actual = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const paper = Array.from(actual.slice(0, 3));
    const inks = [[0, 0, 0], [43, 51, 48], [190, 30, 40], [38, 87, 71], [20, 60, 220]];
    return inks.map((ink, band) => {
      const top = Math.floor((58 + band * 125) * canvas.height / 792);
      const bottom = Math.ceil((154 + band * 125) * canvas.height / 792);
      const left = Math.floor(60 * canvas.width / 612), right = Math.ceil(560 * canvas.width / 612);
      let endpoint;
      for (let ypos = top; ypos < bottom && !endpoint; ypos++) for (let xpos = left; xpos < right; xpos++) {
        const offset = (ypos * canvas.width + xpos) * 4;
        if (ink.every((channel, index) => Math.abs(source.pixels[offset + index] - channel) <= 1)) { endpoint = Array.from(actual.slice(offset, offset + 3)); break; }
      }
      if (!endpoint) throw new Error('No opaque source glyph pixels in band ' + band);
      const direction = ink.map(channel => channel - 255);
      const denominator = direction.reduce((sum, channel) => sum + channel * channel, 0);
      let count = 0, maximum = 0, squared = 0, coloredEdges = 0;
      const coverages = new Set();
      for (let ypos = top; ypos < bottom; ypos++) for (let xpos = left; xpos < right; xpos++) {
        const offset = (ypos * canvas.width + xpos) * 4;
        if (band === 0 && Math.max(...source.pixels.slice(offset, offset + 3)) - Math.min(...source.pixels.slice(offset, offset + 3)) > 1) coloredEdges++;
        const coverage = direction.reduce((sum, channel, index) => sum + (source.pixels[offset + index] - 255) * channel, 0) / denominator;
        if (coverage < .03 || coverage > .97) continue;
        if (ink.some((channel, index) => Math.abs(255 + coverage * (channel - 255) - source.pixels[offset + index]) > 2)) continue;
        let error = 0;
        for (let channel = 0; channel < 3; channel++) error = Math.max(error, Math.abs(actual[offset + channel] - (paper[channel] + coverage * (endpoint[channel] - paper[channel]))));
        count++; maximum = Math.max(maximum, error); squared += error * error;
        coverages.add(actual[offset] + ',' + actual[offset + 1] + ',' + actual[offset + 2]);
      }
      return { band, count, maximum, rms: Math.sqrt(squared / count), shades: coverages.size, paper, endpoint, coloredEdges };
    });
  }));
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Dracula', exact: true }).click(); await page.keyboard.press('Escape');
  const dark = await compare();
  assert(dark.every(result => result.count > 100), 'Rendered fixture contains antialiased glyph edges in all five ink colors', dark);
  assert(dark[0].coloredEdges === 0, 'Native black text uses grayscale antialiasing without false colored subpixel fringes');
  assert(dark.slice(2).every(result => result.maximum <= 6), 'Colored glyph edges retain their native raster coverage after theme mapping', dark);
  assert(dark.slice(0, 2).every(result => result.maximum <= 6), 'Black and near-neutral text retain smooth native edge coverage');
  assert(dark.every(result => result.shades > 20), 'Recolored text retains many intermediate edge shades instead of solid palette steps');
  await page.screenshot({ path: 'output/playwright/v051-text-dark.png', animations: 'disabled' });
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Catppuccin Latte', exact: true }).click(); await page.keyboard.press('Escape');
  const light = await compare();
  assert(light.every(result => result.maximum <= 6), 'Light-theme glyphs also preserve their original edge coverage');
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click();
  await page.getByRole('button', { name: 'Add a color replacement', exact: true }).click();
  await page.getByLabel('Source color 1', { exact: true }).fill('#ffffff'); await page.getByLabel('Source color 1', { exact: true }).dispatchEvent('change');
  await page.getByLabel('Replacement color 1', { exact: true }).fill('#f0e8d8'); await page.getByLabel('Replacement color 1', { exact: true }).dispatchEvent('change');
  await page.keyboard.press('Escape');
  const paperOnly = await compare();
  assert(paperOnly.every(result => result.maximum <= 6), 'Changing only the paper color also updates glyph edges without white halos', paperOnly);
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click();
  for (const [index, from, to] of [[1, '#000000', '#123456'], [2, '#ffffff', '#f0e8d8']]) {
    await page.getByRole('button', { name: 'Add a color replacement', exact: true }).click();
    await page.getByLabel(`Source color ${index}`, { exact: true }).fill(from); await page.getByLabel(`Source color ${index}`, { exact: true }).dispatchEvent('change');
    await page.getByLabel(`Replacement color ${index}`, { exact: true }).fill(to); await page.getByLabel(`Replacement color ${index}`, { exact: true }).dispatchEvent('change');
  }
  await page.keyboard.press('Escape');
  const custom = await compare();
  assert(custom[0].maximum <= 3 && custom[0].endpoint.join(',') === '18,52,86' && custom[0].paper.join(',') === '240,232,216', 'Custom foreground and paper replacements blend through native black-text antialiasing');
  assert(custom.every(result => result.maximum <= 6 && result.rms <= 2.5), 'Interpolated custom replacements preserve smooth edge coverage with bounded raster error', custom);
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click(); await page.keyboard.press('Escape');
  assert(await page.evaluate(() => {
    const canvas = document.querySelector('.canvasWrapper canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.every((value, index) => value === window.__nativeTextEdges.pixels[index]);
  }), 'Reset restores the exact original canvas pixels without accumulating recoloring artifacts');
  return { passed: checks.length, checks, coverage: { dark, light, paperOnly, custom }, backend: await page.locator('.canvasWrapper canvas').first().getAttribute('data-color-backend') };
}
