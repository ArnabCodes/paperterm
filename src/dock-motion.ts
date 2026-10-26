export function initializeDockMotion(dock: HTMLElement) {
  return {
    setExpanded(expanded: boolean) {
      dock.dataset.expanded = String(expanded);
      dock.querySelector('[data-dock-toggle]')?.setAttribute('aria-expanded', String(expanded));
      dock.dataset.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'anchored';
    },
    setPointer(xpos: number | null) {
      dock.classList.toggle('dock-hovered', xpos !== null);
    },
  };
}
