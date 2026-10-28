import {chromium} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const kind=process.argv[2]||'vimium-repro', ext=resolve('output/browser-tools',kind);
const context=await chromium.launchPersistentContext(resolve(`output/playwright/conflict-${kind}-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000}});
try {
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});console.log('extension',worker.url());
 await new Promise(r=>setTimeout(r,2500));const page=await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror',e=>console.log('pageerror',e.message));
 await page.goto(process.env.PIPIT_TUTOR_URL || 'http://127.0.0.1:5198/?tutor=1');await page.locator('#tutor-start').waitFor();await page.keyboard.press('Enter');
 if (kind === 'surfingkeys') {
   await page.locator('.tutor-conflict').waitFor();
   assert.equal(await page.evaluate(()=>document.body.classList.contains('keyboard-only')),false);
   console.log('PASS Surfingkeys conflict pauses safely and explains recovery');
   await page.keyboard.press('Alt+s'); await page.waitForTimeout(700); await page.keyboard.press('Enter');
 }
 await page.locator('#tutor-panel').waitFor();await page.waitForTimeout(2500);
 const key=k=>page.keyboard.press(k),type=t=>page.keyboard.type(t), done=async id=>{await page.waitForFunction(id=>JSON.parse(window.render_game_to_text()).completed.includes(id),id);console.log('PASS',id)}, next=()=>key('Enter');
 await key('Shift+H');assert.equal(await page.locator('.tutor-hint').isVisible(),false);await key('Shift+H');assert.equal(await page.locator('.tutor-hint').isVisible(),true);await key('F2');await key('Tab');await key('Tab');await key('Enter');assert.equal(await page.locator('.tutor-hint').isVisible(),false);await key('F2');await key('j');await key('k');await done('move');await key('Escape');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='paused'); console.log('PASS pause');await key('Enter');await next();
 await key('p');await type('2');await key('Enter');await done('navigate');await next();
 await key('/');await type('coherence');await done('search');await key('Escape');await page.waitForTimeout(300);await next();
 await key('e');await type('2');await page.locator('[role=option]').first().waitFor();await key('Enter');await done('preview');await next();
 await key('Shift+P');await done('pin');await next();await key('Enter');await key('g');await key('h');await done('trail');await next();
 await key('g');await key('d');await done('theme');await next();await key('b');await done('bookmark');await next();await key('Shift+Q');await key('Control+Enter');await type('A note about the paper.');await done('notes');await key('Escape');await page.waitForTimeout(300);await next();await key('r');await done('ruler');await next();await key('g');await key('2');await done('spread');
 console.log('PASS complete course with',kind);
} finally {await context.close()}
