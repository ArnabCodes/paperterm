export function initializeDockMotion(dock: HTMLElement) {
  const core = dock.querySelector<HTMLElement>('.dock-core')!;
  const more = dock.querySelector<HTMLElement>('.dock-more')!;
  const content = dock.querySelector<HTMLElement>('.dock-more-content')!;
  const compactLayout = matchMedia('(max-width: 720px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let progress = 0;
  let velocity = 0;
  let target = 0;
  let compactWidth = 187;
  let extraWidth = 0;
  let padding = 8;
  let frame = 0;
  let previousTime = 0;
  let pointer: number | null = null;
  let icons: { node: SVGElement; center: number }[] = [];

  function magnify(width: number) {
    const left = innerWidth / 2 - width / 2;
    for (const icon of icons) {
      const distance = pointer === null || reducedMotion.matches ? Infinity : Math.abs(pointer - left - icon.center);
      const influence = Math.exp(-(distance * distance) / 3200);
      icon.node.style.setProperty('--dock-icon-scale', String(1 + influence * .14));
      icon.node.style.setProperty('--dock-lift', `${-influence * 3}px`);
    }
  }

  function apply() {
    const width = compactWidth + (compactLayout.matches ? 0 : extraWidth * progress);
    dock.style.setProperty('--dock-width', `${width}px`);
    dock.style.setProperty('--dock-progress', String(Math.max(0, Math.min(1, progress))));
    dock.dataset.motion = reducedMotion.matches ? 'reduced' : 'spring';
    more.style.visibility = progress > .001 || target ? 'visible' : 'hidden';
    magnify(width);
  }

  function animate(time: number) {
    const elapsed = previousTime ? Math.min((time - previousTime) / 1000, .04) : 1 / 60;
    previousTime = time;
    const displacement = progress - target;
    const coefficient = velocity + 12 * displacement;
    const decay = Math.exp(-12 * elapsed);
    progress = target + (displacement + coefficient * elapsed) * decay;
    velocity = (velocity - 12 * coefficient * elapsed) * decay;
    if (Math.abs(progress - target) < .0005 && Math.abs(velocity) < .005) {
      progress = target; velocity = 0; frame = 0; previousTime = 0;
      dock.dataset.animating = 'false'; apply(); return;
    }
    apply(); frame = requestAnimationFrame(animate);
  }

  function measure() {
    const style = getComputedStyle(dock);
    padding = parseFloat(style.paddingLeft);
    compactWidth = core.scrollWidth + padding + parseFloat(style.paddingRight);
    extraWidth = content.scrollWidth;
    dock.style.setProperty('--dock-core-width', `${core.scrollWidth}px`);
    dock.style.setProperty('--dock-extra-width', `${extraWidth}px`);
    const origin = dock.getBoundingClientRect().left;
    icons = [...dock.querySelectorAll<SVGElement>('button > .app-icon')].map(node => {
      const box = node.parentElement!.getBoundingClientRect();
      return { node, center: box.left + box.width / 2 - origin };
    });
    apply();
  }

  const observer = new ResizeObserver(measure);
  observer.observe(core); observer.observe(content);
  compactLayout.addEventListener('change', measure);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      cancelAnimationFrame(frame); frame = 0; previousTime = 0; progress = target; velocity = 0;
      dock.dataset.animating = 'false'; apply();
    } else apply();
  });
  measure();
  return {
    setExpanded(expanded: boolean) {
      const next = expanded ? 1 : 0;
      if (next === target) return;
      target = next;
      if (reducedMotion.matches) { progress = target; velocity = 0; apply(); return; }
      if (!frame) {
        dock.dataset.animating = 'true'; previousTime = 0; frame = requestAnimationFrame(animate);
      }
    },
    setPointer(xpos: number | null) { pointer = xpos; magnify(compactWidth + (compactLayout.matches ? 0 : extraWidth * progress)); },
  };
}
