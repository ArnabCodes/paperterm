export const leaderActions: Readonly<Record<string, string>> = {
  c: 'graph', t: 'contents', e: 'next-equation', E: 'previous-equation',
  s: 'next-section', S: 'previous-section', n: 'notebook', d: 'theme', o: 'url',
  '2': 'spread', l: 'glass', r: 'recolor', b: 'background', f: 'foreground',
  p: 'palette-settings', '0': 'reset-theme', v: 'vimium', D: 'download',
  h: 'demo', C: 'clear-library', B: 'portal-backlinks', '/': 'scholar',
};

export const leaderKeys = Object.fromEntries(Object.entries(leaderActions).map(([key, action]) => [action, `g ${key}`]));

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
      command('history-back'), command('history-forward'), ['Set / return to a mark', "m letter / ' letter"],
    ] },
    { title: 'Page & layout', rows: [command('zoom-in'), command('zoom-out'), command('fit-width'), command('smart-width'), command('fit-page'), command('spread'), command('rotate'), command('focus'), command('ruler'), ['Move reading ruler', '[ / ]']] },
    { title: 'Search & references', rows: [command('search'), ['Next / previous text match', 'n / N'], command('equation'), command('citation'), command('figure'), command('links'), command('preview-links'), command('smart-hints'), command('peek-selection'), command('jump-selection')] },
    { title: 'Preview & panels', rows: [command('close-portal'), command('portal-jump'), command('pin-portal'), command('portal-back'), command('portal-forward'), command('portal-backlinks'), command('sidebar'), command('dock'), ['Resize pinned panel', '← → / Home End'], ['Zoom focused preview', '+ / −']] },
    { title: 'Research & notes', rows: [command('graph'), command('contents'), command('next-equation'), command('previous-equation'), command('next-section'), command('previous-section'), command('capture'), command('notebook'), command('scholar'), ['Add text note (notebook)', 'Ctrl Enter']] },
    { title: 'Themes & appearance', rows: [command('settings'), command('theme'), ['Choose any named theme', ': theme name ↵'], command('glass'), command('recolor'), command('background'), command('foreground'), command('palette-settings'), command('reset-theme')] },
    { title: 'Files & library', rows: [command('open'), command('recent'), command('url'), command('download'), command('bookmark'), command('bookmarks'), command('demo'), command('clear-library'), ['Export Markdown (notebook)', 'Ctrl S']] },
    { title: 'Commands & browser', rows: [command('commands'), command('help'), command('vimium'), ['Move between controls', 'Tab / Shift Tab'], ['Dismiss active surface', 'Escape'], ['Close current tab', 'x / Ctrl W'], ['Restore closed tab', 'Ctrl Shift T'], ['Vimium restore tab (web)', 'X'], ['Vimium: use PDF commands', ': or Ctrl K']] },
  ];
}
