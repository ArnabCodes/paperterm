async (page) => {
  const base = new URL(page.url()).origin, checks = [], errors = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base);
  await page.locator('.site-header').getByRole('link', { name: 'Docs', exact: true }).click();
  await page.getByRole('heading', { name: 'Pipit documentation', exact: true }).waitFor();
  assert(page.url().endsWith('/docs/'), 'Homepage Docs link opens the documentation route');
  assert(await page.locator('[data-doc-section]').count() === 10, 'Ten user-facing topics are available');
  assert(await page.locator('.docs-key-group').count() === 8, 'Keyboard guide contains eight generated sections');
  const query = page.getByRole('searchbox', { name: 'Search documentation' });
  await query.fill('sidecar');
  assert(await page.locator('#notes').isVisible() && await page.locator('#start').isHidden(), 'Local search filters to matching topics');
  await query.fill('no-matching-topic-32891');
  assert(await page.locator('#docs-empty').isVisible(), 'Search has an accessible empty state');
  await page.keyboard.press('Escape');
  assert(await query.inputValue() === '' && await page.locator('#start').isVisible(), 'Escape clears the docs filter');
  await page.locator('.docs-sidebar').getByRole('link', { name: 'Reference lens & split view', exact: true }).click();
  assert(page.url().endsWith('#references'), 'Topic navigation supports direct section links');
  assert(await page.locator('.docs-sidebar a[aria-current=location]').textContent() === 'Reference lens & split view', 'Current topic is exposed to assistive technology');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: docs have no horizontal overflow`);
    if (width === 1440) {
      await page.goto(`${base}/docs/`);
      await page.screenshot({ path: 'output/playwright/docs-desktop.png' });
    }
    if (width === 390) {
      await page.goto(`${base}/docs/#keyboard`);
      await page.screenshot({ path: 'output/playwright/docs-phone.png' });
    }
  }
  const noScripts = await page.context().browser().newContext({ javaScriptEnabled: false });
  try {
    const tab = await noScripts.newPage();
    const response = await tab.goto(`${base}/docs/`);
    assert(response.ok() && await tab.locator('[data-doc-section]:visible').count() === 10, 'Every topic is readable without JavaScript');
    assert(await tab.locator('.docs-search').isHidden(), 'No-JavaScript page does not expose a nonworking search field');
  } finally { await noScripts.close(); }
  assert(errors.length === 0, `No JavaScript errors: ${errors.join('; ')}`);
  return { passed: checks.length, checks };
}
