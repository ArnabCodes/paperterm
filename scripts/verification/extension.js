async (page) => {
  page.setDefaultTimeout(12000);
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  await page.goto('http://127.0.0.1:4180/paper?first=one&second=two#page=3');
  await page.getByText('6 pages · Your private reading space', { exact: true }).waitFor();
  assert(page.url().startsWith('chrome-extension://'), 'PDF MIME redirects even without a .pdf suffix');
  assert(page.url().includes('first=one&second=two'), 'Source query parameters survive interception');
  assert(await page.locator('#page-current').innerText() === '3', 'PDF page fragment survives interception');
  await page.keyboard.press('c');
  await page.getByRole('combobox', { name: 'Find a citation', exact: true }).fill('Bush');
  await page.getByRole('option').first().waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Reference [1]', exact: true }).waitFor();
  assert(await page.locator('#portal-page').innerText() === 'Page 6', 'Rust WASM lookup works under extension CSP');
  await page.goto('http://127.0.0.1:4180/html.pdf');
  await page.getByRole('heading', { name: 'Not a PDF', exact: true }).waitFor();
  assert(page.url().startsWith('http://'), 'HTML with .pdf suffix is not intercepted');
  const download = page.waitForEvent('download');
  await page.goto('http://127.0.0.1:4180/attachment').catch(() => {});
  assert((await download).suggestedFilename() === 'guide.pdf', 'Attachment downloads are not intercepted');
  return { passed: checks.length, checks };
}
