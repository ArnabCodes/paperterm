import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const sha = value => createHash('sha256').update(value).digest('hex');
const source = sha(readFileSync('tutorial/main.tex'));
if (existsSync('public/tutor.pdf') && existsSync('tutorial/build.json')) {
  const previous = JSON.parse(readFileSync('tutorial/build.json', 'utf8'));
  if (previous.sourceSha256 === source && previous.pdfSha256 === sha(readFileSync('public/tutor.pdf'))) { console.log('LaTeX tutorial PDF is current.'); process.exit(0); }
}
mkdirSync('output/tutor-latex', { recursive: true });
for (let pass = 0; pass < 2; pass++) {
  const result = spawnSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', '-output-directory=output/tutor-latex', 'tutorial/main.tex'], { encoding: 'utf8', windowsHide: true });
  writeFileSync(`output/tutor-latex/pass-${pass + 1}.txt`, (result.stdout || '') + (result.stderr || ''));
  if (result.error || result.status !== 0) throw new Error('LaTeX tutorial build failed. Install pdflatex and inspect output/tutor-latex/pass-*.txt.');
}
copyFileSync('output/tutor-latex/main.pdf', 'public/tutor.pdf');
writeFileSync('tutorial/build.json', JSON.stringify({ engine: 'pdfLaTeX', sourceSha256: source, pdfSha256: sha(readFileSync('public/tutor.pdf')) }, null, 2) + '\n');
console.log('Compiled the tutorial paper with pdfLaTeX (two passes).');
