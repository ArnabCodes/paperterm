export interface TutorSnapshot {
  ready: boolean; page: number; query: string; matches: number; preview: boolean; previewPage: number; pinned: boolean;
  theme: string; bookmarked: boolean; notes: number; ruler: boolean; spread: number; returns: number; down?: number; up?: number; quickmarkPage?: number; rulerPosition?: number; focus?: boolean;
}
export interface TutorProgress { completed: string[]; skipped: string[] }
export const tutorMissions = [
  { id: 'move', title: 'Launch and land', xp: 20, page: 1, text: 'Fly down the paper, then land back above. Move in both directions with the keyboard.', hint: 'Press lowercase j to scroll down. Then press lowercase k to scroll up. These are single keys, not Ctrl combinations. Keep the pointer still; the page moves under your keyboard.' },
  { id: 'navigate', title: 'Reach checkpoint two', xp: 15, page: 2, text: 'Reach the second page using the page-jump shortcut.', hint: 'Press lowercase p. A page-number box opens and the cursor is already inside it. Type 2, then press Enter. The dock should show 2 / 6.' },
  { id: 'search', title: 'Hunt the signal', xp: 25, page: 2, text: 'Find the hidden signal: coherence.', hint: 'Press the / key (forward slash). The search box receives focus. Type coherence. Wait for the highlighted matches and a match count. After the success message, press Escape to close search.' },
  { id: 'preview', title: 'Unlock the equation chamber', xp: 40, page: 2, text: 'Reveal equation (2) without leaving your checkpoint.', hint: 'Press Escape if search is still open. Press lowercase e. Type 2 into the equation lookup, then Enter. A floating lens shows the definition from page 3. Leave the lens open for the next mission.' },
  { id: 'pin', title: 'Build your observatory', xp: 35, page: 3, text: 'Keep the equation beside the paper by pinning the lens.', hint: 'Keep the lens open. Hold Shift, press p, then release both keys. Uppercase P means Shift plus p. The lens becomes a side pane. To resize it later, press Tab until the divider is focused, then use Left/Right arrows.' },
  { id: 'trail', title: 'Retrieve the equation and return', xp: 40, page: 3, text: 'Follow the equation to page 3, then return to your previous reading position.', hint: 'Press Enter to follow the equation preview. Press g, release it, then press h to return. Backspace also returns to the previous position. A return alone is not enough; follow the preview first.' },
  { id: 'theme', title: 'Change the atmosphere', xp: 15, page: 4, text: 'Change the paper’s reading palette with a two-key sequence.', hint: 'Press g and release it. Then press d within two seconds. Do not hold them together. The theme changes. Repeat g then d to explore. Use g then 0 to restore Paper after the mission if you wish.' },
  { id: 'bookmark', title: 'Plant a return beacon', xp: 25, page: 5, text: 'Bookmark your present position so you can find it again.', hint: 'Press lowercase b. A bookmark is saved for the current page. If it was already bookmarked, press b to remove it, wait a moment, then b again. Later, Shift plus b opens your bookmarks.' },
  { id: 'notes', title: 'Write your expedition log', xp: 40, page: 5, text: 'Create a new notebook entry entirely from the keyboard.', hint: 'Hold Shift and press q to open the notebook. Hold Ctrl (Command on Mac) and press Enter to add a text note. The note box is focused automatically. Type one sentence. Notes save as you type. Press Escape to close the notebook after success.' },
  { id: 'ruler', title: 'Bonus: guide the spotlight', xp: 15, page: 5, text: 'Turn on a reading ruler to guide your eyes.', hint: 'Press lowercase r. If the ruler was on already, press r to turn it off, then r again. The [ and ] keys move it up and down; r hides it afterward.' },
  { id: 'spread', title: 'Bonus: unfold the atlas', xp: 30, page: 5, text: 'Unfold the document into facing pages.', hint: 'Press g, release it, then press 2. Two pages appear side by side. If already in that view, repeat the sequence to return to one page, then repeat it again. Use the same sequence to return afterward.' },
] as const;
export const advancedMissions = [
  { id: 'quickmark', title: 'Make a secret waypoint', xp: 30, page: 2, text: 'Mark this spot, visit page 3, then return to your waypoint.', hint: "Press m then a to save mark a. Press p, type 3 and press Enter. Then press the apostrophe key followed by a to return to your mark." },
  { id: 'ruler-adjust', title: 'Steer the reading beam', xp: 20, page: 3, text: 'Move the reading ruler down the page with the keyboard.', hint: 'Press ] to reveal the ruler and move it down. Press [ to move it back up. Press r later to hide it.' },
  { id: 'focus', title: 'Clear the flight deck', xp: 20, page: 4, text: 'Enter distraction-free focus mode.', hint: 'Press lowercase z to enter focus mode. Press z again afterward to restore the controls.' },
] as const;
export const relayMissionIds = ['move', 'navigate', 'theme', 'ruler', 'spread', 'quickmark', 'ruler-adjust', 'focus'] as const;
export const tutorMaxXp = tutorMissions.reduce((sum, mission) => sum + mission.xp, 0);
export function normalizeTutorProgress(value: unknown, missions: readonly {id: string}[] = tutorMissions): TutorProgress {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = new Set<string>(missions.map(mission => mission.id));
  const clean = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [];
  const completed = clean(raw.completed), skipped = clean(raw.skipped).filter(id => !completed.includes(id));
  return { completed, skipped };
}
export const tutorXp = (progress: TutorProgress) => tutorMissions.filter(mission => progress.completed.includes(mission.id)).reduce((sum, mission) => sum + mission.xp, 0);
export function tutorRank(xp: number) { return xp >= 300 ? 'Atlas Explorer' : xp >= 250 ? 'Paper Pilot' : xp >= 150 ? 'Reference Scout' : xp >= 60 ? 'Navigator' : 'Reader'; }
export function tutorMissionPassed(id: string, before: TutorSnapshot, after: TutorSnapshot): boolean {
  if (!after.ready) return false;
  switch (id) {
    case 'move': return (after.down || 0) > (before.down || 0) && (after.up || 0) > (before.up || 0);
    case 'navigate': return after.page === 2 && before.page !== after.page;
    case 'search': return after.query.trim().toLowerCase() === 'coherence' && after.matches > 0 && (before.query !== after.query || before.matches === 0);
    case 'preview': return after.preview && after.previewPage === 3 && !before.preview;
    case 'pin': return after.pinned && !before.pinned;
    case 'trail': return after.returns > before.returns;
    case 'theme': return after.theme !== before.theme;
    case 'bookmark': return after.bookmarked && !before.bookmarked;
    case 'notes': return after.notes > before.notes;
    case 'ruler': return after.ruler && !before.ruler;
    case 'spread': return after.spread > 0 && before.spread === 0;
    case 'quickmark': return after.quickmarkPage === before.page && after.page === before.page;
    case 'ruler-adjust': return after.ruler && after.rulerPosition !== before.rulerPosition;
    case 'focus': return !!after.focus && !before.focus;
    default: return false;
  }
}
export const tutorKeys: Readonly<Record<string, readonly string[]>> = {
  move:['j','k'], navigate:['p','Enter'], search:['/'], preview:['e','Enter'], pin:['P'],
  quickmark:['m','a','p','Enter',"'",'a'], 'ruler-adjust':[']'], focus:['z'],
  trail:['Enter','g','h'], theme:['g','d'], bookmark:['b'], notes:['Q','Mod+Enter'], ruler:['r'], spread:['g','2'],
};
export function tutorKeyboardPassed(id: string, pressed: readonly string[]) {
  if (id === 'trail') {
    const followed = pressed.indexOf('Enter');
    if (followed < 0) return false;
    const after = pressed.slice(followed + 1).filter(key => !['Shift','Control','Alt','Meta','AltGraph'].includes(key));
    return after.includes('Backspace') || after.includes('Alt+ArrowLeft') || after.some((key, index) => key === 'g' && after[index + 1] === 'h');
  }
  const expected = tutorKeys[id]; if (!expected) return false;
  let cursor = 0; for (const key of pressed) if (key === expected[cursor]) cursor++;
  return cursor === expected.length;
}
