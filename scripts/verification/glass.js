async (page) => {
  page.setDefaultTimeout(10000);
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  await page.keyboard.press('Escape');
  await page.keyboard.press('g'); await page.keyboard.press('o');
  const input = page.getByRole('combobox', { name: 'Open PDF from URL', exact: true });
  await input.fill('javascript:alert(1)');
  assert(await page.getByRole('option').count() === 0, 'URL opener rejects non-HTTP protocols');
  await input.fill('http://127.0.0.1:4173/sample.pdf');
  const downloads = [];
  const listener = download => downloads.push(download);
  page.on('download', listener);
  try {
    await page.getByRole('option').first().waitFor();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
    assert(downloads.length === 0, 'URL opener reads directly without a file download');
  } finally { page.off('download', listener); }
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('14px Inter') && [...document.fonts].some(font => font.family === 'Inter' && font.status === 'loaded')), 'Bundled Inter font loads locally');
  assert(await page.locator('#document-name').evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 14, 'Document title typography is larger');
  await page.keyboard.press(',');
  const glass = page.getByRole('checkbox', { name: 'Frosted panels', exact: true });
  await glass.check();
  assert(await page.getByRole('dialog', { name: 'Reading settings', exact: true }).evaluate(node => getComputedStyle(node).backdropFilter.includes('blur')), 'Frosted dialog uses real backdrop blur');
  for (const theme of ['Paper', 'Sepia', 'Night']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.screenshot({ path: `output/playwright/glass-settings-${theme.toLowerCase()}.png`, animations: 'disabled' });
  }
  await glass.uncheck();
  assert(await page.getByRole('dialog', { name: 'Reading settings', exact: true }).evaluate(node => getComputedStyle(node).backdropFilter) === 'none', 'Solid-panel setting disables blur');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  assert(await page.locator('html').getAttribute('data-glass') === 'false', 'Solid-panel preference survives reload');
  await page.keyboard.press(',');
  await page.getByRole('checkbox', { name: 'Frosted panels', exact: true }).check();
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('g'); await page.keyboard.press('g'); await page.keyboard.press('a');
  await page.screenshot({ path: 'output/playwright/glass-final-reader.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press(',');
  const dialog = page.getByRole('dialog', { name: 'Reading settings', exact: true });
  assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), 'Settings fit a narrow viewport without horizontal clipping');
  await page.screenshot({ path: 'output/playwright/glass-compact-settings.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('F6');
  const toolbar = page.locator('#reader-toolbar');
  assert(await toolbar.evaluate(node => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth) && await page.locator('.dock-more-content').evaluate(node => node.scrollWidth <= node.clientWidth), 'Reader toolbar fits a narrow viewport');
  await page.setViewportSize({ width: 1440, height: 960 });
  return { passed: checks.length, checks };
}
