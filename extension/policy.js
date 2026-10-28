export function isDownloadBypass(value) {
  try { const query = new URL(value).searchParams; return ['pipit-download', 'paperterm-download'].some(key => query.getAll(key).includes('1')); } catch { return true; }
}

export function viewerUrl(runtime, source) {
  const viewer = runtime.getURL('index.html');
  if (!source) return viewer;
  const url = new URL(source);
  if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw new Error('Unsupported document URL');
  return `${viewer}?source=${url.href}`;
}

export function isPdfResponse(details, extensionId) {
  if (details.type !== 'main_frame' || details.method !== 'GET' || isDownloadBypass(details.url)) return false;
  // Overleaf's separate-tab PDF viewer carries the SyncTeX relationship to
  // the editor. Preserve that native route when the request comes from Overleaf.
  for (const source of [details.documentUrl, details.originUrl, details.url]) {
    try {
      const hostname = new URL(source).hostname.toLowerCase();
      if (hostname === 'overleaf.com' || hostname.endsWith('.overleaf.com')) return false;
    } catch { /* Address-bar requests may have no source document. */ }
  }
  for (const source of [details.documentUrl, details.originUrl]) {
    try {
      const url = new URL(source);
      if (url.protocol === 'moz-extension:' && url.hostname === extensionId) return false;
    } catch { /* The request may have come from browser chrome. */ }
  }
  if (!/^https?:/i.test(details.url) || details.statusCode < 200 || details.statusCode >= 300) return false;
  return details.responseHeaders?.some(header => header.name.toLowerCase() === 'content-type' && /^application\/pdf(?:\s*;|\s*$)/i.test(header.value || '')) || false;
}

export function installContextMenu(api) {
  const id = 'paperterm-open-link';
  const register = async () => {
    try { await api.contextMenus.removeAll(); await api.contextMenus.create({ id, title: 'Open PDF link in Pipit', contexts: ['link'], targetUrlPatterns: ['http://*/*', 'https://*/*'] }); }
    catch (error) { console.error('Pipit link menu unavailable:', error); }
  };
  api.runtime.onInstalled.addListener(register);
  api.contextMenus.onClicked.addListener(info => {
    try {
      if (info.menuItemId === id && info.linkUrl) void api.tabs.create({ url: viewerUrl(api.runtime, info.linkUrl) }).catch(console.error);
    } catch (error) { console.error('Invalid PDF link:', error); }
  });
  return register;
}
