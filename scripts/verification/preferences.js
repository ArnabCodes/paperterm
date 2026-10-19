async (page) => {
  page.setDefaultTimeout(10000);
  await page.keyboard.press('Escape');
  await page.locator('#file-input').setInputFiles('dist/sample.pdf');
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  await page.keyboard.press(',');
  await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click();
  await page.getByRole('button', { name: 'Add a color replacement', exact: true }).click();
  await page.getByLabel('Source color 1', { exact: true }).fill('#ffffff');
  await page.getByLabel('Source color 1', { exact: true }).dispatchEvent('change');
  await page.getByLabel('Replacement color 1', { exact: true }).fill('#e8d5b0');
  await page.getByLabel('Replacement color 1', { exact: true }).dispatchEvent('change');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.canvasWrapper canvas');
    if (!canvas) return false;
    const pixel = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
    return pixel[0] === 232 && pixel[1] === 213 && pixel[2] === 176;
  });
  if (await page.evaluate(() => document.documentElement.style.getPropertyValue('--pdf-background')) !== '#e8d5b0') throw new Error('Pending-page background must honor a white replacement with recoloring disabled');
  await page.keyboard.press('p');
  await page.getByRole('combobox', { name: 'Go to page', exact: true }).fill('4');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page-current').textContent === '4');
  await page.locator('#file-input').setInputFiles('output/playwright/fixtures/tracemonkey.pdf');
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '14' && document.querySelector('#loading').hidden);
  await page.keyboard.press('O');
  await page.getByRole('option').filter({ hasText: 'sample.pdf' }).click();
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  await page.waitForFunction(() => document.querySelector('#page-current').textContent === '4');
  await page.keyboard.press(',');
  await page.getByRole('button', { name: 'Reset to Paper', exact: true }).click();
  await page.keyboard.press('Escape');
  return { passed: 3, checks: ['Palette replacement changes actual source-color pixels', 'Pending-page placeholder honors custom paper even with recoloring disabled', 'Reopened local PDF resumes its saved page despite the initial URL fragment'] };
}
