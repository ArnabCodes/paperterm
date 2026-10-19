export type ReferenceKind = 'equation' | 'citation' | 'figure' | 'all';
export interface TextLine { text: string; page: number; x: number; y: number }
export interface ReferenceHit extends TextLine { label: string; kind: ReferenceKind; score: number }
export interface Bookmark { page: number; name: string; y?: number }
export interface ReadingState { page: number; offset?: number; zoom: string; marks: Record<string, number | { page: number; y: number }>; bookmarks: Bookmark[] }
export interface Preferences { theme: string; foreground: string; background: string; recolor: boolean; glass: boolean; palette: { from: string; to: string }[] }

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export const element = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing UI element: ${selector}`);
  return result;
};
