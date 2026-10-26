const showcase = document.querySelector('.showcase');
const tabs = [...showcase.querySelectorAll('[role=tab]')];
const panels = [...showcase.querySelectorAll('[role=tabpanel]')];
const toggle = document.querySelector('#tour-toggle');
const status = document.querySelector('#tour-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const portal = document.querySelector('#stage-portal');
const reference = document.querySelector('#stage-reference');
const command = document.querySelector('#stage-command');
const commandInput = document.querySelector('#demo-command');
const lines = [...document.querySelectorAll('[data-reading-line]')];
const stage = showcase.querySelector('.reader-stage');
const modes = document.createElement('div');
modes.className = 'demo-modes'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Demonstration input method');
modes.innerHTML = '<span>Show how to use it</span><button type="button" data-input-mode="mouse" aria-pressed="true">Mouse</button><button type="button" data-input-mode="keyboard" aria-pressed="false">Keyboard</button>';
stage.prepend(modes);
const feedback = document.createElement('div');
feedback.id = 'demo-input-display'; feedback.className = 'demo-input-display'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.setAttribute('aria-atomic', 'true');
stage.querySelector('.stage-chrome').lastElementChild.replaceWith(feedback);
const pointer = document.createElement('div');
pointer.className = 'demo-pointer'; pointer.hidden = true; pointer.setAttribute('aria-hidden', 'true');
pointer.innerHTML = '<svg viewBox="0 0 24 30" width="24" height="30"><path d="M3 2v22l6-6 4 9 4-2-4-9h8Z" fill="#294336" stroke="#fffdf6" stroke-width="2" stroke-linejoin="round"/></svg>';
stage.append(pointer);
const hint = document.createElement('span'); hint.id = 'demo-reference-hint'; hint.className = 'demo-reference-hint'; hint.hidden = true; hint.textContent = 'A'; reference.append(hint);
const nodes = [...showcase.querySelectorAll('[data-node]')];
let prefix = '', hintPending = false, activationKey = 'Enter';
const instructions = [
  'Mouse: click equation (2) · Keyboard: F, then the shown hint',
  'Mouse: use the buttons · Keyboard: j / k to move, : for commands',
  'Mouse: choose a theme · Keyboard: g then d to cycle themes',
  'Mouse: click a paper · Keyboard: arrows to focus, Enter to select',
];
function setMode(mode) {
  stage.dataset.inputMode = mode;
  modes.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.inputMode === mode)));
  if (mode === 'keyboard') pointer.hidden = true;
}
function indicate(keys, message, target) {
  feedback.replaceChildren();
  const label = document.createElement('span'); label.textContent = keys.length ? 'Keys' : target ? 'Mouse' : 'Demo'; feedback.append(label);
  feedback.setAttribute('aria-live', playing ? 'off' : 'polite');
  feedback.setAttribute('aria-label', `${keys.length ? keys.join(', then ') : label.textContent}: ${message}`);
  if (keys.length) for (const key of keys) { const badge = document.createElement('kbd'); badge.textContent = ({ ArrowRight: '→', ArrowLeft: '←', Enter: '↵' })[key] || key; feedback.append(badge); }
  else { const action = document.createElement('strong'); action.textContent = message; feedback.append(action); }
  if (target && !keys.length) {
    const frame = stage.getBoundingClientRect(), bounds = target.getBoundingClientRect();
    pointer.style.left = `${Math.max(8, Math.min(frame.width - 30, bounds.x - frame.x + bounds.width * .65))}px`;
    pointer.style.top = `${Math.max(8, Math.min(frame.height - 35, bounds.y - frame.y + bounds.height * .55))}px`;
    pointer.hidden = false;
  } else pointer.hidden = true;
}
function chooseNode(node) {
  nodes.forEach(item => item.setAttribute('aria-pressed', String(item === node)));
  document.querySelector('#network-detail').textContent = node.dataset.node + ' · sample paper';
}
function mouseVersion() {
  setMode('mouse');
  if (active === 0) { showPortal(true); indicate([], 'Click equation (2)', reference); }
  else if (active === 1) { command.hidden = false; indicate([], 'Click Commands', showcase.querySelector('[data-demo-key=":"]')); }
  else if (active === 2) { setPalette('night'); indicate([], 'Click Night', showcase.querySelector('.stage-swatches [data-palette=night]')); }
  else { chooseNode(nodes[3]); indicate([], 'Click a paper', nodes[3]); }
}
function keyboardVersion(prepare = false) {
  setMode('keyboard');
  if (active === 0) { showPortal(!prepare); hintPending = prepare; hint.hidden = !prepare; indicate(prepare ? ['F'] : ['F', 'A'], prepare ? 'Show reference hints' : 'Preview reference A'); }
  else if (active === 1) { command.hidden = prepare; indicate(prepare ? ['j'] : [':'], prepare ? 'Scroll the document' : 'Open commands'); if (prepare) moveLine(1); }
  else if (active === 2) { if (prepare) setPalette('paper'); else setPalette('sepia'); indicate(prepare ? ['g'] : ['g', 'd'], prepare ? 'Start a reader command' : 'Cycle reading theme'); }
  else { if (!prepare) chooseNode(nodes[1]); indicate(prepare ? ['g', 'c'] : ['g', 'c', 'ArrowRight', 'Enter'], prepare ? 'Open citation map' : 'Focus and select a paper'); }
}
let active = 0;
let line = 0;
let playing = false;
let timer;
let step = 0;
let visible = false;
let introduced = false;

function showPortal(open) {
  portal.hidden = !open;
  if (open) { hintPending = false; hint.hidden = true; }
  reference.setAttribute('aria-expanded', String(open));
}

function selectScene(index) {
  active = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, position) => {
    tab.setAttribute('aria-selected', String(position === active));
    tab.tabIndex = position === active ? 0 : -1;
    panels[position].hidden = position !== active;
  });
  showPortal(false);
  command.hidden = true;
  prefix = ''; hintPending = false; hint.hidden = true; pointer.hidden = true;
  panels[active].querySelector('.stage-caption').textContent = instructions[active];
  indicate([], 'Choose Mouse or Keyboard');
}

function setPalette(palette) {
  document.querySelector('.reader-stage').dataset.palette = palette;
  showcase.querySelectorAll('[data-palette][aria-pressed]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.palette === palette));
  });
}

function moveLine(direction) {
  line = (line + direction + lines.length) % lines.length;
  lines.forEach((item, index) => item.classList.toggle('current-line', index === line));
}

function setPlaying(value) {
  playing = value;
  clearTimeout(timer);
  if (!value) pointer.hidden = true;
  showcase.dataset.playing = String(value);
  toggle.setAttribute('aria-pressed', String(value));
  toggle.textContent = value ? 'Pause guided tour Ⅱ' : 'Play guided tour ↗';
  status.textContent = value ? 'Guided illustration · pause any time, or try a control.' : 'Tour paused. Choose a feature. Try it your way.';
  if (value) { step = 0; showPortal(false); command.hidden = true; schedule(); }
}

function schedule() {
  timer = setTimeout(() => {
    if (!playing || document.hidden || !visible) return;
    const phase = step++ % 4;
    if (phase === 0) mouseVersion();
    else if (phase === 1) keyboardVersion(true);
    else if (phase === 2) keyboardVersion();
    else selectScene(active + 1);
    schedule();
  }, 2400);
}

toggle.addEventListener('click', () => setPlaying(!playing));
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => { setPlaying(false); selectScene(index); });
  tab.addEventListener('keydown', event => {
    const directions = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(event.key in directions) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    setPlaying(false);
    selectScene(event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : active + directions[event.key]);
    tabs[active].focus();
  });
});
showcase.addEventListener('pointerdown', event => { if (!event.target.closest('#tour-toggle')) setPlaying(false); });
showcase.addEventListener('focusin', event => { if (event.target !== toggle && playing) setPlaying(false); });
reference.addEventListener('click', event => { setMode(event.detail ? 'mouse' : 'keyboard'); showPortal(portal.hidden); indicate(event.detail ? [] : [activationKey], portal.hidden ? 'Close reference' : 'Preview reference', event.detail ? reference : undefined); });
showcase.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    setMode('keyboard'); indicate(['Escape'], 'Close preview or commands'); hintPending = false; hint.hidden = true;
    if (!portal.hidden) { showPortal(false); reference.focus(); }
    if (!command.hidden) { command.hidden = true; panels[1].focus(); }
  }
  if (!event.target.closest('.reader-stage') || event.target.matches('input') || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key === 'Escape' || event.key === 'Tab') return;
  if (event.target.closest('button') && ['Enter', ' '].includes(event.key)) {
    activationKey = event.key === ' ' ? 'Space' : 'Enter'; setPlaying(false); setMode('keyboard'); indicate([activationKey], 'Activate control'); return;
  }
  if (active === 3 && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); setPlaying(false); setMode('keyboard');
    const current = nodes.indexOf(document.activeElement), selected = nodes.findIndex(node => node.getAttribute('aria-pressed') === 'true');
    const next = ((current >= 0 ? current : selected) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + nodes.length) % nodes.length;
    nodes[next].focus(); indicate([event.key], 'Focus a paper'); return;
  }
  const key = event.key;
  if (active === 0 && (key === 'F' || (hintPending && key.toLowerCase() === 'a'))) {
    event.preventDefault(); setPlaying(false); setMode('keyboard');
    if (key === 'F') { showPortal(false); hintPending = true; hint.hidden = false; indicate(['F'], 'Show reference hints'); }
    else { showPortal(true); indicate(['F', 'A'], 'Preview reference A'); }
    return;
  }
  if ((active === 2 || active === 3) && (key === 'g' || (prefix === 'g' && key === (active === 2 ? 'd' : 'c')))) {
    event.preventDefault(); setPlaying(false); setMode('keyboard');
    if (key === 'g') { prefix = 'g'; indicate(['g'], 'Start a reader command'); }
    else {
      prefix = '';
      if (active === 2) { const palettes = ['paper', 'sepia', 'night']; setPalette(palettes[(palettes.indexOf(stage.dataset.palette) + 1) % palettes.length]); indicate(['g', 'd'], 'Cycle reading theme'); }
      else { chooseNode(nodes[0]); indicate(['g', 'c'], 'Open citation map'); }
    }
    return;
  }
  if (active !== 1 || !event.target.closest('#scene-flow') || !['j', 'k', ':'].includes(key)) return;
  event.preventDefault();
  setPlaying(false);
  runKey(event.key);
  setMode('keyboard'); indicate([key], key === ':' ? 'Open commands' : 'Scroll document');
});
function runKey(key) {
  if (key === ':') { command.hidden = false; commandInput.focus(); }
  else moveLine(key === 'j' ? 1 : -1);
}
showcase.querySelectorAll('[data-demo-key]').forEach(button => button.addEventListener('click', event => { runKey(button.dataset.demoKey); setMode(event.detail ? 'mouse' : 'keyboard'); indicate(event.detail ? [] : [activationKey], button.dataset.demoKey === ':' ? 'Click Commands' : 'Click navigation', event.detail ? button : undefined); }));
commandInput.addEventListener('input', () => {
  document.querySelectorAll('#demo-command-results li').forEach(item => {
    item.hidden = !item.textContent.toLowerCase().includes(commandInput.value.toLowerCase());
  });
});
showcase.querySelectorAll('[data-palette][aria-pressed]').forEach(button => button.addEventListener('click', event => { setPalette(button.dataset.palette); setMode(event.detail ? 'mouse' : 'keyboard'); indicate(event.detail ? [] : [activationKey], `Choose ${button.textContent}`, event.detail ? button : undefined); }));
showcase.querySelectorAll('[data-node]').forEach(button => button.addEventListener('click', event => {
  chooseNode(button); setMode(event.detail ? 'mouse' : 'keyboard'); indicate(event.detail ? [] : [activationKey], 'Select a paper', event.detail ? button : undefined);
}));
modes.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { setPlaying(false); if (button.dataset.inputMode === 'mouse') mouseVersion(); else keyboardVersion(); }));
commandInput.addEventListener('keydown', event => { if (!event.isComposing && !event.ctrlKey && !event.metaKey && event.key !== 'Escape') { setMode('keyboard'); indicate([event.key === ' ' ? 'Space' : event.key], 'Search demo commands'); } });
window.addEventListener('resize', () => { pointer.hidden = true; });
document.querySelectorAll('[data-show-demo]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); introduced = true; setPlaying(false); selectScene(link.dataset.showDemo === 'peek' ? 0 : 2);
  stage.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  panels[active].focus({ preventScroll: true });
}));
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible && !introduced) {
    introduced = true;
    if (!reduced.matches) setPlaying(true);
  }
  if (!visible && playing) setPlaying(false);
}, { threshold: .15 }).observe(showcase);
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
reduced.addEventListener('change', () => { if (playing) setPlaying(false); });
moveLine(0);
selectScene(0);
