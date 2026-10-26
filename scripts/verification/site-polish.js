async (page) => {
  const base = new URL(page.url()).origin, checks = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  await page.goto(base);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert(await page.locator('.skip').evaluate(node => getComputedStyle(node).clipPath !== 'none'), 'Skip link stays visually hidden until keyboard focus');
  await page.keyboard.press('Tab');
  assert(await page.locator('.skip').evaluate(node => node === document.activeElement && getComputedStyle(node).clipPath === 'none'), 'Keyboard users can still reveal the skip link');
  await page.locator('h1').click();
  assert(await page.evaluate(() => document.designMode === 'off' && !document.querySelector('h1').isContentEditable), 'Ordinary page copy is not editable');
  assert(await page.locator('h1').evaluate(node => getComputedStyle(node).caretColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(node).cursor === 'default'), 'Static copy has no site insertion caret or text-input pointer');
  assert(await page.locator('h1').evaluate(node => {
    const range = document.createRange(); range.selectNodeContents(node);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    return selection.toString().replace(/\s+/g, '') === node.textContent.replace(/\s+/g, '') && getComputedStyle(node).userSelect !== 'none';
  }), 'Text selection remains available instead of disabling selection globally');
  await page.locator('#tab-flow').click();
  await page.locator('#scene-flow').focus();
  await page.keyboard.press(':');
  const input = page.locator('#demo-command');
  await input.waitFor({ state: 'visible' });
  assert(await input.evaluate(node => getComputedStyle(node).caretColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(node).cursor === 'text'), 'Real command input keeps a visible insertion caret');
  await input.fill('width');
  assert(await input.inputValue() === 'width', 'Real text input remains editable');
  await page.keyboard.press('Escape');
  await page.locator('[data-target=chrome]').focus();
  assert(await page.locator('[data-target=chrome]').evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), 'Keyboard focus remains visibly outlined');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: polished page has no horizontal overflow`);
    if (width === 1440) await page.screenshot({ path: 'output/playwright/site-polish-desktop.png', fullPage: true });
    if (width === 390) {
      await page.locator('#download').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'output/playwright/site-polish-phone-downloads.png' });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.locator('.download-card').first().evaluate(node => getComputedStyle(node).transitionDuration === '0s'), 'Reduced motion disables new hover transitions');
  return { passed: checks.length, checks };
}
