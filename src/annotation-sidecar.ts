export interface NotebookEntry { id: string; excerpt: string; page: number; offset: number; note: string }
export const notebookLimits = { entries: 200, text: 8000, bytes: 8 * 1024 * 1024 };
export function parseNotebookSidecar(text: string, documentId: string, pageCount = Infinity): NotebookEntry[] {
  if (text.length > notebookLimits.bytes) throw new Error('Notebook backup is too large.');
  const value = JSON.parse(text);
  if (value?.format !== 'pipit-notebook' || value.version !== 1 || value.document?.id !== documentId) throw new Error('This backup belongs to a different PDF, or is not a supported Pipit notebook.');
  if (!Array.isArray(value.entries) || value.entries.length > notebookLimits.entries) throw new Error('Notebook entry limit exceeded.');
  const ids = new Set<string>();
  return value.entries.map((entry: NotebookEntry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 128 || ids.has(entry.id) || typeof entry.excerpt !== 'string' || entry.excerpt.length > notebookLimits.text || typeof entry.note !== 'string' || entry.note.length > notebookLimits.text || !Number.isInteger(entry.page) || entry.page < 1 || entry.page > pageCount || !Number.isFinite(entry.offset) || entry.offset < -1 || entry.offset > 1) throw new Error('The backup contains an invalid note. Nothing was imported.');
    ids.add(entry.id);
    return { id: entry.id, excerpt: entry.excerpt, note: entry.note, page: entry.page, offset: entry.offset };
  });
}
export function mergeNotebookEntries(current: readonly NotebookEntry[], incoming: readonly NotebookEntry[]): NotebookEntry[] {
  const result = current.map(entry => ({ ...entry }));
  for (const entry of incoming) {
    const existing = result.find(item => item.id === entry.id);
    if (existing && (existing.excerpt !== entry.excerpt || existing.note !== entry.note || existing.page !== entry.page || existing.offset !== entry.offset)) throw new Error('A backup note conflicts with an edited local note. Export your local notebook first; no notes were replaced.');
    if (!existing) result.push({ ...entry });
  }
  if (result.length > notebookLimits.entries) throw new Error('Import would exceed the notebook limit. Nothing was imported.');
  return result;
}
export function notebookSidecar(document: { id: string; name: string }, entries: readonly NotebookEntry[]): string {
  return JSON.stringify({ format: 'pipit-notebook', version: 1, document, annotationMode: 'sidecar-only', entries }, null, 2);
}
