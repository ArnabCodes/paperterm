import { chromium, webkit } from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const output='output/playwright/tutor-themes';mkdirSync(output,{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(); const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5198/?tutor=1');await page.locator('#tutor-start').waitFor();assert.equal(await page.evaluate(()=>document.body.dataset.tutorAppearance),'light');
 await page.screenshot({path:`${output}/${name}-light-intro.png`});await page.locator('#tutor-intro [data-tutor=appearance]').click();assert.equal(await page.evaluate(()=>document.body.dataset.tutorAppearance),'dark');await page.screenshot({path:`${output}/${name}-dark-intro.png`});
 await page.reload();await page.locator('#tutor-start').waitFor();assert.equal(await page.evaluate(()=>document.body.dataset.tutorAppearance),'dark');await page.keyboard.press('Enter');await page.locator('#tutor-panel').waitFor();await page.screenshot({path:`${output}/${name}-dark-level.png`});
 await page.keyboard.press('Shift+T');assert.equal(await page.evaluate(()=>document.body.dataset.tutorAppearance),'light');await page.screenshot({path:`${output}/${name}-light-level.png`});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#tutor-panel .flight-wing').evaluate(e=>getComputedStyle(e).animationName),'none');assert.deepEqual(errors,[]);console.log('PASS',name,'light/dark, persistence, keyboard theme toggle, reduced motion');await browser.close();
}
