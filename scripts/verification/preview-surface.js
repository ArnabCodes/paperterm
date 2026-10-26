async (page) => {
  page.setDefaultTimeout(10000);
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  const preview = page.locator('#portal');
  const ready = () => page.waitForFunction(() => !document.querySelector('#portal').hidden && document.querySelector('#portal').getAttribute('aria-busy') === 'false' && document.querySelector('#portal').getAnimations().every(animation => animation.playState === 'finished'));
  const open = async () => {
    await page.keyboard.press('e');
    await page.getByRole('combobox', { name: 'Find an equation', exact: true }).fill('2');
    await page.getByRole('option').first().waitFor(); await page.keyboard.press('Enter'); await ready();
  };
  const geometry = () => preview.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { ratio: box.width / box.height, expected: innerWidth / innerHeight, centerX: box.x + box.width / 2 - innerWidth / 2, centerY: box.y + box.height / 2 - innerHeight / 2, width: box.width, right: box.right, left: box.left };
  });
  try {
    await page.goto('http://127.0.0.1:4173/?demo=1&verify=surface#page=1'); await page.reload();
    await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden && document.querySelector('#engine-status').textContent.includes('Ready'));
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.keyboard.press('w'); await page.keyboard.press('+');
    const main = await page.locator('#viewer-container').boundingBox();
    const top = await page.locator('#viewer-container').evaluate(node => node.scrollTop);
    await open();
    let box = await geometry();
    assert(Math.abs(box.centerX) < 1 && Math.abs(box.centerY) < 1, 'Content preview stays centered');
    assert(await page.locator('.portal-heading').isHidden() && await page.locator('.portal-footer, .portal-tip').count() === 0, 'Preview displays only PDF content without header or footer controls');
    const mainScale = parseFloat(await page.locator('#zoom-value').textContent()) / 100;
    const scale = Number(await page.locator('#portal-canvas').getAttribute('data-document-scale'));
    assert(scale > 0 && await page.locator('#portal-scroll').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Content preview fits the complete detected width');
    assert((await page.locator('#viewer-container').boundingBox()).width === main.width && await page.locator('#viewer-container').evaluate(node => node.scrollTop) === top, 'Opening a preview preserves the main document geometry and reading position');
    await page.screenshot({ path: 'output/playwright/v05-centered-preview.png', animations: 'disabled' });
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.waitForFunction(() => {
      const box = document.querySelector('#portal').getBoundingClientRect();
      return box.width <= innerWidth && document.querySelector('#portal').getAttribute('aria-busy') === 'false';
    });
    box = await geometry();
    assert(Math.abs(box.centerX) < 1 && Math.abs(box.centerY) < 1, 'Window resizing updates preview proportions and keeps it centered');
    await page.keyboard.press('P'); await ready();
    const handle = page.getByRole('separator', { name: 'Resize reference panel', exact: true });
    await handle.waitFor();
    assert(await handle.isVisible(), 'Pinned preview exposes an accessible resize handle');
    await page.waitForFunction(() => document.querySelector('#portal').getAnimations().every(animation => animation.playState === 'finished'));
    await handle.focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => Math.abs(document.querySelector('#portal').clientWidth - Number(document.querySelector('#portal-resizer').getAttribute('aria-valuenow'))) < 1);
    const before = await preview.boundingBox();
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down(); await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(width => document.querySelector('#portal').clientWidth > width + 90, before.width);
    assert((await preview.boundingBox()).width > before.width + 90, 'Dragging the separator resizes the side preview');
    const width = (await preview.boundingBox()).width;
    await handle.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(width => Math.abs(document.querySelector('#portal').clientWidth - (width - 32)) < 1, width);
    const resized = await preview.boundingBox();
    const resizeState = await handle.evaluate(node => ({ value: node.getAttribute('aria-valuenow'), focus: document.activeElement.id, minimum: node.getAttribute('aria-valuemin') }));
    assert(Math.abs(resized.width - (width - 32)) < 1, `Side preview width can also be adjusted with arrow keys (${JSON.stringify({ width, resized: resized.width, ...resizeState })})`);
    const savedWidth = (await preview.boundingBox()).width;
    assert(Math.abs(await page.evaluate(() => JSON.parse(localStorage.getItem('paperterm.preview-width'))) - savedWidth) < 1, 'User-selected side preview width is saved locally');
    await page.keyboard.press('End');
    assert((await page.locator('#viewer-container').boundingBox()).width >= 270, 'Resize limits preserve room for the main document');
    await page.keyboard.press('P'); await ready();
    await page.waitForFunction(() => document.querySelector('#portal').getAnimations().every(animation => animation.playState === 'finished'));
    box = await geometry();
    assert(Math.abs(box.centerX) < 1, 'Unpinning restores the centered content preview');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    await page.waitForFunction(() => document.querySelector('#portal').getAnimations().every(animation => animation.playState === 'finished'));
    box = await geometry();
    assert(box.left >= 0 && box.right <= 390, 'Portrait content preview stays within the viewport');
    await page.screenshot({ path: 'output/playwright/v05-portrait-preview.png', animations: 'disabled' });
    await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1440, height: 960 });
    await page.mouse.move(700, 300); await page.keyboard.press('Escape');
    const dock = await page.locator('#reader-toolbar').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, blur: getComputedStyle(node).backdropFilter, opacity: getComputedStyle(node).opacity }));
    assert(dock.background.includes('0.24') && dock.blur.includes('28px') && dock.opacity === '1', 'Resting dock has 24 percent background opacity and continuous backdrop blur');
    assert(['anchored', 'reduced'].includes(await page.locator('#reader-toolbar').getAttribute('data-motion')), 'Dock keeps core targets anchored while tools fan out');
    await page.keyboard.press(',');
    await page.getByRole('checkbox', { name: 'Frosted panels', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    assert(await page.locator('#reader-toolbar').evaluate(node => getComputedStyle(node).backdropFilter.includes('blur')), 'Dock remains blurred when other panels use solid surfaces');
    await page.keyboard.press(','); await page.getByRole('checkbox', { name: 'Frosted panels', exact: true }).check(); await page.keyboard.press('Escape');
    return { passed: checks.length, checks };
  } catch (error) {
    const diagnostic = await preview.evaluate(node => ({ width: node.clientWidth, busy: node.getAttribute('aria-busy'), focus: document.activeElement.id, handle: document.querySelector('#portal-resizer').getAttribute('aria-valuenow'), animations: node.getAnimations().map(animation => ({ state: animation.playState, time: animation.currentTime })) }));
    throw new Error(`After ${checks.length} checks (${checks.at(-1)}): ${error.message}; ${JSON.stringify(diagnostic)}`);
  }
}
