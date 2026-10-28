/** Input policy only: browser chrome and operating-system dialogs remain outside the page. */
export function initializeHardMode() {
  let manual = false, lesson = false;
  const badge = document.createElement('div'); badge.id = 'keyboard-only-status'; badge.hidden = true;
  badge.setAttribute('role', 'status'); badge.textContent = 'KEYBOARD ONLY · Ctrl Shift F12 to exit'; document.body.append(badge);
  const enabled = () => manual || lesson;
  function update() {
    document.body.classList.toggle('keyboard-only', enabled());
    document.body.classList.toggle('tutor-pointer-panel', lesson && !manual);
    badge.textContent = lesson && !manual ? 'KEYBOARD LESSON · Game controls can use the mouse' : 'KEYBOARD ONLY · Ctrl Shift F12 to exit';
    badge.hidden = !enabled();
  }
  function exit() { manual = lesson = false; update(); document.dispatchEvent(new Event('pipit:hard-mode-exit')); }
  const block = (event: Event) => {
    if (!enabled()) return;
    // Lessons still require keyboard actions, but their coach is mouse accessible.
    if (lesson && !manual && event.composedPath().some(node => node instanceof Element && node.id === 'tutor-panel')) return;
    // Native keyboard activation and assistive technology use zero-detail clicks.
    if (event.type === 'click' && (event as MouseEvent).detail === 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  for (const type of ['pointerdown','pointerup','pointermove','pointerover','pointerout','mousedown','mouseup','mousemove','mouseover','mouseout','click','auxclick','dblclick','contextmenu','wheel','touchstart','touchmove','touchend','dragstart','dragenter','dragover','dragleave','drop']) window.addEventListener(type, block, { capture:true, passive:false });
  window.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && event.key === 'F12') { event.preventDefault(); event.stopImmediatePropagation(); if (enabled()) exit(); else { manual = true; update(); } }
  }, true);
  return { enabled, disable:exit, toggle: () => { if (enabled()) exit(); else { manual = true; update(); } }, lesson: (value: boolean) => { lesson = value; update(); } };
}
export type HardMode = ReturnType<typeof initializeHardMode>;
