export function manifestFor(base, target) {
  const manifest = structuredClone(base);
  if (target === 'chrome') return manifest;
  delete manifest.minimum_chrome_version;
  manifest.background = { scripts: ['background.js'], type: 'module' };
  manifest.permissions = ['storage', 'activeTab', 'contextMenus'];
  manifest.host_permissions = ['http://*/*', 'https://*/*'];
  if (target === 'firefox') {
    manifest.permissions.push('webRequest', 'webRequestBlocking');
    manifest.browser_specific_settings = { gecko: { id: 'paperterm@arnabcodes', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } } };
  } else if (target === 'safari') {
    manifest.browser_specific_settings = { safari: { strict_min_version: '18.4' } };
  } else throw new Error(`Unknown browser target: ${target}`);
  return manifest;
}

export const targetInstructions = {
  chrome: 'Chrome/Edge/Brave: extract to a permanent folder, open chrome://extensions (or your Chromium browser equivalent), enable Developer mode, Load unpacked, and select this folder. For local file URLs enable Allow access to file URLs. Reload after updates and reopen PDFs. Top-level GET PDF MIME responses are redirected inline; explicit pipit-download=1 bypasses interception.',
  firefox: 'Firefox desktop: this is an unsigned development XPI. For temporary testing use about:debugging#/runtime/this-firefox > Load Temporary Add-on, selecting the XPI or manifest.json. Grant requested website access. A release install in standard Firefox requires Mozilla signing (AMO listed or unlisted); no signing or submission is performed by these scripts. Temporary installs end at restart. Top-level HTTP(S) GET PDF MIME responses use blocking webRequest; explicit pipit-download=1 bypasses interception. Native file:// PDF tabs are not intercepted; choose a local file from inside Pipit instead.',
  safari: 'Safari source payload, NOT an installable Safari extension. On a Mac run the repository safari-package script or Apple safari-web-extension-packager/converter, then build/sign the containing app and enable the extension in Safari Settings. Grant website access. Safari does not support Chrome response-header DNR matching or blocking webRequest: automatic MIME-based default-viewer replacement is not implemented. Use the toolbar on a PDF (HEAD support required), Open PDF link in Pipit from the link context menu, the reader URL opener, or a local file picker. A PDF already opened in Safari may already have downloaded; this extension cannot undo that. Exact browser-level parity is not claimed.',
};
