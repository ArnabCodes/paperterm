async (page) => {
  page.setDefaultTimeout(10000);
  const checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  const dock = page.locator('#reader-toolbar');
  const sample = frames => page.evaluate(frames => new Promise(resolve => {
    const samples = [];
    function next(time) {
      const dock = document.querySelector('#reader-toolbar');
      samples.push({ time, width: dock.getBoundingClientRect().width, content: document.querySelector('.dock-more-content').getBoundingClientRect().width });
      if (samples.length === frames) resolve(samples); else requestAnimationFrame(next);
    }
    requestAnimationFrame(next);
  }), frames);
  const settled = () => page.waitForFunction(() => document.querySelector('#reader-toolbar').dataset.animating === 'false');
  await page.goto('http://127.0.0.1:4173/?demo=1&verify=spring#page=1'); await page.reload();
  await page.waitForFunction(() => document.querySelector('#page-total').textContent === '6' && document.querySelector('#loading').hidden);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.keyboard.press('Escape'); await page.mouse.move(700, 300);
  const compact = await dock.boundingBox();
  await page.mouse.move(720, 917);
  const expansion = await sample(40);
  await settled();
  const full = (await dock.boundingBox()).width;
  assert(full > compact.width + 250, 'Spring expands the compact dock into its full tool strip');
  assert(expansion.filter(frame => frame.width > compact.width + 10 && frame.width < full - 10).length >= 6, 'Expansion passes through multiple intermediate sizes rather than jumping');
  assert(Math.max(...expansion.slice(1).map((frame, index) => Math.abs(frame.width - expansion[index].width))) < 100, 'Frame-to-frame dock motion remains bounded and continuous');
  assert(Math.max(...expansion.map(frame => frame.content)) - Math.min(...expansion.map(frame => frame.content)) < 1, 'Tool strip keeps a fixed intrinsic width while the glass frame expands');
  await page.mouse.move(700, 300);
  await page.waitForFunction(() => !document.body.classList.contains('dock-visible'));
  const contraction = await sample(40); await settled();
  assert(contraction.at(-1).width < contraction[0].width - 150 && Math.abs((await dock.boundingBox()).width - compact.width) < 1, 'Contraction eases back to the original compact width');
  await page.mouse.move(720, 917); await sample(6);
  await page.mouse.move(700, 300);
  await page.waitForFunction(() => !document.body.classList.contains('dock-visible'));
  await sample(4);
  const reversing = (await dock.boundingBox()).width;
  await page.mouse.move(720, 917);
  const reversed = (await dock.boundingBox()).width;
  assert(Math.abs(reversed - reversing) < 90, 'Re-entering during contraction preserves position instead of restarting the animation');
  await settled();
  const first = dock.locator('.dock-core button').first();
  const iconBox = await first.boundingBox();
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.querySelector('.dock-core button .app-icon')).transform;
    return transform !== 'none' && Number(transform.slice(7).split(',')[0]) > 1.05;
  });
  assert(true, 'Nearby dock icons magnify gently under the pointer');
  await page.screenshot({ path: 'output/playwright/v051-spring-dock.png', animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape'); await page.keyboard.press('F6');
  assert(await dock.getAttribute('data-motion') === 'reduced' && await dock.getAttribute('data-animating') === 'false', 'Reduced-motion mode exposes controls immediately without a spring');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('F6'); await settled();
  assert(await dock.evaluate(node => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth) && await page.locator('.dock-more').evaluate(node => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth), 'Spring menu and compact dock fit a portrait viewport');
  await page.keyboard.press('Escape'); await settled();
  assert(await dock.isVisible() && await page.locator('.dock-more').evaluate(node => node.inert), 'Closing leaves the compact dock visible and hidden tools inert');
  await page.setViewportSize({ width: 1440, height: 960 });
  return { passed: checks.length, checks, samples: { expansion, contraction } };
}
