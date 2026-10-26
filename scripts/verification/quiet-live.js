async (page) => {
  const checks = [], requests = [], errors = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  await page.unroute('https://api.openalex.org/**');
  page.on('request', request => { if (request.url().startsWith('https://api.openalex.org/')) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('pipit.field.')) localStorage.removeItem(key); const input = document.querySelector('#field-auto'); input.checked = true; input.dispatchEvent(new Event('change')); });
  await page.locator('#file-input').setInputFiles('output/playwright/fixtures/tracemonkey.pdf');
  await page.waitForFunction(() => document.querySelector('#page-total')?.textContent === '14' && document.querySelector('#engine-status')?.textContent.includes('Ready'));
  assert(requests.length === 0, 'Real research paper opens without citation API requests');
  await page.keyboard.press('g'); await page.keyboard.press('c');
  await page.waitForFunction(() => !document.querySelector('#field-map').hidden && document.querySelectorAll('.field-node').length > 3, null, { timeout: 60000 });
  assert((await page.locator('#field-details h3').textContent()).includes('Trace'), 'First opening automatically identifies the actual research paper');
  assert(await page.locator('.field-identification').getAttribute('open') === null, 'Actual title match bypasses redundant search controls');
  await page.selectOption('#field-direction', 'citations');
  await page.locator('#field-depth').fill('3'); await page.locator('#field-depth').dispatchEvent('change');
  await page.waitForFunction(() => document.querySelector('#field-status').textContent.includes('Up to 3 hops'), null, { timeout: 60000 });
  const layers = await page.locator('.field-node').evaluateAll(nodes => nodes.map(node => Number(node.dataset.depth)));
  assert(layers.includes(2) && layers.includes(3), 'Live API returns real second- and third-order citing works');
  assert(layers.length <= 120 && Math.max(...layers) <= 3, 'Live expansion respects work and depth bounds');
  const snapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('pipit.field.v2:') && key.endsWith(':citations:3'));
    const value = key ? JSON.parse(localStorage.getItem(key)) : null;
    return value && { works: value.works.length, edges: value.edges.length, warnings: value.warnings, pdfWorks: value.works.filter(work => work.pdfUrl).map(work => ({ id: work.id, url: work.pdfUrl })) };
  });
  let pdf = '';
  if (snapshot?.pdfWorks.length) {
    const visible = new Set(await page.locator('.field-node').evaluateAll(nodes => nodes.map(node => node.dataset.work)));
    const candidate = snapshot.pdfWorks.find(work => visible.has(work.id));
    if (candidate) {
      await page.locator(`.field-node[data-work="${candidate.id}"]`).click();
      pdf = await page.locator('#field-details').getByRole('link', { name: 'Open PDF ↗', exact: false }).getAttribute('href');
      assert(new URL(pdf).searchParams.get('file') === candidate.url, 'A real selected work opens its provider-indexed PDF through Pipit');
    }
  }
  await page.locator('#field-svg').evaluate(node => node.focus());
  await page.screenshot({ path: 'output/playwright/quiet-live-citations.png' });
  const count = requests.length;
  await page.keyboard.press('Escape'); await page.keyboard.press('g'); await page.keyboard.press('c');
  assert(requests.length === count && await page.locator('#field-map').isVisible(), 'Live network reopens without a new search or graph fetch');
  assert(errors.length === 0, `No runtime errors: ${errors.join('; ')}`);
  return { passed: checks.length, checks, snapshot, providerRequests: requests.length, selectedPdf: pdf };
}
