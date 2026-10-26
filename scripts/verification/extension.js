async (page) => {
  page.setDefaultTimeout(12000);
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  await page.goto('http://127.0.0.1:4180/paper?first=one&second=two#page=3');
  await page.waitForURL('chrome-extension://**');
  await page.waitForFunction(() => document.querySelector('#page-total')?.textContent === '6' && document.querySelector('#loading')?.hidden);
  assert(page.url().startsWith('chrome-extension://'), 'PDF MIME redirects even without a .pdf suffix');
  assert(page.url().includes('first=one&second=two'), 'Source query parameters survive interception');
  assert(await page.locator('#page-current').textContent() === '3', 'PDF page fragment survives interception');
  await page.keyboard.press('c');
  await page.getByRole('combobox', { name: 'Find a citation', exact: true }).fill('Bush');
  await page.getByRole('option').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(label => document.querySelector('#portal-title')?.textContent === label && !document.querySelector('#portal')?.hidden, "Reference [1]");
  assert(await page.locator('#portal-page').innerText() === 'Page 6', 'Rust WASM lookup works under extension CSP');
  await page.goto('http://127.0.0.1:4180/html.pdf');
  await page.getByRole('heading', { name: 'Not a PDF', exact: true }).waitFor();
  assert(page.url().startsWith('http://'), 'HTML with .pdf suffix is not intercepted');
  const downloads = [];
  const recordDownload = download => downloads.push(download);
  page.on('download', recordDownload);
  try {
    await page.goto('http://127.0.0.1:4180/attachment');
    await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
    assert(page.url().startsWith('chrome-extension://'), 'Attachment-style PDF opens in the viewer');
    assert(downloads.length === 0, 'Opening a remote attachment creates no Downloads file');
    const explicitDownload = page.waitForEvent('download');
    await page.keyboard.press('t');
    await page.getByRole('button', { name: 'Download original PDF', exact: true }).click();
    assert((await explicitDownload).suggestedFilename().endsWith('.pdf'), 'Explicit Download button still saves a PDF');
    await page.goto('http://127.0.0.1:4180/html.pdf');
    const bypassDownload = page.waitForEvent('download');
    await page.goto('http://127.0.0.1:4180/attachment?paperterm-download=1').catch(() => {});
    assert((await bypassDownload).suggestedFilename() === 'guide.pdf', 'Explicit URL download bypass is preserved');
  } finally { page.off('download', recordDownload); }
  return { passed: checks.length, checks };
}
