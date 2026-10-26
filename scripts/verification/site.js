async (page) => {
  const checks = [], errors = [], external = [];
  const base = new URL(page.url()).origin;
  const release = await (await page.request.get(`${base}/release.json`)).json();
  const artifact = base.startsWith('https:') ? 'v080-public-site' : 'v080-site';
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) external.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(base);
  await page.waitForFunction(() => document.querySelector('[data-target="chrome"]').href.includes('/downloads/'));
  await page.locator('#mascot').evaluate(image => image.decode());
  assert((await page.title()).startsWith('Pipit'), 'Pipit brand appears in title');
  assert(await page.locator('#mascot').evaluate(image => image.naturalWidth > 500), 'Generated mascot loads as a local asset');
  assert((await page.locator('.download-card.recommended').getAttribute('data-browser')) === 'chromium', 'Chromium gets a recommendation without hiding other packages');
  assert(await page.locator('.download-card').count() === 3, 'All three browser targets remain visible');
  assert((response.headers()['content-security-policy'] || '').includes("script-src 'self'"), 'Cloudflare headers apply a site CSP');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Desktop has no horizontal overflow');
  await page.screenshot({ path: `output/playwright/${artifact}-desktop.png`, fullPage: true });
  await page.locator('#tab-peek').click();
  await page.locator('#stage-reference').focus(); await page.keyboard.press('Enter');
  assert(await page.locator('#stage-portal').isVisible(), 'Reference illustration works with the keyboard');
  await page.keyboard.press('Escape');
  assert(await page.locator('#stage-portal').isHidden() && await page.locator('#stage-reference').evaluate(node => node === document.activeElement), 'Escape closes the preview and returns focus');
  await page.locator('#tab-palette').click();
  await page.locator('.stage-swatches').getByRole('button', { name: 'Night', exact: true }).click();
  assert(await page.locator('.reader-stage').getAttribute('data-palette') === 'night', 'Theme illustration changes to night');
  await page.locator('.stage-swatches').getByRole('button', { name: 'Paper', exact: true }).click();
  assert(await page.locator('.stage-swatches [aria-pressed="true"]').count() === 1, 'Theme buttons expose one selected state');
  for (const target of ['chrome', 'firefox', 'safari']) {
    const link = page.locator(`[data-target="${target}"]`);
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    assert(download.suggestedFilename().startsWith(`pipit-${release.version}-`), `${target} link downloads a real versioned artifact`);
    await download.saveAs(`output/playwright/${artifact}-download-${download.suggestedFilename()}`);
    const checksum = await page.request.get(new URL(await page.locator(`[data-checksum="${target}"]`).getAttribute('href'), base).href);
    assert(checksum.ok() && /^[a-f0-9]{64}  pipit-/.test(await checksum.text()), `${target} checksum is served`);
  }
  await page.locator('#install-browser').selectOption('firefox');
  assert((await page.locator('#install-content').textContent()).includes('Temporary Add-on'), 'Manual selection shows Firefox temporary-install steps');
  await page.locator('#install-browser').selectOption('safari');
  assert((await page.locator('#install-content').textContent()).includes('not an installable Safari extension'), 'Safari setup is clearly source-only');
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `output/playwright/${artifact}-phone.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.locator('#mascot').evaluate(node => getComputedStyle(node).animationName === 'none'), 'Reduced-motion preference stops decorative animation');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const path of ['/privacy.html', '/release-notes.html', '/licenses.html']) {
    const result = await page.goto(base + path);
    assert(result.ok() && await page.locator('h1').count() === 1, `${path} is a real readable page`);
  }
  const missing = await page.request.get(base + '/does-not-exist');
  assert(missing.status() === 404, 'Unknown URLs return a genuine 404');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const reader = await page.goto(base + '/reader/?demo=1');
  await page.waitForFunction(() => document.querySelector('#page-total')?.textContent === '6' && document.querySelector('#engine-status')?.textContent.includes('Ready'));
  assert((reader.headers()['content-security-policy'] || '').includes('wasm-unsafe-eval'), 'Web reader has its separate WASM-compatible CSP');
  await page.keyboard.press('e'); await page.getByRole('combobox', { name: 'Find an equation', exact: true }).fill('2');
  await page.getByRole('option').first().waitFor(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#portal')?.hidden && document.querySelector('#portal-canvas')?.width > 0);
  assert(await page.locator('#portal').isVisible(), 'Hosted reader performs real WASM equation lookup and renders a preview');
  assert(errors.length === 0, `No JavaScript runtime errors: ${errors.join('; ')}`);
  assert(external.length === 0, 'Landing page, downloads and local demo make no external requests');
  const browser = page.context().browser();
  for (const [label, userAgent, expected] of [
    ['Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0', 'firefox'],
    ['Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15', 'safari'],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', null],
  ]) {
    const context = await browser.newContext({ userAgent });
    try {
      const tab = await context.newPage(); await tab.goto(base);
      await tab.waitForFunction(() => document.querySelector('#install-content').textContent.length > 50);
      assert(expected ? await tab.locator(`.recommended[data-browser="${expected}"]`).count() === 1 : await tab.locator('.recommended').count() === 0 && (await tab.locator('#platform-note').textContent()).includes('desktop browsers only'), `${label} user-agent gets appropriate advice (detection test, not native-browser validation)`);
    } finally { await context.close(); }
  }
  const noScripts = await browser.newContext({ javaScriptEnabled: false });
  try {
    const tab = await noScripts.newPage(); await tab.goto(base);
    assert((await tab.locator('[data-target="chrome"]').getAttribute('href')).startsWith('/downloads/') && (await tab.locator('#install-content').textContent()).includes('JavaScript is disabled'), 'Downloads and setup remain usable without JavaScript');
  } finally { await noScripts.close(); }
  const offlineMetadata = await browser.newContext();
  try {
    const tab = await offlineMetadata.newPage();
    await tab.route('**/release.json', route => route.abort());
    await tab.goto(base);
    await tab.waitForFunction(() => document.querySelector('#platform-note').textContent.includes('metadata could not be loaded'));
    assert((await tab.locator('[data-target="chrome"]').getAttribute('href')).startsWith('/downloads/'), 'Metadata failure does not disable build-verified download links');
    await tab.locator('#tab-peek').click(); await tab.locator('#stage-reference').click();
    assert(await tab.locator('#stage-portal').isVisible(), 'Metadata failure leaves page interactions usable');
  } finally { await offlineMetadata.close(); }
  return { passed: checks.length, checks };
}
