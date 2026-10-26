import { icon } from './icons';
import { escapeHtml } from './types';

interface DockCommand { title: string; detail: string; action: string; key: string }
const groups = [
  { id: 'navigate', name: 'Navigate', icon: 'history', actions: ['page', 'sidebar', 'contents', 'bookmarks', 'bookmark', 'history-back', 'history-forward', 'search'] },
  { id: 'references', name: 'References', icon: 'equation', actions: ['equation', 'citation', 'figure', 'preview-links', 'links', 'peek-selection', 'jump-selection', 'pin-portal', 'portal-jump', 'portal-back', 'portal-forward', 'portal-backlinks', 'preview-page', 'close-portal', 'graph', 'local-graph', 'next-equation', 'previous-equation', 'next-section', 'previous-section'] },
  { id: 'notes', name: 'Notebook', icon: 'note', actions: ['capture', 'notebook', 'scholar'] },
  { id: 'layout', name: 'Reading', icon: 'crop', actions: ['zoom-in', 'zoom-out', 'fit-width', 'smart-width', 'fit-page', 'spread', 'rotate', 'focus', 'ruler'] },
  { id: 'appearance', name: 'Appearance', icon: 'palette', actions: ['settings', 'theme', 'glass', 'recolor', 'background', 'foreground', 'palette-settings', 'reset-theme'] },
  { id: 'files', name: 'Workspace', icon: 'open', actions: ['open', 'recent', 'url', 'download', 'demo', 'clear-library', 'help', 'vimium', 'commands', 'dock'] },
] as const;
const actionIcons: Record<string, string> = { 'history-back': 'back', 'history-forward': 'next', search: 'search', bookmark: 'mark', bookmarks: 'mark', page: 'document', contents: 'menu', sidebar: 'menu', equation: 'equation', citation: 'citations', figure: 'image', graph: 'graph', 'local-graph': 'graph', 'preview-links': 'lens', links: 'link', 'peek-selection': 'lens', 'jump-selection': 'arrow', 'pin-portal': 'pin', 'portal-jump': 'arrow', 'portal-back': 'back', 'portal-forward': 'next', 'close-portal': 'close', 'preview-page': 'expand', 'portal-backlinks': 'citations', capture: 'quote', notebook: 'note', scholar: 'search', 'zoom-in': 'plus', 'zoom-out': 'minus', 'fit-width': 'expand', 'smart-width': 'crop', 'fit-page': 'document', spread: 'spread', rotate: 'rotate', focus: 'focus', ruler: 'ruler', settings: 'settings', theme: 'palette', glass: 'layers', recolor: 'palette', open: 'open', recent: 'history', url: 'link', download: 'download', help: 'help', commands: 'command', 'clear-library': 'trash', demo: 'document', vimium: 'keyboard', dock: 'layers' };

export function initializeDock(commands: readonly DockCommand[], run: (action: string) => void, enabled: (action: string) => boolean) {
  const dock = document.querySelector<HTMLElement>('#reader-toolbar')!;
  const content = dock.querySelector<HTMLElement>('.dock-more-content')!;
  content.innerHTML = `<div class="dock-fan" role="group" aria-label="Reading tools">${groups.map((group, index) => `<button class="dock-category" data-dock-group="${group.id}" aria-expanded="false" aria-controls="dock-details" style="--fan-index:${index}"><span class="dock-category-icon">${icon(group.icon)}</span><span>${group.name}</span></button>`).join('')}</div><section id="dock-details" hidden aria-label="Dock tools"><header><span id="dock-details-title"></span><button data-dock-back aria-label="Close tool group">${icon('close')}</button></header><div class="dock-command-list"></div></section>`;
  const details = dock.querySelector<HTMLElement>('#dock-details')!;
  const list = dock.querySelector<HTMLElement>('.dock-command-list')!;
  document.body.append(details);
  let active: HTMLButtonElement | null = null;
  let keyboard = false;
  let restoringFocus = false;
  function closeGroup(focus: boolean) {
    details.hidden = true;
    active?.setAttribute('aria-expanded', 'false');
    if (focus) { restoringFocus = true; active?.focus({ preventScroll: true }); restoringFocus = false; }
    active = null;
  }
  function openGroup(target: HTMLButtonElement, focus: boolean) {
    const group = groups.find(item => item.id === target.dataset.dockGroup);
    if (!group) return;
    if (active === target && !details.hidden) {
      if (focus) list.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
      return;
    }
    closeGroup(false); active = target;
    target.setAttribute('aria-expanded', 'true');
    details.querySelector('#dock-details-title')!.textContent = group.name;
    const available = commands.filter(command => (group.actions as readonly string[]).includes(command.action) || (group.id === 'references' && command.action.startsWith('preview-')));
    list.innerHTML = available.map(command => `<button data-dock-run="${command.action}" ${enabled(command.action) ? '' : 'disabled'} title="${escapeHtml(command.detail)}">${icon(actionIcons[command.action] || group.icon)}<span>${escapeHtml(command.title)}</span><kbd>${escapeHtml(command.key)}</kbd></button>`).join('');
    const bottom = Math.max(68, innerHeight - target.getBoundingClientRect().top + 14);
    details.style.bottom = `${bottom}px`;
    details.style.setProperty('--dock-menu-max-height', `${Math.max(80, innerHeight - bottom - 70)}px`);
    details.hidden = false;
    if (focus) list.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }
  content.querySelectorAll<HTMLButtonElement>('[data-dock-group]').forEach(button => {
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { keyboard = false; openGroup(button, false); } });
    button.addEventListener('focus', () => { if (keyboard && !restoringFocus) openGroup(button, false); });
  });
  document.addEventListener('pointermove', event => {
    if (!active || keyboard || event.pointerType === 'touch') return;
    const near = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();
      const horizontal = Math.max(box.left - event.clientX, 0, event.clientX - box.right);
      const vertical = Math.max(box.top - event.clientY, 0, event.clientY - box.bottom);
      return Math.hypot(horizontal, vertical) <= 28;
    };
    if (!near(active) && !near(details)) closeGroup(false);
  }, { passive: true });
  for (const surface of [content, details]) surface.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!target) return;
    if (target.hasAttribute('data-dock-back')) { closeGroup(true); return; }
    if (target.dataset.dockRun) {
      const action = target.dataset.dockRun;
      closeGroup(false);
      document.querySelector<HTMLElement>('#viewer-container')!.focus({ preventScroll: true });
      run(action); return;
    }
    openGroup(target, true);
  });
  for (const surface of [content, details]) surface.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key === 'Escape' && !details.hidden) { event.preventDefault(); event.stopPropagation(); closeGroup(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const scope = details.contains(event.target as Node) ? list : dock.querySelector('.dock-fan')!;
    const buttons = [...scope.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });
  dock.addEventListener('keydown', () => { keyboard = true; }, { capture: true });
  details.addEventListener('keydown', () => { keyboard = true; }, { capture: true });
  new MutationObserver(() => { if (dock.dataset.expanded === 'false') closeGroup(false); }).observe(dock, { attributes: true, attributeFilter: ['data-expanded'] });
  dock.querySelector('[data-dock-toggle]')!.addEventListener('click', () => {
    if (dock.dataset.expanded !== 'true') run('dock');
    else dock.querySelector<HTMLButtonElement>('.dock-category')?.focus({ preventScroll: true });
  });
}
