import { element } from './types';
import { initializeDockMotion } from './dock-motion';

let sidebarPinned = false;
let sidebarTimer: ReturnType<typeof setTimeout>;
let dockTimer: ReturnType<typeof setTimeout> | undefined;
let dockMotion: ReturnType<typeof initializeDockMotion>;
const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

function reveal(id: string, visible: boolean) {
  const panel = element(id);
  if (id === '#reader-toolbar') {
    const more = element('.dock-more');
    if (!visible && (more.contains(document.activeElement) || document.querySelector('#dock-details')?.contains(document.activeElement))) element('#viewer-container').focus({ preventScroll: true });
    more.inert = !visible;
    more.setAttribute('aria-hidden', String(!visible));
    document.body.classList.toggle('dock-visible', visible);
    dockMotion?.setExpanded(visible);
    if (!visible) dockMotion?.setPointer(null);
    return;
  }
  if (!visible && panel.contains(document.activeElement)) element('#viewer-container').focus({ preventScroll: true });
  panel.inert = !visible;
  panel.setAttribute('aria-hidden', String(!visible));
  document.body.classList.toggle(id === '#sidebar' ? 'sidebar-visible' : 'dock-visible', visible);
}

export function collapseControls() {
  sidebarPinned = false;
  clearTimeout(sidebarTimer); clearTimeout(dockTimer);
  dockTimer = undefined;
  reveal('#sidebar', false); reveal('#reader-toolbar', false);
}

export function toggleSidebar(force?: boolean) {
  sidebarPinned = force ?? !document.body.classList.contains('sidebar-visible');
  if (sidebarPinned) document.body.classList.remove('focus-mode');
  clearTimeout(sidebarTimer);
  reveal('#sidebar', sidebarPinned);
  if (sidebarPinned) element<HTMLButtonElement>('#sidebar button').focus({ preventScroll: true });
  else element('#viewer-container').focus({ preventScroll: true });
}

export function showDock() {
  clearTimeout(dockTimer);
  dockTimer = undefined;
  document.body.classList.remove('focus-mode');
  reveal('#reader-toolbar', true);
  element<HTMLButtonElement>('#reader-toolbar button').focus({ preventScroll: true });
}

export function initializeChrome() {
  dockMotion = initializeDockMotion(element('#reader-toolbar'));
  collapseControls();
  const inside = (target: HTMLElement, xpos: number, ypos: number) => {
    const box = target.getBoundingClientRect();
    return xpos >= box.left - 8 && xpos <= box.right + 8 && ypos >= box.top - 8 && ypos <= box.bottom + 8;
  };
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !document.body.classList.contains('has-document') || document.body.classList.contains('focus-mode') || document.querySelector('dialog[open]')) return;
    const sidebar = element('#sidebar'), dock = element('#reader-toolbar');
    const sidebarHot = event.clientX <= 14 || (document.body.classList.contains('sidebar-visible') && inside(sidebar, event.clientX, event.clientY));
    const dockHot = inside(dock, event.clientX, event.clientY) || Boolean((event.target as Element).closest('#reader-toolbar, #dock-details')) || (event.clientY >= innerHeight - 30 && Math.abs(event.clientX - innerWidth / 2) <= Math.min(360, innerWidth / 2));
    clearTimeout(sidebarTimer);
    if (sidebarHot) reveal('#sidebar', true);
    else if (!sidebarPinned) sidebarTimer = setTimeout(() => reveal('#sidebar', false), 350);
    if (dockHot) { clearTimeout(dockTimer); dockTimer = undefined; reveal('#reader-toolbar', true); dockMotion.setPointer(event.clientX); }
    else {
      dockMotion.setPointer(null);
      if (!dockTimer && !dock.contains(document.activeElement) && !element('#dock-details').contains(document.activeElement) && document.body.classList.contains('dock-visible')) dockTimer = setTimeout(() => { dockTimer = undefined; reveal('#reader-toolbar', false); }, 420);
    }
  }, { passive: true });
  document.addEventListener('wheel', event => {
    if (event.ctrlKey || (!event.deltaX && !event.deltaY)) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('#viewer-container, #portal-scroll, #navigation-list, #palette-results, .theme-options, dialog, #welcome') : null;
    if (!target) return;
    clearTimeout(timers.get(target));
    target.classList.add('mouse-scrolling');
    timers.set(target, setTimeout(() => { target.classList.remove('mouse-scrolling'); timers.delete(target); }, 850));
  }, { passive: true });
  document.addEventListener('keydown', () => {
    timers.forEach((timer, target) => { clearTimeout(timer); target.classList.remove('mouse-scrolling'); });
    timers.clear();
  }, { capture: true });
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && document.body.classList.contains('has-document') && event.clientY > innerHeight - 36) showDock();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    clearTimeout(sidebarTimer); clearTimeout(dockTimer);
    dockTimer = undefined;
    if (!sidebarPinned) reveal('#sidebar', false);
    reveal('#reader-toolbar', false);
  });
  for (const surface of [element('#reader-toolbar'), element('#dock-details')]) surface.addEventListener('focusin', () => {
    clearTimeout(dockTimer); dockTimer = undefined; reveal('#reader-toolbar', true);
  });
  for (const surface of [element('#reader-toolbar'), element('#dock-details')]) surface.addEventListener('focusout', event => {
    if (!element('#reader-toolbar').contains(event.relatedTarget as Node) && !element('#dock-details').contains(event.relatedTarget as Node)) { clearTimeout(dockTimer); dockTimer = setTimeout(() => { dockTimer = undefined; reveal('#reader-toolbar', false); }, 120); }
  });
}
