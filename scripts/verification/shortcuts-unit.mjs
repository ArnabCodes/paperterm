import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/shortcuts.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { leaderActions, leaderKeys, displayShortcut, shortcutSections } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
const commands = [...main.matchAll(/\{ title: '([^']+)', detail: '[^']*', key: '([^']*)', action: '([^']+)'/g)].map(([, title, key, action]) => ({ title, action, key: displayShortcut(action, key) }));
let passed = 0;
const check = (name, run) => { run(); passed++; console.log(`PASS ${name}`); };
check('leader bindings target distinct registered commands', () => {
  assert.equal(new Set(Object.values(leaderActions)).size, Object.keys(leaderActions).length);
  for (const action of Object.values(leaderActions)) assert.ok(commands.some(command => command.action === action), action);
});
check('two-page view has a documented g 2 shortcut', () => assert.equal(leaderKeys.spread, 'g 2'));
check('history uses home-row leaders and documented Sioyek aliases', () => {
  assert.equal(leaderKeys['history-back'], 'g h'); assert.equal(leaderKeys['history-forward'], 'g l');
  assert.match(displayShortcut('history-back', ''), /Backspace/); assert.match(displayShortcut('history-forward', ''), /Shift Backspace/);
  assert.equal(leaderKeys.glass, 'g a'); assert.equal(leaderKeys.demo, 'g A');
  assert.equal(leaderActions.x, undefined, 'g x cannot conflict with the reserved tab-close shortcut');
});
check('all non-theme commands have direct or contextual keys', () => {
  for (const command of commands) assert.ok(command.key, command.action);
});
check('guide has eight relevant nonempty sections', () => {
  const sections = shortcutSections(commands);
  assert.equal(sections.length, 8); assert.equal(new Set(sections.map(section => section.title)).size, 8);
  for (const section of sections) assert.ok(section.rows.length > 0 && section.rows.every(row => row.length === 2 && row.every(Boolean)));
});
check('every registered command appears in the guide', () => {
  const titles = new Set(shortcutSections(commands).flatMap(section => section.rows.map(row => row[0])));
  for (const command of commands) assert.ok(titles.has(command.title), command.action);
});
check('leader display keys and dispatch come from the same registry', () => {
  for (const [key, action] of Object.entries(leaderActions)) assert.equal(leaderKeys[action], `g ${key}`);
  assert.ok(main.includes('runAction(leaderActions[event.key])'));
});
console.log(`${passed} shortcut checks passed.`);
