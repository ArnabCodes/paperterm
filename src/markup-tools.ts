import { icon } from './icons';
import './markup-tools.css';

export interface MarkupHooks {
  placeText(text: string): void;
  placeSignature(dataUrl: string): void;
  toast(message: string): void;
}

export interface MarkupToolsController { addText(): void; sign(): void }

function textStamp(text: string): string {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Text placement is unavailable in this browser.');
  const font = '18px Inter, system-ui, sans-serif';
  context.font = font;
  const logicalWidth = Math.min(880, Math.max(160, ...text.split(/\r?\n/).map(line => context.measureText(line).width + 24)));
  const lines: string[] = [];
  for (const sourceLine of text.split(/\r?\n/)) {
    let line = '';
    for (const word of sourceLine.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > logicalWidth - 24) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  const logicalHeight = Math.min(480, Math.max(36, lines.length * 27 + 12));
  const ratio = 3;
  canvas.width = Math.ceil(logicalWidth * ratio);
  canvas.height = Math.ceil(logicalHeight * ratio);
  context.scale(ratio, ratio);
  context.font = font;
  context.fillStyle = '#1d2924';
  context.textBaseline = 'top';
  lines.forEach((line, index) => context.fillText(line, 12, 6 + index * 27, logicalWidth - 24));
  return canvas.toDataURL('image/png');
}

export function initializeMarkupTools(hooks: MarkupHooks): MarkupToolsController {
  const textDialog = document.createElement('dialog');
  textDialog.className = 'markup-dialog';
  textDialog.innerHTML = `<form class="markup-card" data-markup-form="text"><header><span>${icon('text')} Add text</span><button type="button" data-markup-close aria-label="Close">${icon('close')}</button></header><p>Add a text stamp to an edited copy. Choose its position on the page after typing.</p><label>Text<textarea name="text" maxlength="2000" rows="4" required placeholder="Type the text to add…"></textarea></label><footer><span><kbd>Enter</kbd> place after typing · <kbd>Esc</kbd> cancel</span><button class="primary" type="submit">Choose position</button></footer></form>`;
  document.body.append(textDialog);
  const textInput = textDialog.querySelector<HTMLTextAreaElement>('textarea')!;

  const signatureDialog = document.createElement('dialog');
  signatureDialog.className = 'markup-dialog';
  signatureDialog.innerHTML = `<form class="markup-card" data-markup-form="signature"><header><span>${icon('signature')} Add signature</span><button type="button" data-markup-close aria-label="Close">${icon('close')}</button></header><p>Draw with a pointer, or type your name for a keyboard-friendly signature stamp.</p><label class="signature-name-label">Type your name<input name="name" maxlength="120" autocomplete="name" placeholder="Your name"/></label><label class="signature-canvas-label">Or draw your signature<canvas class="signature-pad" width="720" height="220" tabindex="0" aria-label="Draw your signature here, or use the name field above"></canvas></label><footer><button type="button" class="signature-clear" data-signature-clear>Clear</button><button class="primary" type="submit">Choose position</button></footer><small>This is a visible signature image, not a certificate-backed digital signature.</small></form>`;
  document.body.append(signatureDialog);
  const signatureForm = signatureDialog.querySelector<HTMLFormElement>('form')!;
  const signaturePad = signatureDialog.querySelector<HTMLCanvasElement>('.signature-pad')!;
  const signatureName = signatureDialog.querySelector<HTMLInputElement>('input[name="name"]')!;
  const context = signaturePad.getContext('2d')!;
  let drawing = false;
  let hasInk = false;

  function point(event: PointerEvent) {
    const rect = signaturePad.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * signaturePad.width / rect.width, y: (event.clientY - rect.top) * signaturePad.height / rect.height };
  }
  signaturePad.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); drawing = true; hasInk = true; signaturePad.setPointerCapture(event.pointerId);
    const p = point(event); context.beginPath(); context.moveTo(p.x, p.y);
  });
  signaturePad.addEventListener('pointermove', event => {
    if (!drawing) return;
    const p = point(event); context.lineWidth = 5; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#17231e'; context.lineTo(p.x, p.y); context.stroke();
  });
  const finishStroke = () => { drawing = false; };
  signaturePad.addEventListener('pointerup', finishStroke);
  signaturePad.addEventListener('pointercancel', finishStroke);
  signatureDialog.querySelector('[data-signature-clear]')!.addEventListener('click', () => {
    context.clearRect(0, 0, signaturePad.width, signaturePad.height); hasInk = false; signatureName.value = ''; signatureName.focus();
  });

  for (const dialog of [textDialog, signatureDialog]) {
    dialog.querySelector('[data-markup-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
  textDialog.addEventListener('close', () => { textInput.value = ''; });
  signatureDialog.addEventListener('close', () => { context.clearRect(0, 0, signaturePad.width, signaturePad.height); signatureName.value = ''; hasInk = false; });
  textDialog.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault();
    const text = textInput.value.trim();
    if (!text) { hooks.toast('Type text before choosing its position.'); textInput.focus(); return; }
    try { hooks.placeText(textStamp(text)); textDialog.close(); }
    catch (error) { hooks.toast(error instanceof Error ? error.message : 'Could not prepare the text stamp.'); }
  });
  signatureForm.addEventListener('submit', event => {
    event.preventDefault();
    try {
      let dataUrl: string;
      if (hasInk) dataUrl = signaturePad.toDataURL('image/png');
      else {
        const name = signatureName.value.trim();
        if (!name) { hooks.toast('Draw a signature or type your name first.'); signatureName.focus(); return; }
        const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 220;
        const typed = canvas.getContext('2d')!; typed.fillStyle = '#17231e'; typed.font = 'italic 70px "Segoe Script", "Bradley Hand", cursive'; typed.textBaseline = 'middle'; typed.fillText(name, 24, 112, 660);
        dataUrl = canvas.toDataURL('image/png');
      }
      hooks.placeSignature(dataUrl); signatureDialog.close();
    } catch (error) { hooks.toast(error instanceof Error ? error.message : 'Could not prepare the signature image.'); }
  });

  return {
    addText() { textDialog.showModal(); textInput.focus(); },
    sign() { signatureDialog.showModal(); signatureName.focus(); },
  };
}
