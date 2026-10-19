const extensionSchemes = new Set(['chrome-extension:', 'moz-extension:', 'safari-web-extension:']);

interface ExtensionApi {
  tabs?: {
    getCurrent(): Promise<{ id?: number } | undefined>;
    remove(id: number): Promise<void>;
  };
}

export function isExtensionPage(href = location.href): boolean {
  return extensionSchemes.has(new URL(href).protocol);
}

export function validatePdfSource(source: string, base = location.href): URL {
  const url = new URL(source, base), current = new URL(base);
  if (['http:', 'https:', 'file:'].includes(url.protocol)) return url;
  if (extensionSchemes.has(url.protocol) && url.protocol === current.protocol && url.host === current.host) return url;
  throw new Error('Open a local PDF or HTTP(S) URL. Extension resources must belong to this viewer.');
}

export async function closeCurrentExtensionTab(): Promise<boolean> {
  if (!isExtensionPage()) return false;
  const environment = globalThis as unknown as { browser?: ExtensionApi; chrome?: ExtensionApi };
  const tabs = (environment.browser || environment.chrome)?.tabs;
  if (!tabs) return false;
  const tab = await tabs.getCurrent();
  if (tab?.id === undefined) return false;
  await tabs.remove(tab.id);
  return true;
}
