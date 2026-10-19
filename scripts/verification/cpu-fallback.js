async (page) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        if (String(url).includes('color-worker')) {
          const source = `import ${JSON.stringify(String(url))}; const original = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };`;
          super(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), options);
        } else super(url, options);
      }
    };
  });
  await page.reload();
  return { capability: 'Injected WebGL2 unavailability in the color worker; actual CPU backend must be checked in subsequent results' };
}
