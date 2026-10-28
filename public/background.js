import { installContextMenu, isDownloadBypass } from './extension-policy.js';
const viewer = chrome.runtime.getURL('index.html');
installContextMenu(chrome);

async function registerRules() {
  const redirect = { type: 'redirect', redirect: { regexSubstitution: viewer + '?source=\\0' } };
  const resourceTypes = ['main_frame'];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3],
    addRules: [
      { id: 1, priority: 10, action: { type: 'allow' }, condition: { regexFilter: '[?&]pipit-download=1([&#]|$)', resourceTypes } },
      { id: 2, priority: 2, action: redirect, condition: { regexFilter: '^https?://.*$', resourceTypes, requestMethods: ['get'], excludedInitiatorDomains: ['overleaf.com', chrome.runtime.id], excludedRequestDomains: ['overleaf.com'], responseHeaders: [{ header: 'content-type', values: ['application/pdf', 'application/pdf;*'] }] } },
      { id: 3, priority: 1, action: redirect, condition: { regexFilter: '^file://.*\\.pdf([?#].*)?$', isUrlFilterCaseSensitive: false, resourceTypes } }
    ]
  });
}

chrome.runtime.onInstalled.addListener(() => registerRules().catch(console.error));
chrome.runtime.onStartup.addListener(() => registerRules().catch(console.error));
chrome.action.onClicked.addListener(tab => chrome.tabs.create({ url: tab.url && /^https?:/i.test(tab.url) && !isDownloadBypass(tab.url) ? `${viewer}?article=${encodeURIComponent(tab.url)}` : viewer }));
registerRules().catch(console.error);
