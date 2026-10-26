async (page) => {
  const checks = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent.includes('Ready'));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.mouse.move(width / 2, 925);
    await page.waitForTimeout(650);
    const geometry = await page.evaluate(() => {
      const measure = element => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { width: rect.width, height: rect.height, center: rect.y + rect.height / 2, color: style.color, opacity: style.opacity };
      };
      return {
        core: measure(document.querySelector('.dock-core .app-icon')),
        categories: [...document.querySelectorAll('.dock-category .app-icon')].map(measure),
        expanded: document.querySelector('#reader-toolbar').dataset.expanded,
      };
    });
    assert(geometry.expanded === 'true', `${width}px: dock expands on hover`);
    assert(geometry.categories.every(icon => icon.width === 20 && icon.height === 20), `${width}px: all extended icons match the core 20px size`);
    assert(geometry.categories.every(icon => icon.color === geometry.core.color && icon.opacity === '1'), `${width}px: extended icons match opaque core foreground`);
    const aligned = width > 760 ? geometry.categories : [geometry.categories[2], geometry.categories[5]];
    assert(aligned.every(icon => Math.abs(icon.center - geometry.core.center) < 1), `${width}px: icons share the core baseline`);
    await page.locator('[data-dock-group=appearance]').hover();
    assert(await page.locator('#dock-details').isVisible(), `${width}px: category hover menu remains accessible`);
    await page.keyboard.press('Escape');
    if (width === 1440) await page.screenshot({ path: 'output/playwright/dock-icons-desktop.png' });
  }
  console.log(JSON.stringify({ checks }, null, 2));
}
