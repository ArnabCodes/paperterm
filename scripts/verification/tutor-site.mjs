import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4181';
const browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(base);
for(const width of [1440,768,390]) {
  await page.setViewportSize({width,height:1000});await page.locator('.tutor-section').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`output/playwright/tutor/site-${width}.png`});
}
await page.goto(`${base}/docs/#tutor`);assert.match(await page.locator('#tutor').innerText(),/300 XP/);
await page.locator('#tutor a[href="/reader/?tutor=1"]').click();await page.locator('#tutor-start').click();await page.locator('#tutor-panel').waitFor();
assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'tutor');
assert.equal(await page.locator('#page-total').textContent(),'6');assert.deepEqual(errors,[]);
console.log('PASS Tutor website layout at 1440/768/390px, docs entry, live reader launch, bundled six-page PDF and no page errors.');
} finally {await browser.close();}
