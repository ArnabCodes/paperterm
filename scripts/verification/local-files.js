async (page) => {
  const checks = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const base = 'http://127.0.0.1:4192';
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${base}/?demo=1&review=local-files`);
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('pipit-local-folder');
      request.onsuccess = resolve; request.onerror = reject;
    });
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  await page.keyboard.press('o');
  assert(await page.getByText('Show files on your computer', { exact: true }).isVisible(), 'Open defaults to an actionable local-files view, not an empty recent library');
  assert(await page.locator('#file-browser .files-columns > section').count() === 3, 'Three-column navigation is retained');
  assert(await page.locator('#file-browser input[webkitdirectory]').count() === 1, 'Folder-selection fallback is attached to the dialog');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle('Pipit-local-review', { create: true });
    const child = await folder.getDirectoryHandle('Equations', { create: true });
    const bytes = await (await fetch('/sample.pdf')).arrayBuffer();
    for (const [directory, name] of [[folder, 'Overview.pdf'], [child, 'Methods.pdf']]) {
      const file = await directory.getFileHandle(name, { create: true });
      const stream = await file.createWritable(); await stream.write(bytes); await stream.close();
    }
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async options => {
      window.localPickerOptions = options;
      return folder;
    } });
  });
  await page.locator('.files-locations [data-files=downloads]').click();
  await page.waitForFunction(() => document.querySelectorAll('#file-browser [role=option]').length === 2);
  assert(await page.evaluate(() => window.localPickerOptions.startIn === 'downloads' && window.localPickerOptions.mode === 'read'), 'Downloads shortcut requests a read-only folder picker starting in Downloads');
  assert((await page.locator('#file-browser [role=option]').allTextContents()).some(text => text.includes('Overview.pdf')), 'Chosen folder lists its PDFs');
  await page.locator('#file-browser [role=listbox]').focus();
  await page.keyboard.press('l');
  await page.waitForFunction(() => document.querySelector('#file-browser nav')?.textContent.includes('Equations'));
  assert((await page.locator('#file-browser [role=option]').textContent()).includes('Methods.pdf'), 'Keyboard folder navigation lists nested PDFs');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  await page.keyboard.press('o');
  await page.waitForFunction(() => document.querySelectorAll('#file-browser [role=option]').length === 2);
  assert((await page.locator('#file-browser nav').textContent()).includes('Pipit-local-review'), 'A real serializable directory handle restores local PDFs after reload');
  await page.locator('.files-tools [data-files=recent]').click();
  await page.waitForFunction(() => document.querySelector('#file-browser nav')?.textContent.includes('Recent PDFs'));
  await page.locator('.files-tools [data-files=local]').click();
  await page.waitForFunction(() => document.querySelectorAll('#file-browser [role=option]').length === 2);
  assert(true, 'Local files can be restored from the Recent view without reconnecting');
  await page.screenshot({ path: 'output/playwright/local-files-restored.png' });
  await page.locator('#file-browser [role=listbox]').focus();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.title.includes('Overview') && !document.querySelector('#file-browser').open && document.querySelector('#engine-status')?.textContent.includes('Ready'));
  assert(true, 'Enter reads the selected local PDF with the actual renderer');
  await page.keyboard.press('o');
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined });
    const transfer = new DataTransfer();
    const file = new File(['fixture'], 'Fallback.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Fallback/Research/Fallback.pdf' });
    transfer.items.add(file);
    const input = document.querySelector('#file-browser input[webkitdirectory]');
    input.files = transfer.files; input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => document.querySelector('#file-browser [role=option]')?.textContent.includes('Research'));
  await page.locator('#file-browser [role=listbox]').focus(); await page.keyboard.press('l');
  await page.waitForFunction(() => document.querySelector('#file-browser [role=option]')?.textContent.includes('Fallback.pdf'));
  assert(true, 'Directory-input fallback preserves local relative paths');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('Pipit-local-review');
    window.localReadAllowed = true; window.localPermissionRequests = 0;
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => ({
      kind: 'directory', name: 'Permission review', values: () => directory.values(),
      queryPermission: async () => window.localReadAllowed ? 'granted' : 'prompt',
      requestPermission: async () => { window.localPermissionRequests++; window.localReadAllowed = true; return 'granted'; },
    }) });
  });
  await page.keyboard.press('o');
  await page.locator('.files-tools [data-files=folder]').click();
  await page.waitForFunction(() => document.querySelectorAll('#file-browser [role=option]').length === 2);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.localReadAllowed = false; });
  await page.keyboard.press('o');
  await page.getByText('Reconnect your folder', { exact: true }).waitFor();
  assert(await page.evaluate(() => window.localPermissionRequests === 0), 'Opening a remembered folder never silently requests new permission');
  await page.locator('[data-files=reconnect]').click();
  await page.waitForFunction(() => document.querySelectorAll('#file-browser [role=option]').length === 2);
  assert(await page.evaluate(() => window.localPermissionRequests === 1), 'Explicit reconnect restores listing after read permission expires');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('#file-browser').evaluate(dialog => dialog.getBoundingClientRect().width <= innerWidth), 'Local folder browser remains within the mobile viewport');
  await page.keyboard.press('Escape');
  return { passed: checks.length, checks };
}
