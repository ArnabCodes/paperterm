import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const results = [], output = 'output/playwright/arcade'; mkdirSync(output,{recursive:true});
const url = process.argv[2] || 'http://127.0.0.1:4173/?tutor=1';
try {
  for (const [width,height,forwarded,coach] of [[1280,720,false,false],[1920,1080,false,true],[2560,1600,true,false],[1024,600,true,true]]) {
    const page = await browser.newPage({viewport:{width,height}}), errors=[];
    page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('pipit.vimium','true'));
    await page.goto(url);await page.locator('#tutor-start').waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tutor-start','Enter starts without navigating a radio group');
    if(width===1280)await page.screenshot({path:`${output}/intro.png`});
    if(width===1280)await page.keyboard.press('Control+Shift+F12'); // manual hard mode must also be released by Pause
    await page.keyboard.press('Enter');await page.locator('#tutor-panel').waitFor();
    if(coach)await page.keyboard.press('F2');
    const before=await page.locator('#viewer-container').evaluate(node=>node.scrollTop);
    const press = key => forwarded ? page.evaluate(key=>window.dispatchEvent(new KeyboardEvent('keydown',{key,code:`Key${key.toUpperCase()}`,bubbles:true,cancelable:true})),key) : page.keyboard.press(key);
    // No screenshot, artificial delay, or focus correction before the first key.
    await press('j');
    const after=await page.locator('#viewer-container').evaluate(node=>node.scrollTop);
    assert.ok(after>before,`J scrolls immediately at ${width}x${height}`);
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).flight),'down');
    await press('k');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completed.includes('move'));
    assert.ok(await page.locator('#viewer-container').evaluate(node=>node.scrollTop)<after);
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).xp),20);
    await page.screenshot({path:`${output}/movement-${width}.png`});
    if(width===1280){
      await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'paused');
      assert.equal(await page.evaluate(()=>document.body.classList.contains('keyboard-only')),false);
      await page.screenshot({path:`${output}/paused.png`});await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).xp),20);
      await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mission),'navigate');
    }
    assert.deepEqual(errors,[]);results.push({width,height,forwarded,coach,passed:true});await page.close();
  }
  writeFileSync(`${output}/regression.json`,JSON.stringify({url,results},null,2));
  console.log('PASS immediate J/K, real scrolling + game feedback, Enter start, Esc pause/resume, coach focus, forwarded window keys, Vimium preference, four viewport sizes.');
} finally { await browser.close(); }
