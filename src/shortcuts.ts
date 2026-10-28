export const leaderActions: Readonly<Record<string, string>> = {
  c: 'graph', t: 'contents', e: 'next-equation', E: 'previous-equation',
  s: 'next-section', S: 'previous-section', n: 'notebook', d: 'theme', o: 'url',
  '2': 'spread', l: 'history-forward', r: 'recolor', b: 'background', f: 'foreground',
  p: 'palette-settings', I: 'pages', '0': 'reset-theme', v: 'figure', D: 'download', Z: 'open-original',
  h: 'history-back', A: 'demo', a: 'glass', C: 'clear-library', B: 'portal-backlinks', '/': 'scholar',
  L: 'local-graph', P: 'preview-page', i: 'focus-preview', m: 'focus-document', q:'passage',
};

export const leaderKeys = Object.fromEntries(Object.entries(leaderActions).map(([key, action]) => [action, `g ${key}`]));
export function displayShortcut(action: string, fallback: string) {
  if (action === 'history-back') return 'g h / Backspace / Alt ←';
  if (action === 'history-forward') return 'g l / Shift Backspace / Alt →';
  return leaderKeys[action] || ({ 'close-portal': 'Escape', 'portal-jump': 'Enter', open: 'o / Ctrl O', help: '? / F1', commands: ': / Ctrl K' } as Record<string, string>)[action] || fallback;
}

interface GuideCommand { title: string; action: string; key: string }
export function shortcutSections(commands: readonly GuideCommand[]) {
  const actions = new Map(commands.map(command => [command.action, command]));
  const command = (action: string): [string, string] => {
    const entry = actions.get(action);
    if (!entry) throw new Error(`Missing shortcut command: ${action}`);
    return [entry.title, entry.key];
  };
  return [
    { title: 'Move & navigate', rows: [
      ['Scroll vertically / horizontally', 'j k / h l'], ['Move a viewport', 'Space / Shift Space'],
      ['Move half a viewport', 'd / u'], ['First / last page', 'g g / G'], command('page'),
      command('history-back'), command('history-forward'), ['Set / return to a mark', "m letter / ' letter"], command('preview-previous-page'), command('preview-next-page'),
    ] },
    { title: 'Page & layout', rows: [command('zoom-in'), command('zoom-out'), command('fit-width'), command('smart-width'), command('fit-page'), command('spread'), command('rotate'), command('focus'), command('ruler'), ['Move reading ruler', '[ / ]'], command('pages'), command('edit-history'), ['Reorder selected pages', 'Drag · Ctrl/Cmd ↑ / ↓ (Pages)'], ['Rotate selected pages', 'R (Pages)'], ['Copy / paste pages', 'Ctrl/Cmd C / Ctrl/Cmd V (Pages)'], ['Insert PDF / images', 'A / I (Pages)'], ['Delete selected pages', 'Delete (Pages)'], ['Undo / redo page edits', 'Ctrl/Cmd Z / Ctrl/Cmd Shift Z (Pages)'], command('add-text'), command('sign'), command('form-fill'), command('edit-undo'), command('edit-redo')] },
    { title: 'Search & references', rows: [command('search'), ['Next / previous text match', 'n / N'], command('equation'), command('citation'), command('figure'), command('links'), command('preview-links'), command('peek-selection'), command('jump-selection')] },
    { title: 'Preview & panels', rows: [command('close-portal'), command('portal-jump'), command('pin-portal'), command('portal-back'), command('portal-forward'), command('preview-page'), command('sidebar'), command('dock'), command('focus-preview'), command('focus-document'), ['Resize pinned panel', 'Tab to divider, then ← → / Home End'], ['Zoom focused preview', '+ / −']] },
    { title: 'Research & notes', rows: [command('graph'), command('local-graph'), command('portal-backlinks'), command('contents'), command('next-equation'), command('previous-equation'), command('next-section'), command('previous-section'), command('capture'), command('passage'), command('notebook'), command('visual-mode'), ['Extend / shrink visual selection', 'j / k'], ['Copy visual selection', 'y'], ['Highlight / add note', 'h / n'], command('scholar'), ['Add text note (notebook)', 'Ctrl Enter'], ['Notebook location', 'Side panel beside the PDF'], ['Note timestamps', 'Saved / updated time on each entry']] },
    { title: 'Themes & appearance', rows: [command('settings'), command('theme'), ['Choose any named theme', ': theme name ↵'], command('glass'), command('recolor'), command('background'), command('foreground'), command('palette-settings'), command('colors'), command('mapping'), command('reset-theme')] },
    { title: 'Files & library', rows: [command('tutor'), command('open'), command('recent'), command('url'), command('print'), command('open-original'), command('download'), ['Save filled PDF forms', 'Save edited PDF copy · g D'], command('bookmark'), command('bookmarks'), command('demo'), command('clear-library'), ['Export Markdown (notebook)', 'Ctrl S'], ['Signature', 'Visible image stamp; no certificate signing'], ['Existing PDF text', 'Add text stamps; embedded text replacement is not supported']] },
    { title: 'Commands & browser', rows: [command('commands'), command('help'), command('vimium'), command('hard-mode'), ['Tutor: coach / reader', 'F2'], ['Tutor: next after success', 'Enter / Ctrl Enter'], ['Tutor: pause / resume', 'Escape / Enter'], ['Tutor: show / hide hints', 'Shift H'], ['Tutor: light / dark', 'Shift T'], ['Move between controls', 'Tab / Shift Tab'], ['Dismiss active surface', 'Escape'], ['Close current tab', 'x / Ctrl W'], ['Restore closed tab', 'Ctrl Shift T'], ['Vimium restore tab (web)', 'X'], ['Vimium: use PDF commands', 'Ctrl K (or exclude Pipit)']] },
  ];
}
