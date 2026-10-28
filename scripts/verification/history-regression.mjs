import { chromium, webkit } from 'playwright';import assert from 'node:assert/strict';import { mkdirSync } from 'node:fs';
const browser=await (process.env.PIPIT_TEST_ENGINE==='webkit'?webkit:chromium).launch();const out='output/playwright/history-regression';mkdirSync(out,{recursive:true});
const entry=process.env.PIPIT_TUTOR_URL||'http://127.0.0.1:5198/?tutor=1';
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const location=p=>p.evaluate(()=>{const c=document.querySelector('#viewer-container');const page=document.querySelector('#page-current').textContent;const v=document.querySelector(`.pdfViewer .page[data-page-number="${page}"]`);return {page,offset:(c.scrollTop-v.offsetTop)/v.clientHeight};});
async function ready(p){await p.waitForFunction(()=>document.querySelector('#tutor-panel')?.dataset.preparing==='false' && !document.querySelector('#portal').hidden && document.querySelector('#portal').getAttribute('aria-busy')==='false');}
async function pageIs(p,n){await p.waitForFunction(n=>document.querySelector('#page-current').textContent===String(n),n);}
async function pair(p,a,b){await p.keyboard.press(a);await p.keyboard.press(b)}
try {
 for(const size of [{width:1440,height:1000},{width:1920,height:1080}]){
 const p=await browser.newPage({viewport:size});p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  if(!localStorage.getItem('pipit.tutor.v3'))localStorage.setItem('pipit.tutor.v3',JSON.stringify({started:true,learn:{completed:['move','navigate','search','preview','pin'],skipped:[]}}));
  const id='31c7870ac620bf76247ea22d0ec51198';
  localStorage.setItem(`paperterm.reading.${id}`,JSON.stringify({page:2,zoom:'auto',marks:{},bookmarks:[{page:2,name:'Existing bookmark',y:.1}]}));
  localStorage.setItem(`paperterm.notebook.v1:${id}`,JSON.stringify([{id:'existing',page:2,offset:.1,excerpt:'',note:'Previously saved note'}]));
 });
 await p.goto(entry);await p.locator('[data-tutor=start]').click();await p.locator('#tutor-panel').waitFor();await ready(p);assert.equal((await state(p)).mission,'trail');await pageIs(p,2);
 await p.keyboard.press('j');await p.keyboard.press('j');await p.waitForTimeout(120);const origin=await location(p);
 await p.keyboard.press('Enter');await pageIs(p,3);const dest=await location(p);
 await p.keyboard.press('g');await p.keyboard.press('Shift');await p.keyboard.press('h');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('trail'));await pageIs(p,Number(origin.page));const back=await location(p);assert.ok(Math.abs(back.offset-origin.offset)<.035,'same page-relative source after pinned pane closes');
 await pair(p,'g','l');await pageIs(p,3);const ahead=await location(p);assert.ok(Math.abs(ahead.offset-dest.offset)<.035,'same destination after forward');
 await p.keyboard.press('Backspace');await pageIs(p,Number(origin.page));await p.keyboard.press('Shift+Backspace');await pageIs(p,3);await p.keyboard.press('Alt+ArrowLeft');await pageIs(p,Number(origin.page));
 const width=()=>p.locator('.pdfViewer .page[data-page-number="2"]').evaluate(n=>n.clientWidth);
 const initialWidth=await width();await p.keyboard.press('+');await p.waitForFunction(w=>document.querySelector('.pdfViewer .page[data-page-number="2"]').clientWidth>w,initialWidth);
 await p.keyboard.press('=');await p.waitForFunction(()=>{const c=document.querySelector('#viewer-container'),v=document.querySelector('.pdfViewer .page[data-page-number="2"]');return Math.abs(v.clientWidth-c.clientWidth)<80;});
 assert.ok(p.url().includes('tutor=1'),'reading history must not navigate the browser tab');assert.deepEqual(errors,[]);if(size.width===1440)await p.screenshot({path:`${out}/return.png`});
 await p.keyboard.press('Shift+Q');assert.equal(await p.locator('.notebook-note').first().inputValue(),'Previously saved note');
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('pipit.reading.31c7870ac620bf76247ea22d0ec51198')).bookmarks[0].name),'Existing bookmark');
 assert.equal(await p.evaluate(()=>localStorage.getItem('paperterm.reading.31c7870ac620bf76247ea22d0ec51198')),null,'legacy reading key is migrated away');
 assert.equal(await p.evaluate(()=>localStorage.getItem('paperterm.notebook.v1:31c7870ac620bf76247ea22d0ec51198')),null,'legacy notebook key is migrated away');
 console.log('PASS resumed lesson, relative history and existing tutorial notes at',size.width);await p.close();
 }
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(12000);await p.goto(entry);await p.locator('#tutor-start').click();await p.locator('#tutor-panel').waitFor();await p.locator('.tutor-levels summary').click();await p.locator('[data-mission="5"]').click();await ready(p);await pageIs(p,2);await p.keyboard.press('Enter');await pageIs(p,3);await p.keyboard.press('Backspace');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('trail'));console.log('PASS direct lesson selection restores required equation preview');
 const xp=(await state(p)).xp;await p.locator('.tutor-levels summary').click();await p.locator('[data-mission="5"]').click();await ready(p);assert.equal((await state(p)).replaying,true);await p.keyboard.press('Enter');await pageIs(p,3);await pair(p,'g','h');await p.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).replaying);assert.equal((await state(p)).xp,xp,'replaying does not duplicate XP');console.log('PASS replay of completed lesson 6');
 await p.keyboard.press('Enter');await p.keyboard.press('/');await p.keyboard.type('ab');await p.keyboard.press('Backspace');assert.equal(await p.locator('#find-input').inputValue(),'a','Backspace edits search text normally');await p.keyboard.press('Escape');
 const glass=await p.evaluate(()=>document.documentElement.dataset.glass);await pair(p,'g','a');assert.notEqual(await p.evaluate(()=>document.documentElement.dataset.glass),glass,'g a toggles glass');
 await p.keyboard.press('Control+Shift+F12');await pair(p,'g','Shift+A');await p.waitForFunction(()=>document.querySelector('#document-name').textContent.includes('The art of following an idea'));console.log('PASS relocated g a and g A commands');
 await p.close();
}finally{await browser.close()}
