import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const context=await chromium.launchPersistentContext(resolve(`output/playwright/keyboard-extension-${Date.now()}`),{executablePath:process.env.PIPIT_CHROME_BINARY || chromium.executablePath(),headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000}});
try {
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 let installed=false;
 for(let attempt=0;attempt<100;attempt++){if(await worker.evaluate(async()=> (await chrome.declarativeNetRequest.getDynamicRules()).length===3)){installed=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.equal(installed,true,'PDF response rules are installed before the first navigation');
 const page=await context.newPage();
 console.log(await eval(`(${readFileSync('scripts/verification/extension.js','utf8')})`)(page));
 await page.goto('http://127.0.0.1:4180/paper');await page.waitForURL('chrome-extension://**');
 await page.locator('#viewer-container').focus();await page.keyboard.press(':');await page.keyboard.type('Tutor');await page.keyboard.press('Enter');await page.locator('#tutor-start').click();await page.locator('#tutor-panel').waitFor();
 await page.keyboard.press('j');await page.keyboard.press('k');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('move'));
 await page.keyboard.press('Control+Enter');await page.keyboard.press('p');await page.keyboard.type('2');await page.keyboard.press('Enter');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).xp===35);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('keyboard-only')),true);
 await page.keyboard.press('Control+Shift+F12');assert.equal(await page.evaluate(()=>document.body.classList.contains('keyboard-only')),false);
 await page.screenshot({path:'output/playwright/keyboard-tutor/chromium-extension.png'});
 console.log('PASS Chromium extension: lesson shortcuts and outcomes, hard mode, emergency recovery and prior PDF opening regressions.');
} finally {await context.close();}
