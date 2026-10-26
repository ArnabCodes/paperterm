export interface TutorSnapshot {
  ready: boolean; page: number; query: string; matches: number; preview: boolean; previewPage: number; pinned: boolean;
  theme: string; bookmarked: boolean; notes: number; ruler: boolean; spread: number; returns: number;
}
export interface TutorProgress { completed: string[]; skipped: string[] }
export const tutorMissions = [
  { id: 'navigate', title: 'Find your bearings', xp: 20, page: 2, text: 'Reach page 2 of the paper using the page control, outline or scrolling.', hint: 'Press p, type 2, then Enter. Mouse: choose the page number in the dock.' },
  { id: 'search', title: 'Trace the signal', xp: 25, page: 2, text: 'Find coherence in the paper with text search.', hint: 'Press / and type coherence. Mouse: choose Search in the dock. A real match completes this mission.' },
  { id: 'preview', title: 'Open the reference lens', xp: 40, page: 2, text: 'Preview equation (2), defined on page 3, without jumping away.', hint: 'Close search with Escape. Press e, type 2, then Enter. Or right-click the equation (2) link and choose Preview.' },
  { id: 'pin', title: 'Build a comparison desk', xp: 35, page: 3, text: 'Pin the open preview beside the paper.', hint: 'With the lens open, press Shift P, or right-click it and choose Pin. The pane can be resized independently.' },
  { id: 'trail', title: 'Follow, then find your way back', xp: 40, page: 3, text: 'Follow the preview to its source, then return through reading history.', hint: 'Focus the preview and press Enter, or use its context menu → Follow passage. Then Alt+Left, or choose Return to previous position in Commands.' },
  { id: 'theme', title: 'Choose your reading palette', xp: 20, page: 4, text: 'Change the reading theme. Inspect the figure’s line colors and styles.', hint: 'Press g then d, or use Commands → a named theme. Turn recoloring off whenever original figure colors matter.' },
  { id: 'bookmark', title: 'Leave a return marker', xp: 25, page: 5, text: 'Add a bookmark to the current page.', hint: 'Press b, or choose Bookmark this page from Commands. If already marked, remove and add it again.' },
  { id: 'notes', title: 'Keep a piece of evidence', xp: 45, page: 5, text: 'Save a new passage or write a nonempty notebook note.', hint: 'Select PDF text and press q. Or Shift Q → Add text note, then type a sentence. Notes are separate from the original PDF.' },
  { id: 'ruler', title: 'Bonus: focus on a line', xp: 20, page: 5, text: 'Enable the reading ruler. This challenge is optional.', hint: 'Press r, or choose Reading ruler from Commands. If already enabled, toggle it off and on.' },
  { id: 'spread', title: 'Bonus: compare facing pages', xp: 30, page: 5, text: 'Switch to two-page view. This challenge is optional.', hint: 'Press g then 2, or choose Two-page spread from Commands. If already active, toggle to single-page and back.' },
] as const;
export const tutorMaxXp = tutorMissions.reduce((sum, mission) => sum + mission.xp, 0);
export function normalizeTutorProgress(value: unknown): TutorProgress {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = new Set<string>(tutorMissions.map(mission => mission.id));
  const clean = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [];
  const completed = clean(raw.completed), skipped = clean(raw.skipped).filter(id => !completed.includes(id));
  return { completed, skipped };
}
export const tutorXp = (progress: TutorProgress) => tutorMissions.filter(mission => progress.completed.includes(mission.id)).reduce((sum, mission) => sum + mission.xp, 0);
export function tutorRank(xp: number) { return xp >= 300 ? 'Atlas Explorer' : xp >= 250 ? 'Paper Pilot' : xp >= 150 ? 'Reference Scout' : xp >= 60 ? 'Navigator' : 'Reader'; }
export function tutorMissionPassed(id: string, before: TutorSnapshot, after: TutorSnapshot): boolean {
  if (!after.ready) return false;
  switch (id) {
    case 'navigate': return after.page >= 2 && before.page !== after.page;
    case 'search': return after.query.trim().toLowerCase() === 'coherence' && after.matches > 0 && (before.query !== after.query || before.matches === 0);
    case 'preview': return after.preview && after.previewPage === 3 && !before.preview;
    case 'pin': return after.pinned && !before.pinned;
    case 'trail': return after.returns > before.returns;
    case 'theme': return after.theme !== before.theme;
    case 'bookmark': return after.bookmarked && !before.bookmarked;
    case 'notes': return after.notes > before.notes;
    case 'ruler': return after.ruler && !before.ruler;
    case 'spread': return after.spread > 0 && before.spread === 0;
    default: return false;
  }
}
