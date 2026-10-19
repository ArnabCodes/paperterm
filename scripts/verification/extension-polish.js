async (page) => {
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  await page.goto('http://127.0.0.1:4180/paper');
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  await page.keyboard.press(','); await page.getByRole('button', { name: 'Dracula', exact: true }).click(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.canvasWrapper canvas')?.dataset.colorBackend && !document.querySelector('canvas[data-recoloring]'));
  const backend = await page.locator('.canvasWrapper canvas').first().getAttribute('data-color-backend');
  assert(['webgl2','cpu'].includes(backend), 'Local color backend runs under the extension CSP');
  const scratch = await page.context().newPage();
  await scratch.goto(page.url());
  await scratch.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  const closed = scratch.waitForEvent('close'); await scratch.keyboard.press('x'); await closed;
  assert(!page.isClosed(), 'x closes only the current extension tab');
  return { passed: checks.length, checks, backend };
}
