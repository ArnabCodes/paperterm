async (page) => {
  const checks = [], requests = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const base = page.url().startsWith('chrome-extension:') ? new URL('.', page.url()).href.replace(/\/$/, '') : 'http://127.0.0.1:4173';
  const pdf = await (await page.request.get('http://127.0.0.1:4173/sample.pdf')).body();
  const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' };
  await page.setViewportSize({ width: 1440, height: 960 });
  const reported = 'https://www.sciencedirect.com/science/article/pii/S0016236109004967?via%3Dihub';
  await page.route('https://www.sciencedirect.com/**', async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', headers, body: '<meta name="citation_pdf_url" content="/science/article/pii/S0016236109004967/pdfft?token=test&amp;download=true">' });
  });
  await page.route('https://www.sciencedirect.com/**/pdfft?*', route => route.fulfill({ contentType: 'application/pdf', headers, body: pdf }));
  await page.goto(`${base}/index.html?source=${reported}`);
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  assert(requests.includes(reported), 'Reported ScienceDirect article URL is resolved before PDF rendering (simulated publisher response)');
  assert(await page.locator('#welcome').isHidden(), 'Discovered ScienceDirect PDF opens in the reader');
  const cases = [
    ['metadata', '<meta name="citation_pdf_url" content="/paper.pdf?access=one&amp;id=two">'],
    ['typed-link', '<link rel="alternate" type="application/pdf" href="/paper.pdf">'],
    ['structured', '<script type="application/ld+json">{"encoding":{"encodingFormat":"application/pdf","contentUrl":"/paper.pdf"}}</script>'],
    ['anchor', '<a href="/paper.pdf">View PDF</a>'],
    ['relative', '<a href="../paper.pdf">Download PDF</a>'],
    ['inert', '<base href="https://untrusted.invalid/"><script>window.publisherScriptExecuted=true</script><meta name="citation_pdf_url" content="/paper.pdf">'],
  ];
  await page.route('https://publisher.example/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.pdf')) return route.fulfill({ contentType: 'application/pdf', headers, body: pdf });
    const body = cases.find(([name]) => url.pathname.endsWith(name))?.[1] || '<a href="javascript:alert(1)">View PDF</a><a href="/supporting.pdf">Supplementary PDF</a>';
    await route.fulfill({ contentType: 'text/html', headers, body });
  });
  for (const [name] of cases) {
    await page.goto(`${base}/index.html?article=${encodeURIComponent(`https://publisher.example/article/${name}`)}`);
    await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
    assert(await page.locator('#welcome').isHidden(), `${name}: publisher link resolves and renders a real local PDF fixture`);
    if (name === 'inert') assert(!await page.evaluate(() => window.publisherScriptExecuted), 'Publisher HTML is parsed inertly without executing its scripts or honoring its base URL');
  }
  await page.goto(`${base}/index.html?article=${encodeURIComponent('https://publisher.example/article/unsafe')}`);
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('No PDF link found'));
  assert(await page.locator('#welcome').isVisible(), 'Unsafe and supplementary-only links do not masquerade as the main PDF');
  const seed = { id: 'https://openalex.org/W123456', display_name: 'The art of following an idea', publication_year: 2026, cited_by_count: 10, doi: 'https://doi.org/10.1234/pipit-test', referenced_works: [], related_works: [], authorships: [] };
  await page.route('https://api.openalex.org/**', route => route.fulfill({ json: route.request().url().includes('/works/W123456?') ? seed : { results: [seed] }, headers }));
  let denied = true;
  await page.route('https://doi.org/10.1234/pipit-test', route => route.fulfill(denied ? { status: 403, headers, body: 'Institutional sign-in needed' } : { contentType: 'text/html', headers, body: '<meta name="citation_pdf_url" content="https://publisher.example/paper.pdf">' }));
  await page.goto(`${base}/index.html?demo=1&publisher-test=graph`);
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('pipit.field.')) localStorage.removeItem(key); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  await page.keyboard.press('g'); await page.keyboard.press('c');
  await page.locator('[data-publisher-retry]').waitFor();
  assert((await page.locator('#field-pdf-actions').textContent()).includes('HTTP 403'), 'Publisher denial shows access guidance and a retry instead of a false PDF link');
  denied = false;
  await page.locator('[data-publisher-retry]').click();
  await page.locator('#field-pdf-actions a').waitFor();
  const link = await page.locator('#field-pdf-actions a').getAttribute('href');
  assert(new URL(link).searchParams.get('file') === 'https://publisher.example/paper.pdf', 'Citation graph discovers a publisher PDF absent from OpenAlex and opens it through Pipit');
  assert((await page.locator('#field-pdf-actions').textContent()).includes('Publisher PDF metadata'), 'Citation graph distinguishes publisher-discovered link provenance');
  await page.screenshot({ path: 'output/playwright/publisher-graph.png' });
  return { passed: checks.length, checks };
}
