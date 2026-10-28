import { readStored, saveStored } from './preferences';
import { escapeHtml as esc } from './types';
import { normalizeTutorProgress, tutorMissions, advancedMissions, relayMissionIds, tutorMissionPassed, tutorKeyboardPassed, tutorRank, tutorKeys, type TutorSnapshot } from './tutor-state';
import type { HardMode } from './hard-mode';
import { flightScene } from './tutor-art';
import './tutor.css';

interface TutorHooks {
  open(): Promise<void>; prepare(): Promise<void>; move(direction: number): boolean;
  needsMissionSetup(id: string): boolean; prepareMission(id: string, isCurrent: () => boolean): Promise<void>;
  snapshot(): Omit<TutorSnapshot, 'returns'>; jump(page: number): void;
  command(): void; focus(): void; resetInput(): void; canPause(): boolean; hard: HardMode;
}
declare global { interface Window { render_game_to_text?: () => string; advanceTime?: (milliseconds: number) => void } }

export function initializeTutor(hooks: TutorHooks) {
  // Keep previous courses untouched. This arcade course starts with a clean run.
  const storage = 'pipit.tutor.v3';
  const raw = readStored<Record<string, unknown>>(storage, {});
  const records = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let mode: 'learn' | 'practice' | 'speedrun' | 'advanced' | 'relay' = 'learn';
  type Mission = { readonly id:string; readonly title:string; readonly xp:number; readonly page:number; readonly text:string; readonly hint:string };
  let course: readonly Mission[] = tutorMissions;
  const courseXp = () => course.filter(item => progress.completed.includes(item.id)).reduce((sum,item) => sum + item.xp, 0);
  const courseMax = () => course.reduce((sum,item) => sum + item.xp, 0);
  const dealRelay = (): Mission[] => {
    const deck: Mission[] = [...tutorMissions, ...advancedMissions].filter(item => (relayMissionIds as readonly string[]).includes(item.id));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck.slice(0, 5);
  };
  let progress = normalizeTutorProgress(records.learn);
  let keys: string[] = [], down = 0, up = 0, followed = false, trailOrigin: number | null = null, hintVisible = true;
  let active = false, loading = false, index = 0, historyReturns = 0, paused = false, replaying = false;
  let runElapsed = 0, runStarted: number | null = null, celebrated = false, runEligible = true;
  let introTimeout: ReturnType<typeof setTimeout> | undefined;
  let baseline: TutorSnapshot | null = null, timer: ReturnType<typeof setInterval> | undefined;
  let preparingMission = false, setupGeneration = 0, quickmarkVisited = false;
  const snapshot = (): TutorSnapshot => ({ ...hooks.snapshot(), returns: historyReturns, down, up });
  const dialog = document.createElement('dialog'); dialog.id = 'tutor-intro'; dialog.setAttribute('aria-labelledby', 'tutor-title');
  const panel = document.createElement('section'); panel.id = 'tutor-panel'; panel.tabIndex = -1; panel.hidden = true; panel.setAttribute('aria-label', 'Pipit flight school');
  // Vimium and similar extensions pass keys to editable controls. A read-only,
  // labelled keyboard surface gives the lesson priority without changing their settings.
  const keyboard = document.createElement('textarea');
  const previewKeyboard = document.createElement('textarea');
  for (const [control, id] of [[keyboard, 'tutor-keyboard'], [previewKeyboard, 'tutor-preview-keyboard']] as const) {
    control.id = id; control.className = 'tutor-keyboard-capture'; control.readOnly = true;
    control.tabIndex = -1; control.setAttribute('aria-label', 'Flight School keyboard controls');
  }
  const levelIntro = document.createElement('div'); levelIntro.id = 'tutor-level-intro';
  levelIntro.hidden = true; levelIntro.setAttribute('role', 'status'); levelIntro.setAttribute('aria-live', 'polite');
  document.body.append(dialog, panel, keyboard, levelIntro);
  document.querySelector('#portal-scroll')!.append(previewKeyboard);
  let appearance = readStored<'light' | 'dark' | null>('pipit.tutor.appearance', null);
  if (appearance !== 'light' && appearance !== 'dark') appearance = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  function applyAppearance() { document.body.dataset.tutorAppearance = appearance!; }
  function toggleAppearance() { appearance = appearance === 'light' ? 'dark' : 'light'; saveStored('pipit.tutor.appearance', appearance); applyAppearance();
    document.querySelectorAll<HTMLElement>('[data-tutor=appearance]').forEach(button => { button.textContent = appearance === 'dark' ? '☀ Light' : '☾ Dark'; button.setAttribute('aria-label', `Switch to ${appearance === 'dark' ? 'light' : 'dark'} game appearance (Shift T)`); }); }
  applyAppearance();
  const appearanceButton = () => `<button data-tutor="appearance" aria-label="Switch to ${appearance === 'dark' ? 'light' : 'dark'} game appearance (Shift T)">${appearance === 'dark' ? '☀ Light' : '☾ Dark'}</button>`;
  // Redirect only the two reader focus surfaces; real inputs and dialogs keep normal focus.
  document.addEventListener('focusin', event => {
    if (!active) return;
    if (event.target === document.querySelector('#viewer-container')) keyboard.focus({preventScroll:true});
    else if (event.target === document.querySelector('#portal-scroll')) previewKeyboard.focus({preventScroll:true});
  });
  // Some keyboard extensions consume Escape and blur an editor. During keyboard-
  // only lessons, an unexplained blur to the document restores the close action.
  let observedFocus: HTMLElement | null = null, focusRetries = 0;
  document.addEventListener('focusin', event => { if (event.target instanceof HTMLElement && document.activeElement === event.target) { observedFocus = event.target; if (event.target.matches('#tutor-keyboard,#tutor-preview-keyboard')) focusRetries = 0; } });
  document.addEventListener('focusout', event => {
    const target = event.target;
    if (!active || !(target instanceof HTMLElement) || event.relatedTarget ||
        !(target.matches('#tutor-keyboard,#tutor-preview-keyboard,#find-input') || target.closest('dialog[open]'))) return;
    const wasFocused = observedFocus === target; observedFocus = null;
    setTimeout(() => {
      if (!active || !document.hasFocus()) return;
      const openDialog = target.closest<HTMLDialogElement>('dialog[open]');
      if (document.activeElement !== document.body && document.activeElement !== openDialog) return;
      // Browser dialog restoration may interrupt the initial focus before focusin.
      if (!wasFocused) {
        if (focusRetries++ < 1) target.focus({preventScroll:true});
        else { pause(); const note = document.createElement('p'); note.className = 'tutor-conflict'; note.setAttribute('role','alert');
          note.textContent = 'A keyboard extension is blocking focus. For Surfingkeys, press Alt + S to disable it on this site; for others, use their site exclusion. Then resume.'; dialog.querySelector('.tutor-actions')?.before(note); }
        return;
      }
      if (openDialog) { openDialog.close(); keyboard.focus({preventScroll:true}); }
      else target.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
    }, 0);
  });
  panel.addEventListener('beforeinput', event => event.preventDefault());
  const mission = () => course[index];
  const done = () => progress.completed.includes(mission().id) && !replaying;
  const nextPending = () => course.findIndex(item => !progress.completed.includes(item.id) && !progress.skipped.includes(item.id));
  const elapsed = () => runElapsed + (runStarted === null ? 0 : performance.now() - runStarted);
  const timeLabel = (ms: number) => { const tenths = Math.floor(ms / 100); return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`; };
  function pauseClock() { if (runStarted !== null) { runElapsed = elapsed(); runStarted = null; } }
  function resumeClock() { if (mode === 'speedrun' && nextPending() >= 0 && runStarted === null) runStarted = performance.now(); }
  function save() { if (mode !== 'speedrun' && mode !== 'relay') records[mode] = progress; saveStored(storage, records); }
  function celebrate() {
    if (celebrated || progress.completed.length !== course.length) return;
    celebrated = true;
    const confetti = document.createElement('div'); confetti.className = 'tutor-confetti'; confetti.setAttribute('aria-hidden', 'true');
    confetti.innerHTML = Array.from({length: 28}, (_, i) => `<i style="--piece:${i};--fall-delay:${(i % 7) * 0.07}s;--fall-color:${['#e9c361','#83b478','#f2643b','#fff0c8'][i % 4]}"></i>`).join('');
    document.body.append(confetti); setTimeout(() => confetti.remove(), 4000);
  }
  function finishRun() {
    if (nextPending() >= 0) return;
    pauseClock();
    if (mode === 'speedrun' && runEligible && progress.completed.length === course.length && !progress.skipped.length) {
      const old = records.speedrunBestMs;
      if (typeof old !== 'number' || !Number.isFinite(old) || runElapsed < old) records.speedrunBestMs = Math.round(runElapsed);
      save();
    }
    celebrate();
  }
  function showLevelIntro() {
    const item = mission(); clearTimeout(introTimeout);
    levelIntro.innerHTML = `<span>LEVEL ${index + 1} / ${course.length}</span><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p>`;
    levelIntro.hidden = false; levelIntro.classList.remove('is-visible'); void levelIntro.offsetWidth; levelIntro.classList.add('is-visible');
    introTimeout = setTimeout(() => { levelIntro.hidden = true; }, 2400);
  }
  function stop() {
    preparingMission = false; setupGeneration++;
    pauseClock(); clearTimeout(introTimeout); levelIntro.hidden = true;
    active = false; clearInterval(timer); timer = undefined; hooks.hard.lesson(false);
    hooks.resetInput();
    document.querySelectorAll('.tutor-tool-hint').forEach(node=>node.remove());
    document.body.classList.remove('tutor-active'); window.dispatchEvent(new Event('resize'));
  }
  function startTimer() { clearInterval(timer); timer = setInterval(() => { check(); const clock = panel.querySelector<HTMLElement>('.tutor-clock'); if (clock) clock.textContent = timeLabel(elapsed()); }, 120); }
  function arm() {
    const generation = ++setupGeneration;
    hooks.resetInput();
    if ((mission().id !== 'move' || mode === 'relay') && !['pin', 'trail'].includes(mission().id)) hooks.jump(mission().id === 'navigate' ? 1 : mission().page);
    const id = mission().id;
    keys = []; followed = false; trailOrigin = null; quickmarkVisited = false; down = up = 0; hintVisible = mode === 'learn' || mode === 'advanced'; baseline = snapshot(); render(); showLevelIntro();
    preparingMission = hooks.needsMissionSetup(id);
    panel.dataset.preparing = String(preparingMission);
    if (!preparingMission) return;
    updateFeedback('Preparing equation (2) for this level…');
    const isCurrent = () => active && generation === setupGeneration && mission().id === id;
    void hooks.prepareMission(id, isCurrent).then(() => {
      if (!isCurrent()) return;
      preparingMission = false; panel.dataset.preparing = 'false'; baseline = snapshot(); updateFeedback(); hooks.focus();
    }).catch(() => {
      if (!isCurrent()) return;
      preparingMission = false; panel.dataset.preparing = 'false'; baseline = snapshot();
      updateFeedback('Preview unavailable. Press e, type 2 and press Enter to reopen equation (2).');
    });
  }
  // Visible symbol with a spoken name for screen readers.
  const keyText = (text: string) => esc(text).replace(/Enter/g, '<kbd aria-label="Enter">⏎</kbd>');
  function toggleHint() {
    hintVisible = !hintVisible;
    panel.querySelector<HTMLElement>('.tutor-hint')!.hidden = !hintVisible;
    const button = panel.querySelector<HTMLButtonElement>('[data-tutor=hint]')!;
    button.innerHTML = `${hintVisible ? 'Hide help' : 'Need a hint?'} <kbd>Shift H</kbd>`;
    button.setAttribute('aria-pressed', String(hintVisible));
    syncToolHint();
  }
  function render() {
    const item = mission(), xp = courseXp(), finished = nextPending() < 0 && !replaying, allCleared = progress.completed.length === course.length;
    const labels: Record<string,string> = {P:'Shift p',Q:'Shift q',Enter:'⏎','Mod+Enter':'Ctrl / ⌘ ⏎','Alt+ArrowLeft':'Alt ←'};
    const keycaps = (tutorKeys[item.id] || []).map(key => `<kbd${key.includes('Enter') ? ` aria-label="${key === 'Enter' ? 'Enter' : 'Control or Command Enter'}"` : ''}>${esc(labels[key] || key)}</kbd>`).join('<span>→</span>');
    panel.innerHTML = `<header><span>✦ PIPIT FLIGHT SCHOOL</span><div class="tutor-header-actions">${appearanceButton()}<button data-tutor="pause" aria-label="Pause game">Ⅱ</button></div></header>
      <div class="tutor-score"><span>${mode === 'speedrun' ? `TIME <b class="tutor-clock">${timeLabel(elapsed())}</b>${!runEligible ? ' · UNRANKED' : typeof records.speedrunBestMs === 'number' ? ` · BEST ${timeLabel(records.speedrunBestMs)}` : ''}` : mode === 'relay' ? `✦ ${progress.completed.length} / ${course.length} FEATHERS` : esc(tutorRank(xp))}</span><strong>${xp}<small> / ${courseMax()} XP</small></strong></div>
      <div class="tutor-map" aria-label="Level progress">${course.map((item, at) => `<span class="${progress.completed.includes(item.id) ? 'cleared' : at === index ? 'current' : ''}" aria-label="Level ${at+1}${progress.completed.includes(item.id) ? ' cleared' : ''}">${at+1}</span>`).join('')}</div>
      <div class="tutor-scene">${flightScene(down > 0 && !up, done(), item.id)}</div>
      <p class="tutor-waypoint">${mode === 'learn' ? 'LEARN' : mode === 'practice' ? 'PRACTICE' : mode === 'speedrun' ? 'SPEEDRUN' : mode === 'advanced' ? 'ADVANCED' : 'FEATHER RELAY'} · LEVEL ${index+1} / ${course.length} <span>+${item.xp} XP</span></p>
      <h2>${finished ? allCleared ? mode === 'relay' ? 'Your relay is complete!' : 'You earned your wings.' : 'Your route is complete.' : esc(item.title)}</h2>
      <p class="tutor-objective">${finished ? allCleared ? mode === 'relay' ? 'Five feathers collected. Deal a fresh route whenever you like.' : 'All levels cleared. Take these keys to your next paper.' : 'Skipped levels can be revisited from the level map.' : esc(item.text)}</p>
      <div class="tutor-hint" ${hintVisible ? '' : 'hidden'}><div class="tutor-keycaps">${keycaps}</div><p class="tutor-live-step"></p><details class="tutor-all-steps"><summary>Full walkthrough</summary><ol class="tutor-steps">${item.hint.split(/(?<=\.) /).map(step=>`<li>${keyText(step)}</li>`).join('')}</ol></details></div>
      <p class="tutor-reward" role="status" aria-live="polite"></p>
      <div class="tutor-actions"><button data-tutor="next" ${done() || finished ? '' : 'disabled'}>${finished ? mode === 'relay' ? 'Deal a new relay' : 'View level map' : 'Next level'} <kbd aria-label="Enter">⏎</kbd></button><button data-tutor="hint" aria-keyshortcuts="Shift+H" aria-pressed="${hintVisible}">${hintVisible ? 'Hide help' : 'Need a hint?'} <kbd>Shift H</kbd></button></div>
      <details class="tutor-levels"><summary>Level map &amp; options</summary><ol>${course.map((item, at)=>`<li><button data-mission="${at}" ${at===index ? 'aria-current="step"' : ''}>${progress.completed.includes(item.id) ? '✦' : progress.skipped.includes(item.id) ? '–' : '○'} ${at+1}. ${esc(item.title)}</button></li>`).join('')}</ol><div class="tutor-secondary"><button data-tutor="skip">Skip level</button><button data-tutor="commands">All commands</button><button data-tutor="restart">Restart this run</button></div><div id="tutor-confirm" hidden><p>Reset this run’s XP? Your notes and bookmarks stay.</p><button data-tutor="confirm-reset">Reset run</button><button data-tutor="cancel-reset">Keep run</button></div></details>
      <footer><span><kbd>Tab</kbd> controls · <kbd>F2</kbd> focus · <kbd>Shift T</kbd> style</span><span><kbd>Esc</kbd> pause</span></footer>`;
    // Safari/WebKit does not reliably focus editable buttons. Chromium and
    // Firefox can mark them editable to let keyboard extensions pass through.
    if (!/AppleWebKit/i.test(navigator.userAgent) || /Chrom(e|ium)|Edg\//i.test(navigator.userAgent))
      panel.querySelectorAll<HTMLElement>('button,summary').forEach(control => { control.contentEditable = 'true'; });
    updateFeedback();
  }
  function updateFeedback(message?: string) {
    const item = mission();
    const guides: Record<string,string> = {
      navigate:'Press lowercase p to open page jump. Type 2, then Enter. You’ll land on the second page.',
      search:'Press / (forward slash). Type coherence into the search box. After your feather appears, Escape closes search.',
      preview:'Press lowercase e. Type 2 into the equation lookup, then Enter. Leave the lens open for the next level.',
      pin:'Keep the lens open. Hold Shift and press p. The equation becomes a side pane.',
      trail:'Press Enter to follow the equation. Then press g, release it, and press h to return. Backspace also goes back.',
      theme:'Press lowercase g and release it, then d. These keys are a sequence, not a chord. Watch the paper change colors.',
      bookmark:'Press lowercase b to plant a bookmark. If already marked, press b to remove it, then b again to plant it.',
      notes:'Hold Shift and press q to open the notebook. Ctrl + Enter (⌘ + Enter on Mac) adds a note. Type a sentence; Escape returns you here.',
      'quickmark':"Press m then a to save a mark. Press p, type 3 and Enter. Press ' then a to return.",
      'ruler-adjust':'Press ] to reveal the ruler and move it down. Use [ to move it up.',
      focus:'Press z to enter focus mode. Press z again to return afterward.',
      ruler:'Press lowercase r for the reading ruler. If already on, press r off, then r on again. The [ and ] keys move it.',
      spread:'Press lowercase g, release it, then 2. Two pages unfold together. If already in that view, repeat to go single, then repeat again.',
    };
    let text = guides[item.id] || item.hint;
    if (item.id === 'move') text = down ? 'Now press k to fly back up to your nest.' : 'Press j once, without Shift. Pip flies down and the paper scrolls with you.';
    if (done()) text = 'Feather collected! Press Enter for the next level.';
    panel.querySelector('.tutor-live-step')!.innerHTML = keyText(text);
    panel.querySelector('.tutor-reward')!.textContent = message || (done() ? `✦ +${item.xp} XP · Level cleared!` : item.id === 'move' && down ? '✓ Downward flight. Now bring Pip home.' : 'Your keyboard is the controller. No rush.');
    panel.dataset.won = String(done());
    const scene = panel.querySelector('.tutor-scene')!;
    const flight = down > 0 && !up;
    if (scene.getAttribute('data-flight') !== `${flight}:${done()}:${item.id}`) { scene.innerHTML = flightScene(flight, done(), item.id); scene.setAttribute('data-flight', `${flight}:${done()}:${item.id}`); }
    panel.querySelectorAll<HTMLElement>('.tutor-keycaps kbd').forEach((node, at) => { node.classList.toggle('key-used', keys.includes(tutorKeys[item.id]?.[at])); });
  }
  function syncToolHint() {
    const tool = document.querySelector<HTMLDialogElement>('dialog[open]:not(#tutor-intro)');
    document.querySelectorAll<HTMLElement>('.tutor-tool-hint').forEach(node=>{if(!hintVisible||!tool?.contains(node))node.remove();});
    if(!hintVisible||!tool)return;
    const title = tool.querySelector('#palette-title')?.textContent || '';
    let text = '';
    if(mission().id==='notes'&&tool.querySelector('.notebook-add'))text=done()?'✦ Feather found! Escape closes the notebook, then Enter starts the next level.':'FLIGHT SCHOOL · Ctrl + Enter (⌘ + Enter on Mac) adds a note. Type a sentence; it saves automatically. Escape returns to the game.';
    if(mission().id==='navigate'&&title==='Go to page')text='FLIGHT SCHOOL · Type 2, then press Enter to reach checkpoint two.';
    if(mission().id==='preview'&&title==='Find an equation')text='FLIGHT SCHOOL · Type 2, then Enter to reveal the equation.';
    if(!text)return;
    let hint=tool.querySelector<HTMLElement>('.tutor-tool-hint');
    if(!hint){hint=document.createElement('p');hint.className='tutor-tool-hint';hint.setAttribute('role','status');tool.prepend(hint);}
    if(hint.dataset.copy!==text){hint.innerHTML=keyText(text);hint.dataset.copy=text;}
  }
  function check() {
    if (!active || preparingMission || !baseline || !hooks.hard.enabled()) return;
    syncToolHint();
    const current = snapshot(), id = mission().id;
    if (!current.ready) return;
    if (id === 'quickmark' && current.quickmarkPage === baseline.page && current.page === 3) quickmarkVisited = true;
    if (id === 'bookmark' && !current.bookmarked) baseline.bookmarked = false;
    if (id === 'ruler' && !current.ruler) baseline.ruler = false;
    if (id === 'spread' && !current.spread) baseline.spread = 0;
    if (id === 'focus' && !current.focus) baseline.focus = false;
    if (done() || (id === 'quickmark' && !quickmarkVisited) || !tutorKeyboardPassed(id,keys) || !tutorMissionPassed(id,baseline,current)) return;
    if (!progress.completed.includes(id)) progress.completed.push(id);
    replaying = false; progress.skipped = progress.skipped.filter(entry=>entry!==id); save(); finishRun(); render();
  }
  async function begin(route: 'learn' | 'practice' | 'speedrun' | 'advanced' | 'relay') {
    if (loading) return;
    focusRetries = 0; replaying = false; mode = route;
    course = mode === 'advanced' ? advancedMissions : mode === 'relay' ? dealRelay() : tutorMissions;
    progress = mode === 'speedrun' || mode === 'relay' ? {completed:[],skipped:[]} : normalizeTutorProgress(records[mode], course);
    runElapsed = 0; runStarted = null; celebrated = false; runEligible = true;
    if (mode === 'practice' && tutorMissions.every(item=>progress.completed.includes(item.id)||progress.skipped.includes(item.id))) { records.practicePrevious = progress; progress = {completed:[],skipped:[]}; }
    stop(); loading = true; paused = false;
    dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=true);
    dialog.querySelector('[role=status]')!.textContent = 'Opening your training paper…';
    try {
      await hooks.open();
      if (!hooks.snapshot().ready) throw new Error('The paper did not load. Press Play to retry.');
      document.body.classList.add('tutor-active'); window.dispatchEvent(new Event('resize'));
      await hooks.prepare();
      dialog.close(); records.started = true; save(); index = Math.max(0,nextPending()); active = true;
      historyReturns = down = up = 0; hooks.hard.lesson(true); panel.hidden = false; arm(); resumeClock(); startTimer(); hooks.focus();
    } catch(error) { document.body.classList.remove('tutor-active'); dialog.querySelector('[role=status]')!.textContent = error instanceof Error ? error.message : 'Could not open the paper. Try again.'; }
    finally { loading = false; dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=false); }
  }
  function intro() {
    stop(); paused = false; panel.hidden = true;
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(other=>other.close());
    const returning = records.started === true;
    dialog.innerHTML = `<div class="tutor-intro-heading"><p class="tutor-label">✦ PIPIT FLIGHT SCHOOL</p>${appearanceButton()}</div><h2 id="tutor-title">Small keys.<br><em>Big adventures.</em></h2>${flightScene()}
      <p class="tutor-welcome">Help Pip collect eleven feathers. Learn one reading shortcut at a time. No Vim experience needed.</p>
      <div class="tutor-actions"><button id="tutor-start" data-tutor="${returning ? 'practice' : 'start'}">${returning ? 'Practice' : 'Play'} <kbd aria-label="Enter">⏎</kbd></button><button data-tutor="${returning ? 'start' : 'practice'}">${returning ? 'Guided play' : 'Practice'}</button>${returning ? '<button data-tutor="speedrun">Speedrun</button>' : ''}<button data-tutor="advanced">Advanced</button><button data-tutor="relay">Feather relay</button></div>
      <p class="tutor-intro-note">${returning ? 'Practice hides hints. Speedrun times a fresh run and pauses with you; skipping makes it unranked.' : 'J goes down. K comes back up. We’ll show you.'}<br>Advanced teaches quickmarks, the ruler and focus. Feather relay deals five surprise challenges from a deck of eight—no timer.<br>Use your mouse in this panel; play the paper with keys. <kbd>Esc</kbd> pauses.</p><p role="status"></p><button class="tutor-leave" data-tutor="cancel">Back to reading</button>`;
    dialog.showModal(); dialog.querySelector<HTMLButtonElement>('#tutor-start')!.focus();
  }
  function pause(show = true) {
    if (!active) return;
    stop(); if(hooks.hard.enabled())hooks.hard.disable(); panel.hidden = true; paused = true;
    if (!show) { hooks.focus(); return; }
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(other=>other.close());
    dialog.innerHTML = `<p class="tutor-label">TAKE A BREATHER</p><h2 id="tutor-title">Back to the nest.</h2>${flightScene(false,true)}<p>${courseXp()} XP earned. Your mouse works again.</p><div class="tutor-actions"><button id="tutor-resume" data-tutor="resume">Resume <kbd aria-label="Enter">⏎</kbd></button><button data-tutor="cancel">Return to reader</button></div><p class="tutor-intro-note">${mode === 'speedrun' ? 'The clock is paused. Pick up where you left off.' : 'Hints are free. No timer. Pick up where you left off.'}</p>`;
    dialog.showModal(); dialog.querySelector<HTMLButtonElement>('#tutor-resume')!.focus();
  }
  function resume() {
    focusRetries = 0; dialog.close(); active = true; paused = false; document.body.classList.add('tutor-active'); window.dispatchEvent(new Event('resize'));
    hooks.hard.lesson(true); panel.hidden=false; arm(); resumeClock(); startTimer(); hooks.focus();
  }
  function next() { if (!done() && nextPending() >= 0) return; const pending=nextPending(); if (pending<0) { if (mode === 'relay') { course=dealRelay(); progress={completed:[],skipped:[]}; celebrated=false; replaying=false; index=0; arm(); hooks.focus(); } else panel.querySelector<HTMLDetailsElement>('.tutor-levels')!.open=true; return; } replaying=false; index=pending; arm(); hooks.focus(); }
  dialog.addEventListener('cancel',()=>{ paused=false; });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].filter(control => control.getClientRects().length);
    if (!controls.length) return;
    const at = controls.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault(); controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  dialog.addEventListener('click',event=>{
    const action=(event.target as HTMLElement).closest<HTMLElement>('[data-tutor]')?.dataset.tutor;
    if(action==='appearance') toggleAppearance();
    if(action==='start') void begin('learn');
    if(action==='practice') void begin('practice');
    if(action==='speedrun') void begin('speedrun');
    if(action==='advanced') void begin('advanced');
    if(action==='relay') void begin('relay');
    if(action==='resume' && paused) resume();
    if(action==='cancel') {dialog.close();paused=false;hooks.focus();}
  });
  panel.addEventListener('click',event=>{
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button'); if(!target)return;
    if(target.dataset.mission!==undefined) {index=Number(target.dataset.mission);replaying=progress.completed.includes(mission().id);arm();hooks.focus();return;}
    switch(target.dataset.tutor){
      case 'appearance':toggleAppearance();break;
      case 'pause':pause();break;
      case 'next':next();break;
      case 'hint':toggleHint();break;
      case 'commands':hooks.command();break;
      case 'skip':if(!replaying&&!done()&&!progress.skipped.includes(mission().id)){progress.skipped.push(mission().id);if(mode==='speedrun')runEligible=false;}replaying=false;save();finishRun();index=Math.max(0,nextPending());arm();hooks.focus();break;
      case 'restart':panel.querySelector<HTMLElement>('#tutor-confirm')!.hidden=false;break;
      case 'cancel-reset':panel.querySelector<HTMLElement>('#tutor-confirm')!.hidden=true;break;
      case 'confirm-reset':progress={completed:[],skipped:[]};runElapsed=0;runStarted=null;celebrated=false;runEligible=true;replaying=false;save();index=0;hooks.jump(1);arm();resumeClock();hooks.focus();break;
    }
  });
  window.addEventListener('keydown',event=>{
    if(!active || event.isComposing)return;
    if (!levelIntro.hidden) { clearTimeout(introTimeout); levelIntro.hidden = true; }
    const target=event.target instanceof HTMLElement ? event.target : document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    const typing=!target.matches('#tutor-keyboard,#tutor-preview-keyboard') && !panel.contains(target) && (target.matches('input,textarea,select')||target.isContentEditable);
    const modal=!!document.querySelector('dialog[open]');
    if(event.key==='Escape'&&!modal&&hooks.canPause()){event.preventDefault();event.stopImmediatePropagation();pause();return;}
    if (preparingMission && !modal && !['F2', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if(event.key==='H'&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&!typing&&!modal){event.preventDefault();event.stopImmediatePropagation();hooks.resetInput();toggleHint();return;}
    if(event.key==='T'&&!typing&&!modal){event.preventDefault();event.stopImmediatePropagation();hooks.resetInput();toggleAppearance();return;}
    if(event.key==='F2'&&!modal){event.preventDefault();event.stopImmediatePropagation();if(panel.contains(target))hooks.focus();else panel.querySelector<HTMLButtonElement>('[data-tutor=pause]')!.focus();return;}
    if(!typing&&!modal&&event.key==='Enter'&&(done()||event.ctrlKey||event.metaKey)&&target.tagName!=='BUTTON') {event.preventDefault();event.stopImmediatePropagation();check();next();return;}
    if (panel.contains(target) && ['Enter', ' '].includes(event.key) && target.matches('button:not([disabled]),summary')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (target instanceof HTMLButtonElement) target.click();
      else { const details = target.closest('details'); if (details) details.open = !details.open; }
      return;
    }
    // Safari/WebKit can omit buttons from native Tab traversal depending on OS settings.
    // F2 enters this control group; Tab cycles it consistently and F2 exits it.
    if (panel.contains(target) && event.key === 'Tab') {
      const controls = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), summary')].filter(control => control.getClientRects().length > 0);
      if (controls.length) { event.preventDefault(); event.stopImmediatePropagation();
        const at = controls.indexOf(target); controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus(); }
      return;
    }
    if(panel.contains(target)&&['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();if(event.key==='Home')panel.scrollTop=0;else if(event.key==='End')panel.scrollTop=panel.scrollHeight;else panel.scrollBy({top:(['ArrowDown','PageDown'].includes(event.key)?1:-1)*(event.key.startsWith('Page')?panel.clientHeight*.8:45)});return;
    }
    // Forwarded webview/assistive key events still represent keyboard input.
    // XP is a local teaching aid, not a security boundary; actual reader outcomes remain required.
    const movementKey = event.code === 'KeyJ' ? 'j' : event.code === 'KeyK' ? 'k' : event.key.toLowerCase();
    if(!typing||event.key==='Enter'){keys.push((event.ctrlKey||event.metaKey?'Mod+':event.altKey?'Alt+':'')+(mission().id==='move'&&['j','k'].includes(movementKey)?movementKey:event.key));keys=keys.slice(-100);}
    if(mission().id==='move'&&!typing&&!modal&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['j','k'].includes(movementKey)){
      event.preventDefault();event.stopImmediatePropagation();
      const key=movementKey;
      if(hooks.move(key==='j'?1:-1)){if(key==='j')down++;else up++;updateFeedback();check();}
      else updateFeedback(key==='k'?'You’re at the nest. Press J to fly down first.':'The paper is still settling. Try J once more.');
      return;
    }
    // Reader shortcuts run later in the same event. Observe the resulting state
    // before the next key so rapid off/on toggles are not lost between polls.
    queueMicrotask(check);
    if(!typing&&!modal&&event.key.length===1)updateFeedback();
  },true);
  document.addEventListener('pipit:hard-mode-exit',()=>{if(active)pause(false);});
  window.render_game_to_text=()=>JSON.stringify({mode:active?'tutor':loading?'loading':paused?'paused':'inactive',route:mode,hardMode:hooks.hard.enabled(),steps:hintVisible,mission:active?mission().id:null,replaying,xp:courseXp(),rank:tutorRank(courseXp()),course:course.map(item=>item.id),completed:progress.completed,skipped:progress.skipped,flight:down&&!up?'down':'nest',elapsedMs:mode==='speedrun'?Math.round(elapsed()):null,bestMs:typeof records.speedrunBestMs==='number'?records.speedrunBestMs:null,eligible:mode==='speedrun'?runEligible:null});
  window.advanceTime=()=>check();
  return {open:intro,active:()=>active,documentChanging:()=>{stop();panel.hidden=true;},followed:(page:number,origin:number)=>{if(active&&page===3){followed=true;trailOrigin=origin;}},returned:(page:number)=>{if(followed&&page===trailOrigin){historyReturns++;followed=false;trailOrigin=null;}},moved:(key:string,before:number,after:number)=>{if(active&&hooks.hard.enabled()){if(key==='j'&&after>before)down++;if(key==='k'&&after<before)up++;}},check};
}
