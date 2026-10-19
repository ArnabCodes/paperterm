const viewer = chrome.runtime.getURL('index.html');

async function registerRules() {
  const redirect = { type: 'redirect', redirect: { regexSubstitution: viewer + '?source=\\0' } };
  const resourceTypes = ['main_frame'];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3],
    addRules: [
      { id: 1, priority: 10, action: { type: 'allow' }, condition: { urlFilter: 'paperterm-download=1', resourceTypes } },
      { id: 2, priority: 2, action: redirect, condition: { regexFilter: '^https?://.*$', resourceTypes, requestMethods: ['get'], responseHeaders: [{ header: 'content-type', values: ['application/pdf', 'application/pdf;*'] }], excludedResponseHeaders: [{ header: 'content-disposition', values: ['attachment*'] }] } },
      { id: 3, priority: 1, action: redirect, condition: { regexFilter: '^file://.*\\.pdf([?#].*)?$', isUrlFilterCaseSensitive: false, resourceTypes } }
    ]
  });
}

chrome.runtime.onInstalled.addListener(() => registerRules().catch(console.error));
chrome.runtime.onStartup.addListener(() => registerRules().catch(console.error));
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: viewer }));
registerRules().catch(console.error);
