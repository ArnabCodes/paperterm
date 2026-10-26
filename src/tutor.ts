import { readStored, saveStored } from './preferences';
import { escapeHtml as esc } from './types';
import { icon } from './icons';
import { normalizeTutorProgress, tutorMissions, tutorMaxXp, tutorMissionPassed, tutorRank, tutorXp, type TutorSnapshot } from './tutor-state';
import './tutor.css';

interface TutorHooks { open(): Promise<void>; snapshot(): Omit<TutorSnapshot, 'returns'>; jump(page: number): void; command(): void; focus(): void }
declare global { interface Window { render_game_to_text?: () => string; advanceTime?: (milliseconds: number) => void } }
export function initializeTutor(hooks: TutorHooks) {
  const storage = 'pipit.tutor.v1';
  let progress = normalizeTutorProgress(readStored(storage, null));
  let active = false, loading = false, index = 0, historyReturns = 0, baseline: TutorSnapshot | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const snapshot = (): TutorSnapshot => ({ ...hooks.snapshot(), returns: historyReturns });
  const dialog = document.createElement('dialog'); dialog.id = 'tutor-intro'; dialog.setAttribute('aria-labelledby', 'tutor-title');
  const panel = document.createElement('section'); panel.id = 'tutor-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Pipit Tutor mission coach');
  document.body.append(dialog, panel);
  function save() { saveStored(storage, progress); }
  function nextPending() { return tutorMissions.findIndex(mission => !progress.completed.includes(mission.id) && !progress.skipped.includes(mission.id)); }
  function stop() { active = false; clearInterval(timer); timer = undefined; document.body.classList.remove('tutor-active'); window.dispatchEvent(new Event('resize')); }
  function arm() { baseline = snapshot(); render(); }
  function render() {
    const mission = tutorMissions[index], xp = tutorXp(progress), done = progress.completed.includes(mission.id);
    const finished = nextPending() < 0;
    panel.innerHTML = `<header><span>${icon('lens')} PIPIT TUTOR</span><button data-tutor="pause" aria-label="Pause and hide tutorial">${icon('close')}</button></header><div class="tutor-score"><strong>${tutorRank(xp)}</strong><span>${xp} / ${tutorMaxXp} XP</span></div><div class="tutor-meter" role="progressbar" aria-label="Tutorial experience" aria-valuemin="0" aria-valuemax="${tutorMaxXp}" aria-valuenow="${xp}"><span style="width:${xp / tutorMaxXp * 100}%"></span></div><canvas width="600" height="60" aria-hidden="true"></canvas><p class="tutor-waypoint">${finished ? 'Route explored' : `MISSION ${index + 1} / ${tutorMissions.length}`} · ${mission.xp} XP</p><h2>${finished ? 'Ready for your own paper' : esc(mission.title)}</h2><p>${finished ? `${progress.completed.length} missions completed, ${progress.skipped.length} skipped. Revisit any mission to practice or earn its points.` : esc(mission.text)}</p><p class="tutor-reward" role="status">${done ? `✓ Skill practiced · ${mission.xp} XP earned` : progress.skipped.includes(mission.id) ? 'Skipped · no points awarded. You can still complete it.' : 'Use the real reader tools. Progress is saved on this device.'}</p><div class="tutor-actions"><button data-tutor="next" ${done || finished ? '' : 'disabled'}>${finished ? 'Review missions' : 'Next mission'} ${icon('next')}</button><button data-tutor="hint">Show hint</button></div><p class="tutor-hint" hidden>${esc(mission.hint)}</p><div class="tutor-secondary"><button data-tutor="page">Go to page ${mission.page}</button><button data-tutor="commands">Commands</button><button data-tutor="skip" ${done ? 'disabled' : ''}>Skip</button></div><details><summary>Mission map &amp; progress</summary><ol>${tutorMissions.map((item, position) => `<li><button data-mission="${position}" aria-current="${position === index ? 'step' : 'false'}">${progress.completed.includes(item.id) ? '✓' : progress.skipped.includes(item.id) ? '–' : '○'} ${esc(item.title)}</button></li>`).join('')}</ol><p class="tutor-badges">${[60, 150, 250, 300].filter(threshold => xp >= threshold).map(threshold => `<span>${esc(tutorRank(threshold))}</span>`).join('') || 'Badges unlock as you practice.'}</p><button data-tutor="restart">Reset tutorial progress</button><div id="tutor-confirm" hidden><p>Reset only tutorial points and mission progress? Your notes and bookmarks are kept.</p><button data-tutor="confirm-reset">Reset progress</button><button data-tutor="cancel-reset">Keep progress</button></div></details><p class="tutor-foot">No timer. Free hints. Pause anytime; :Tutor resumes.</p>`;
    const context = panel.querySelector('canvas')!.getContext('2d');
    if (context) {
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#294336';
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#638665';
      context.strokeStyle = accent; context.globalAlpha = .3; context.lineWidth = 3; context.beginPath(); context.moveTo(25, 30); context.lineTo(575, 30); context.stroke(); context.globalAlpha = 1;
      tutorMissions.forEach((item, position) => { context.beginPath(); context.arc(25 + position * 550 / 9, 30, position === index ? 11 : 7, 0, Math.PI * 2); context.fillStyle = progress.completed.includes(item.id) ? accent : ink; context.globalAlpha = progress.completed.includes(item.id) || position === index ? 1 : .25; context.fill(); });
    }
  }
  function check() {
    if (!active || !baseline || document.hidden) return;
    const current = snapshot(), mission = tutorMissions[index];
    if (!current.ready) return;
    if (mission.id === 'bookmark' && !current.bookmarked) baseline.bookmarked = false;
    if (mission.id === 'ruler' && !current.ruler) baseline.ruler = false;
    if (mission.id === 'spread' && !current.spread) baseline.spread = 0;
    if (progress.completed.includes(mission.id) || !tutorMissionPassed(mission.id, baseline, current)) return;
    progress.completed.push(mission.id); progress.skipped = progress.skipped.filter(id => id !== mission.id); save(); render();
    const reward = panel.querySelector('.tutor-reward');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) reward?.animate([{ transform: 'translateY(3px)', opacity: .4 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
  }
  async function begin(reset = false) {
    if (loading) return;
    if (reset) { progress = { completed: [], skipped: [] }; save(); }
    stop(); loading = true;
    dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    try {
      await hooks.open();
      if (!hooks.snapshot().ready) throw new Error('The tutorial paper could not be opened. Try :Tutor again.');
      dialog.close(); index = Math.max(0, nextPending()); active = true; historyReturns = 0; panel.hidden = false; document.body.classList.add('tutor-active'); window.dispatchEvent(new Event('resize')); arm(); timer = setInterval(check, 250); hooks.focus();
    } catch (error) {
      dialog.querySelector('[role=status]')!.textContent = error instanceof Error ? error.message : 'Could not start the tutorial.';
    } finally { loading = false; dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; }); }
  }
  function intro() {
    stop(); panel.hidden = true;
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(other => other.close());
    dialog.innerHTML = `<span class="eyebrow">PIPIT TUTOR · THE COHERENCE ATLAS</span><h2 id="tutor-title">Learn by investigating a paper.</h2><p>Ten missions teach navigation, reference previews, comparison, notes and reading tools. Earn up to 300 XP and four badges by completing real actions. Hints are free; skips never block the route.</p><p>This opens a six-page LaTeX tutorial paper in the current tab. Your existing PDF is not modified and its reading position is saved. Progress stays on this device; no account or network lookup is needed.</p><div class="tutor-intro-stats"><span>8 core missions</span><span>2 optional challenges</span><span>No time limit</span></div><p>${tutorXp(progress) ? `Saved progress: ${tutorXp(progress)} XP · ${tutorRank(tutorXp(progress))}` : 'Start as a Reader. Build your skills one mission at a time.'}</p><p role="status"></p><div class="tutor-actions"><button id="tutor-start" data-tutor="start">${progress.completed.length || progress.skipped.length ? 'Resume expedition' : 'Start expedition'}</button><button data-tutor="cancel">Not now</button></div>`;
    dialog.showModal();
  }
  dialog.addEventListener('click', event => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-tutor]')?.dataset.tutor;
    if (action === 'start') void begin();
    if (action === 'cancel') { dialog.close(); hooks.focus(); }
  });
  panel.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.mission !== undefined) { index = Number(target.dataset.mission); arm(); return; }
    switch (target.dataset.tutor) {
      case 'pause': stop(); panel.hidden = true; hooks.focus(); break;
      case 'hint': { const hint = panel.querySelector<HTMLElement>('.tutor-hint')!; hint.hidden = !hint.hidden; target.textContent = hint.hidden ? 'Show hint' : 'Hide hint'; break; }
      case 'page': hooks.jump(tutorMissions[index].page); hooks.focus(); break;
      case 'commands': hooks.command(); break;
      case 'next': { const pending = nextPending(); if (pending < 0) { panel.querySelector('details')!.open = true; return; } index = pending; arm(); hooks.focus(); break; }
      case 'skip': { const id = tutorMissions[index].id; if (!progress.completed.includes(id) && !progress.skipped.includes(id)) progress.skipped.push(id); save(); const next = nextPending(); if (next >= 0) index = next; arm(); hooks.focus(); break; }
      case 'restart': panel.querySelector<HTMLElement>('#tutor-confirm')!.hidden = false; break;
      case 'cancel-reset': panel.querySelector<HTMLElement>('#tutor-confirm')!.hidden = true; break;
      case 'confirm-reset': progress = { completed: [], skipped: [] }; save(); index = 0; hooks.jump(1); arm(); hooks.focus(); break;
    }
  });
  window.render_game_to_text = () => JSON.stringify({ mode: active ? 'tutor' : loading ? 'loading' : 'inactive', mission: active ? tutorMissions[index].id : null, xp: tutorXp(progress), rank: tutorRank(tutorXp(progress)), completed: progress.completed, skipped: progress.skipped });
  window.advanceTime = () => check();
  return { open: intro, documentChanging: () => { stop(); panel.hidden = true; }, returned: () => { historyReturns++; }, check };
}
