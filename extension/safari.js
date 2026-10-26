import { installContextMenu, isDownloadBypass, viewerUrl } from './extension-policy.js';

const api = globalThis.browser || globalThis.chrome;
api.action.onClicked.addListener(async tab => {
  try {
    let source;
    if (tab.url && /^https?:/i.test(tab.url) && !isDownloadBypass(tab.url)) {
      const response = await fetch(tab.url, { method: 'HEAD', credentials: 'include', redirect: 'follow' });
      if (response.ok && /^application\/pdf(?:\s*;|\s*$)/i.test(response.headers.get('content-type') || '')) source = tab.url;
    }
    const article = !source && tab.url && /^https?:/i.test(tab.url) && !isDownloadBypass(tab.url) ? tab.url : '';
    await api.tabs.create({ url: article ? `${viewerUrl(api.runtime)}?article=${encodeURIComponent(article)}` : viewerUrl(api.runtime, source) });
  } catch (error) {
    console.warn('Could not identify the current PDF with HEAD; trying article discovery in the reader.', error);
    const article = tab.url && /^https?:/i.test(tab.url) && !isDownloadBypass(tab.url) ? tab.url : '';
    await api.tabs.create({ url: article ? `${viewerUrl(api.runtime)}?article=${encodeURIComponent(article)}` : viewerUrl(api.runtime) });
  }
});
installContextMenu(api);
