async (page) => {
  page.setDefaultTimeout(10000);
  await page.keyboard.press('Escape');
  await page.locator('#file-input').setInputFiles('output/playwright/fixtures/encrypted.pdf');
  await page.getByRole('textbox', { name: 'PDF password', exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Unlock PDF', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#password-error').textContent.length > 0);
  await page.getByRole('textbox', { name: 'PDF password', exact: true }).fill('pipit-test');
  await page.getByRole('button', { name: 'Unlock PDF', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  await page.locator('#file-input').setInputFiles('output/playwright/fixtures/encrypted.pdf');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('heading', { name: 'Follow the idea. Keep your place.', exact: true }).waitFor();
  if (await page.locator('#loading').isVisible()) throw new Error('Password cancellation left the loading overlay visible');
  return { passed: 3, checks: ['Wrong password can be retried', 'Correct password opens the PDF', 'Password cancellation returns to usable welcome'] };
}
