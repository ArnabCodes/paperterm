async (page) => {
  page.setDefaultTimeout(15000);
  const checks = [];
  const assert = (value, message, detail) => { if (!value) throw new Error(`${message}: ${JSON.stringify(detail)}`); checks.push(message); };
  const settled = () => page.waitForFunction(() => !document.querySelector('canvas[data-recoloring], .canvasWrapper canvas[data-color-pending], .page-color-cover'));
  await page.goto('http://127.0.0.1:4173/?demo=1&verify=polish');
  await page.waitForFunction(() => document.querySelector('#engine-status').textContent.includes('Ready'));
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Dracula', exact: true }).click(); await page.keyboard.press('Escape'); await settled();
  await page.keyboard.press('g'); await page.keyboard.press('g');
  await page.evaluate(() => {
    window.__zoomFrames = { checked: 0, raw: 0, covers: 0, running: true };
    const frame = () => {
      const result = window.__zoomFrames;
      if (!result.running) return;
      for (const canvas of document.querySelectorAll('.canvasWrapper canvas, .page-color-cover')) {
        const box = canvas.getBoundingClientRect();
        if (canvas.hidden || getComputedStyle(canvas).visibility === 'hidden' || !canvas.width || box.bottom < 0 || box.top > innerHeight) continue;
        if (canvas.classList.contains('page-color-cover')) result.covers++;
        const pixel = canvas.getContext('2d').getImageData(5, 5, 1, 1).data;
        if (pixel[3] && pixel[0] > 245 && pixel[1] > 245 && pixel[2] > 245) result.raw++;
        result.checked++;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (const key of ['+', '+', '-', '+', '-', '-']) { await page.keyboard.press(key); await page.waitForTimeout(90); }
  await settled();
  const frames = await page.evaluate(() => { window.__zoomFrames.running = false; return window.__zoomFrames; });
  assert(frames.checked > 10 && frames.raw === 0, 'Zoom retains themed coverage without exposing default-white rasters', frames);
  const backend = await page.locator('.canvasWrapper canvas').first().getAttribute('data-color-backend');
  assert(['webgl2', 'cpu'].includes(backend), 'Recoloring reports its actual local backend', backend);
  await page.keyboard.press('w'); const fit = await page.locator('#zoom-value').textContent();
  await page.keyboard.press('W');
  await page.waitForFunction(value => document.querySelector('#zoom-value').textContent !== value, fit);
  assert(parseInt(await page.locator('#zoom-value').textContent()) > parseInt(fit), 'Smart width enlarges text by excluding outer margins', { fit, smart: await page.locator('#zoom-value').textContent() });
  await page.keyboard.press('e'); await page.getByRole('combobox', { name: 'Find an equation', exact: true }).fill('2'); await page.getByRole('option').first().waitFor(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#portal').getAttribute('aria-busy') === 'false');
  const geometry = await page.locator('#portal').evaluate(node => ({ width: node.clientWidth, viewport: innerWidth, border: getComputedStyle(node).borderTopWidth, shadow: getComputedStyle(node).boxShadow, dimmed: !document.querySelector('#preview-backdrop').hidden, full: document.querySelector('#portal-scroll').scrollWidth <= document.querySelector('#portal-scroll').clientWidth + 1, rounded: getComputedStyle(document.querySelector('#portal-scroll')).borderRadius }));
  assert(geometry.width >= geometry.viewport * .85 && geometry.border === '0px' && geometry.shadow !== 'none' && geometry.dimmed && geometry.full && geometry.rounded !== '0px', 'Larger borderless preview dims the page and shows full lines in a rounded viewport', geometry);
  await page.screenshot({ path: 'output/playwright/v060-preview.png', animations: 'disabled' });
  const mainZoom = await page.locator('#zoom-value').textContent();
  const previewZoom = await page.locator('#portal-canvas').getAttribute('data-document-scale');
  await page.locator('#portal-scroll').focus(); await page.keyboard.press('+');
  await page.waitForFunction(value => document.querySelector('#portal').getAttribute('aria-busy') === 'false' && document.querySelector('#portal-canvas').dataset.documentScale !== value, previewZoom);
  assert(await page.locator('#zoom-value').textContent() === mainZoom, 'Keyboard zoom acts on the focused preview without changing the underlying page');
  await page.locator('#portal-scroll').focus(); await page.keyboard.press('Tab');
  assert(await page.locator('#portal').evaluate(node => node.contains(document.activeElement)), 'Floating preview keeps keyboard focus inside its controls');
  await page.keyboard.press('P'); await page.waitForFunction(() => document.body.classList.contains('has-portal'));
  assert(await page.locator('#preview-backdrop').isHidden() && await page.locator('#reading-stage').evaluate(node => !node.inert), 'Pinning removes modal dimming and returns access to the paper');
  await page.keyboard.press('Escape');
  await page.keyboard.press(','); await page.getByLabel('Vimium compatibility', { exact: true }).check(); await page.keyboard.press('Escape');
  const before = await page.locator('#viewer-container').evaluate(node => node.scrollTop);
  await page.keyboard.press('j'); await page.keyboard.press('t'); await page.keyboard.press('r'); await page.keyboard.press('X');
  assert(await page.locator('#viewer-container').evaluate(node => node.scrollTop) === before && !await page.locator('#reading-ruler').isVisible(), 'Vimium mode does not consume plain scrolling, tab, reload or restore keys');
  await page.keyboard.press(':'); await page.getByRole('combobox', { name: 'Find a command', exact: true }).fill('Smart width');
  assert(await page.getByRole('option').count() === 1, 'PDF options remain keyboard-accessible through colon commands in Vimium mode');
  await page.keyboard.press('Escape'); await page.keyboard.press(','); await page.getByLabel('Vimium compatibility', { exact: true }).uncheck(); await page.keyboard.press('Escape');
  const reserved = await page.evaluate(() => ['x', 'X'].map(key => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.querySelector('#viewer-container').dispatchEvent(event); return !event.defaultPrevented;
  }));
  assert(reserved.every(Boolean), 'Web reader leaves x and X available to browser tab tooling');
  const browserKeys = await page.evaluate(() => ['d', 'u', 'PageDown', 'PageUp'].map(key => {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
    document.querySelector('#viewer-container').dispatchEvent(event); return !event.defaultPrevented;
  }));
  assert(browserKeys.every(Boolean), 'Browser bookmark, source, and tab-navigation shortcuts are not intercepted');
  return { passed: checks.length, checks, backend, frames };
}
