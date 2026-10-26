async (page) => {
  const base = new URL(page.url()).origin, checks = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  await page.goto(base);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert((await page.locator('h1').textContent()).includes('PDF reader'), 'Headline identifies the product instead of using a slogan');
  assert(await page.locator('#features .feature-card').count() === 8, 'Eight distinct feature explanations are visible without expanding a menu');
  const copy = await page.locator('#features').textContent();
  for (const phrase of ['Two-column', '23 themes', 'two-page view', 'cited Markdown', 'resize the pane', '1–3 hops', 'three-column', 'OpenAlex']) assert(copy.includes(phrase), `Feature explanation includes ${phrase}`);
  assert(copy.includes('not embedded PDF annotations') && copy.includes('permission picker') && copy.includes('bounded samples'), 'Annotation, folder-permission and citation-coverage limits remain explicit');
  assert(!(await page.locator('.faq-list').textContent()).includes('cross-paper graphs aren’t supported'), 'FAQ no longer contradicts the released citation-network feature');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: expanded feature copy fits the page`);
    if (width === 1440) {
      await page.screenshot({ path: 'output/playwright/feature-copy-desktop.png', fullPage: true });
      await page.locator('#features').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'output/playwright/feature-copy-cards.png' });
      for (const id of ['peek', 'flow', 'palette', 'map']) {
        await page.locator(`#tab-${id}`).click();
        await page.locator('.reader-stage').screenshot({ path: `output/playwright/feature-copy-demo-${id}.png` });
      }
    }
    if (width === 390) {
      await page.locator('#features').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'output/playwright/feature-copy-phone.png' });
    }
  }
  return { passed: checks.length, checks };
}
