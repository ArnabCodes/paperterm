import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'});const out='output/playwright/tutor-scenes';mkdirSync(out,{recursive:true});
try {await page.goto('http://127.0.0.1:5198/?tutor=1');await page.locator('#tutor-start').click();await page.locator('#tutor-panel').waitFor();const states=[];
 for(const appearance of ['light','dark']) {if(appearance==='dark')await page.locator('#tutor-panel [data-tutor=appearance]').click();
  const animations=[];for(let i=0;i<11;i++){
   await page.locator('.tutor-levels summary').click();await page.locator(`[data-mission="${i}"]`).click();
   const scene=page.locator('#tutor-panel .flight-scene');assert.equal(await page.evaluate(()=>document.body.dataset.tutorAppearance),appearance);
   const id=await scene.getAttribute('class');const animation=await scene.locator(i===0?'.flight-wing':'.scene-motion').evaluate(el=>getComputedStyle(el).animationName);assert.notEqual(animation,'none');animations.push(animation);
   assert.equal(await page.locator('#tutor-level-intro').isVisible(),true);assert.equal(await scene.locator(':scope > rect').count(),0);
   states.push(`${appearance}:${id}`);if([0,2,6,10].includes(i))await page.locator('#tutor-panel').screenshot({path:`${out}/${appearance}-${i}.png`});
  }assert.equal(new Set(animations).size,11,`unique animations in ${appearance}`);
 }await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#tutor-panel .scene-motion').evaluate(el=>getComputedStyle(el).animationName),'none');console.log(`PASS ${states.length} themed level scenes, 11 distinct animations, centered introductions and reduced motion`);
} finally{await browser.close();}
