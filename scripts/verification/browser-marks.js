async (page) => {
  const base = new URL(page.url()).origin, checks = [], errors = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.locator('#download').scrollIntoViewIfNeeded();
    await page.locator('.browser-symbol').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const marks = await page.locator('.browser-symbol').evaluateAll(images => images.map(image => {
      const rect = image.getBoundingClientRect(), style = getComputedStyle(image);
      return { loaded: image.complete && image.naturalWidth > 0, width: rect.width, height: rect.height, top: rect.top, filter: style.filter, opacity: style.opacity };
    }));
    assert(marks.length === 3 && marks.every(mark => mark.loaded && mark.width === 40 && mark.height === 40), `${width}px: all three original browser icons load in equal 40px boxes`);
    assert(marks.every(mark => mark.filter === 'none' && mark.opacity === '1'), `${width}px: browser colors stay unfiltered and opaque`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no horizontal page overflow`);
    if (width === 1440) {
      assert(marks.every(mark => Math.abs(mark.top - marks[0].top) < 1), 'Desktop browser icons share a common baseline');
      const headings = await page.locator('.download-card h3').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
      assert(headings.every(top => Math.abs(top - headings[0]) < 1), 'Browser card headings align across the row');
      await page.screenshot({ path: 'output/playwright/browser-marks-desktop-downloads.png' });
      await page.screenshot({ path: 'output/playwright/browser-marks-desktop-full.png', fullPage: true });
    }
    if (width === 390) await page.screenshot({ path: 'output/playwright/browser-marks-phone-full.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-target=chrome]').focus();
  await page.keyboard.press('Tab');
  assert(await page.locator('[data-select=chromium]').evaluate(node => node === document.activeElement), 'Download and setup links keep their keyboard order');
  assert(errors.length === 0, 'No JavaScript runtime errors');
  return { passed: checks.length, checks };
}
