import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync('src/tutor-state.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeTutorProgress, tutorMissions, tutorXp, tutorMaxXp, tutorMissionPassed } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const before = { ready:true, page:1, query:'', matches:0, preview:false, previewPage:0, pinned:false, theme:'paper', bookmarked:false, notes:0, ruler:false, spread:0, returns:0 };
const actions = { navigate:{page:2}, search:{query:'coherence',matches:3}, preview:{preview:true,previewPage:3}, pin:{pinned:true}, trail:{returns:1}, theme:{theme:'nord'}, bookmark:{bookmarked:true}, notes:{notes:1}, ruler:{ruler:true}, spread:{spread:1} };
for (const mission of tutorMissions) {
  assert.equal(tutorMissionPassed(mission.id,before,before),false,`${mission.id}: no passive awards`);
  assert.equal(tutorMissionPassed(mission.id,before,{...before,...actions[mission.id]}),true,mission.id);
  assert.equal(tutorMissionPassed(mission.id,before,{...before,...actions[mission.id],ready:false}),false,`${mission.id}: wait for document`);
}
assert.equal(tutorMissionPassed('search',before,{...before,query:'coherence',matches:0}),false);
assert.equal(tutorMissionPassed('preview',before,{...before,preview:true,previewPage:4}),false);
assert.deepEqual(normalizeTutorProgress({completed:['notes','notes','injected'],skipped:['notes','search',null]}),{completed:['notes'],skipped:['search']});
assert.deepEqual(normalizeTutorProgress(null),{completed:[],skipped:[]});
assert.equal(tutorMaxXp,300);
assert.equal(tutorXp({completed:tutorMissions.map(m=>m.id),skipped:[]}),300);
assert.equal(tutorXp({completed:[],skipped:tutorMissions.map(m=>m.id)}),0);
console.log('37 tutorial checks passed: real actions, wrong targets, loading, storage recovery and XP.');
