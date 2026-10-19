async (page) => {
  page.setDefaultTimeout(30000);
  await page.setViewportSize({ width: 1440, height: 960 });
  const runs = [];
  for (let run = 0; run < 3; run++) {
    await page.reload();
    await page.locator('#file-input').setInputFiles('output/playwright/fixtures/tracemonkey.pdf');
    await page.waitForFunction(() => document.querySelector('#page-total').textContent === '14' && document.querySelector('#loading').hidden);
    await page.keyboard.press(',');
    await page.getByRole('button', { name: 'Dracula', exact: true }).click();
    await page.keyboard.press('Escape');
    runs.push(await page.evaluate(async () => {
      const tasks = [], frames = [];
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask', buffered: false });
      const container = document.querySelector('#viewer-container');
      container.scrollTop = 0;
      const start = performance.now();
      let previous = start;
      await new Promise(resolve => {
        const frame = now => {
          frames.push(now - previous); previous = now;
          const progress = Math.min(1, (now - start) / 6000);
          container.scrollTop = progress * (container.scrollHeight - container.clientHeight);
          if (progress < 1) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      observer.disconnect();
      frames.sort((first, second) => first - second);
      return { frames: frames.length, p95FrameMs: frames[Math.floor(frames.length * .95)], maxFrameMs: Math.max(...frames), framesOver34ms: frames.filter(value => value > 34).length, longTasks: tasks.length, longTaskMs: tasks.reduce((sum, value) => sum + value, 0), maxLongTaskMs: Math.max(0, ...tasks), finalPage: document.querySelector('#page-current').textContent };
    }));
  }
  return { fixture: 'cached Mozilla TraceMonkey, 14 pages', viewport: '1440x960', theme: 'Dracula', durationMs: 6000, environment: await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency })), runs };
}
