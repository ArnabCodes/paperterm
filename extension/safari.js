import { installContextMenu, isDownloadBypass, viewerUrl } from './extension-policy.js';

const api = globalThis.browser || globalThis.chrome;
api.action.onClicked.addListener(async tab => {
  try {
    let source;
    if (tab.url && /^https?:/i.test(tab.url) && !isDownloadBypass(tab.url)) {
      const response = await fetch(tab.url, { method: 'HEAD', credentials: 'include', redirect: 'follow' });
      if (response.ok && /^application\/pdf(?:\s*;|\s*$)/i.test(response.headers.get('content-type') || '')) source = tab.url;
    }
    await api.tabs.create({ url: viewerUrl(api.runtime, source) });
  } catch (error) {
    console.warn('Could not identify the current PDF; opening the local reader instead.', error);
    await api.tabs.create({ url: viewerUrl(api.runtime) });
  }
});
installContextMenu(api);
