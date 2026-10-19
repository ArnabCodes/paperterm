import { installContextMenu, isPdfResponse, viewerUrl } from './extension-policy.js';

const api = globalThis.browser;
api.webRequest.onHeadersReceived.addListener(details => {
  if (isPdfResponse(details)) return { redirectUrl: viewerUrl(api.runtime, details.url) };
  return {};
}, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] }, ['blocking', 'responseHeaders']);

api.action.onClicked.addListener(() => { void api.tabs.create({ url: viewerUrl(api.runtime) }).catch(console.error); });
installContextMenu(api);
