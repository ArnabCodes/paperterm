import {chromium} from 'playwright';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const ext=resolve('output/browser-tools/vimium-repro'),profile=resolve(`output/playwright/history-vimium-${Date.now()}`);
const base=process.env.PIPIT_BASE_URL || 'http://127.0.0.1:5198/';
const context=await chromium.launchPersistentContext(profile,{executablePath:chromium.executablePath(),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
try {
 await(context.serviceWorkers()[0]?Promise.resolve():context.waitForEvent('serviceworker'));
 const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(`${base}?demo=1`);await page.waitForTimeout(3500);
 await page.locator('.page-button').click();await page.locator('#palette-input').fill('2');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#page-current').textContent==='2');
 await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('#page-current').textContent==='1');await page.keyboard.press('Shift+Backspace');await page.waitForFunction(()=>document.querySelector('#page-current').textContent==='2');
 await page.keyboard.press('Control+k');await page.waitForFunction(()=>document.querySelector('#palette').open);assert.match(await page.locator('#palette-title').innerText(),/command/i);
 console.log('PASS Vimium standalone reader: Backspace, Shift Backspace, and Ctrl K');await page.close();
 const tutor=await context.newPage();await tutor.addInitScript(()=>localStorage.setItem('pipit.tutor.v3',JSON.stringify({started:true,learn:{completed:['move','navigate','search','preview','pin'],skipped:[]}})));
 await tutor.goto(`${base}?tutor=1`);await tutor.waitForTimeout(2500);await tutor.locator('[data-tutor=start]').click();await tutor.waitForFunction(()=>document.querySelector('#tutor-panel')?.dataset.preparing==='false' && !document.querySelector('#portal').hidden && document.querySelector('#portal').getAttribute('aria-busy')==='false');
 await tutor.keyboard.press('Enter');await tutor.keyboard.press('g');await tutor.keyboard.press('h');await tutor.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('trail'));
 console.log('PASS Vimium resumed lesson 6 and home-row return');
}finally{await context.close()}
