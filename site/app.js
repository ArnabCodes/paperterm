import { detectEnvironment } from './detection.js';

const environment = detectEnvironment(navigator);
const labels = { chromium: 'Chromium', firefox: 'Firefox', safari: 'Safari' };
const install = {
  chromium: '<ol><li>Download and extract the ZIP into a permanent folder. Do not delete it after installation.</li><li>Open <code>chrome://extensions</code> (or your browser’s extensions page), and enable <strong>Developer mode</strong>.</li><li>Choose <strong>Load unpacked</strong> and select the extracted folder containing <code>manifest.json</code>.</li><li>Grant website access. For local PDF URLs, enable <strong>Allow access to file URLs</strong> in the extension’s details.</li><li>Open a PDF link. After updates, reload the extension and reopen PDF tabs. Disable Pipit to restore the built-in viewer.</li></ol><p class="install-warning">Chrome 128+ is required. Edge and Brave use the same Chromium package.</p>',
  firefox: '<ol><li>Download the unsigned XPI. If Firefox refuses normal installation, that is expected: this is a development alpha.</li><li>Open <code>about:debugging#/runtime/this-firefox</code>.</li><li>Choose <strong>Load Temporary Add-on</strong> and select the downloaded XPI.</li><li>Grant requested website access, then open a PDF link. Local file tabs stay with Firefox; use Pipit’s file picker instead.</li><li>Install it again after restarting Firefox. Permanent installation requires a Mozilla-signed release, which is not available yet.</li></ol><p class="install-warning">Firefox desktop 140+ is required. This is an unsigned temporary package, not an AMO listing.</p>',
  safari: '<ol><li>This ZIP is <strong>source, not an installable Safari extension</strong>. Download it on a Mac with Xcode and command-line tools.</li><li>Extract it and run Apple’s <code>xcrun safari-web-extension-packager /path/to/source</code> (older Xcode: <code>safari-web-extension-converter</code>) to generate a host project.</li><li>Open the project in Xcode, choose your signing team, and build/run the containing app.</li><li>Enable Pipit in <strong>Safari Settings → Extensions</strong> and grant website permissions.</li><li>Use the toolbar on a PDF, a PDF-link context menu, or the local file picker. Article discovery depends on publisher permissions and access.</li></ol><p class="install-warning">Safari 18.4+ is required. You must build and sign the containing app on a Mac. Automatic PDF interception is not supported.</p>',
};
const select = document.querySelector('#install-browser');
const showInstall = browser => { select.value = browser; document.querySelector('#install-content').innerHTML = install[browser]; };
showInstall(environment.browser === 'unknown' ? 'chromium' : environment.browser);
select.addEventListener('change', () => showInstall(select.value));
document.querySelectorAll('[data-select]').forEach(link => link.addEventListener('click', () => showInstall(link.dataset.select)));
if (labels[environment.browser]) {
  const card = document.querySelector(`[data-browser="${environment.browser}"]`);
  card.classList.add('recommended');
  card.querySelector('.recommendation').hidden = false;
  document.querySelector('#recommended-link').textContent = environment.browser === 'safari' ? 'Safari source & setup ↓' : `Get the ${labels[environment.browser]} alpha ↓`;
  document.querySelector('#recommended-link').href = `#download-${environment.browser}`;
  document.querySelector('#detected-browser').textContent = `For ${labels[environment.browser]} on ${environment.os} · Alpha 03 · No account`;
}
document.querySelector('#platform-note').textContent = environment.mobile ? `You’re on ${environment.os}. Extension downloads are for desktop browsers only; try the web reader or choose a desktop package below.` : `Detected ${labels[environment.browser] || 'an unrecognized browser'} on ${environment.os}. Choose any package below; detection never hides alternatives.`;
document.querySelectorAll('[data-target]').forEach(link => link.addEventListener('click', () => showInstall(link.dataset.target === 'chrome' ? 'chromium' : link.dataset.target)));
try {
  const response = await fetch('/release.json', { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Release metadata unavailable');
  const release = await response.json();
  for (const target of ['chrome', 'firefox', 'safari']) {
    const item = release.downloads[target];
    if (!item || !/^\/downloads\/[a-z0-9.-]+$/.test(item.url) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid release metadata');
  }
  for (const target of ['chrome', 'firefox', 'safari']) {
    const item = release.downloads[target];
    const link = document.querySelector(`[data-target="${target}"]`);
    link.href = item.url;
    link.download = item.url.split('/').pop();
    link.title = `${(item.bytes / 1024 / 1024).toFixed(1)} MiB · SHA-256 ${item.sha256}`;
    document.querySelector(`[data-checksum="${target}"]`).href = `${item.url}.sha256`;
  }
} catch {
  document.querySelector('#platform-note').textContent = 'Live download metadata could not be loaded. The versioned download links and installation instructions remain available; reload to retry metadata.';
  document.querySelectorAll('[data-target]').forEach(link => { if (!link.getAttribute('href')?.startsWith('/downloads/')) { link.href = '#installation'; link.textContent = 'Downloads unavailable — see setup'; } });
}
