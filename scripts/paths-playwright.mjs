// Nodevision/scripts/paths-playwright.mjs
// This optional Playwright/Electron validation drives native clicks and control-point drags, verifies changing rendered pixels, and captures desktop and narrow-view screenshots without adding production dependencies.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {_electron}=await import(process.env.NV_PLAYWRIGHT_MODULE || 'playwright');
const env={...process.env,NV_WORLD_BROWSER:'paths-browser.mjs',NV_PATH_INSPECT:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron'),args:['--no-sandbox',path.join(root,'scripts/procedural-world.electron.cjs')],env});
app.process().stdout.on('data',chunk=>{if(String(chunk).includes('FAIL:'))process.stderr.write(chunk);});
try {
  const page=await app.firstWindow();
  await page.waitForFunction(()=>document.getElementById('result')?.textContent!=='RUNNING',{},{timeout:60000});
  const result=await page.locator('#result').textContent();assert.ok(result.startsWith('PASS:'),result);
  const count=()=>page.evaluate(()=>pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length);
  const before=await count();await page.evaluate(()=>pathFixture.insertPath());
  const screen=async(x,z)=>page.evaluate(([x,z])=>pathFixture.screenPoint(pathFixture.point(x,z)),[x,z]);
  let p=await screen(5,20);await page.mouse.click(p.x,p.y);assert.equal(await count(),before);
  p=await screen(12,20);await page.mouse.move(p.x,p.y);
  assert.ok(await page.evaluate(()=>pathFixture.context.scene.children.some(o=>o.isLine&&o.geometry.attributes.position?.count>1)),'live preview');
  await page.mouse.click(p.x,p.y);p=await screen(24,20);await page.mouse.click(p.x,p.y);await page.keyboard.press('Enter');assert.equal(await count(),before+1);
  await page.evaluate(async()=>{await pathFixture.settle();pathFixture.insertPath();});p=await screen(5,26);await page.mouse.click(p.x,p.y);p=await screen(16,26);await page.mouse.dblclick(p.x,p.y);
  assert.equal(await count(),before+2);
  assert.equal(await page.evaluate(()=>pathFixture.context.objects.filter(o=>o.userData.pathRuntime).at(-1).userData.pathRuntime.serialize().controlPoints.length),2);
  const drag=await page.evaluate(async()=>{
    const f=pathFixture;await f.settle();const o=f.context.objects.find(o=>o.userData.pathRuntime);f.bridge.selectObject(o.userData.metaWorldLayerId);
    f.render();const d=o.userData.pathRuntime.serialize(),p=d.controlPoints[1].map((v,i)=>v+d.position[i]);
    return {id:d.id,old:d.controlPoints[1],from:f.screenPoint(p),to:f.screenPoint(f.point(p[0],p[2]+1))};
  });
  assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,drag.from),'CANVAS','floating inspector moved clear of the handle');
  await page.mouse.move(drag.from.x,drag.from.y);await page.mouse.down();await page.mouse.move(drag.to.x,drag.to.y,{steps:8});await page.mouse.up();
  const moved=await page.evaluate(id=>pathFixture.bridge.getPathDefinition(id).controlPoints[1],drag.id);assert.notDeepEqual(moved,drag.old,'native handle drag commits: '+await page.locator('[data-path-properties] output').textContent());
  await page.evaluate(()=>pathFixture.bridge.undo());assert.deepEqual(await page.evaluate(id=>pathFixture.bridge.getPathDefinition(id).controlPoints[1],drag.id),drag.old);
  for(const [w,h] of [[1000,780],[410,780]]) {
    await page.evaluate(()=>pathFixture.settle());
    assert.ok(await page.evaluate(()=>{const f=pathFixture,t=f.context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;return t.stats.queued===0&&f.context.objects.filter(o=>o.userData.pathRuntime).every(o=>{const r=o.userData.pathRuntime,p=r.ribbon.samples[Math.floor(r.ribbon.samples.length/2)];return t.generator.getTerrainHeight(Math.floor(p[0]*4),Math.floor(p[2]*4))*.25<=p[1]+1e-6;});}),'settled terrain stays below every roadbed after regeneration and undo');
    await app.evaluate(({BrowserWindow},{w,h})=>BrowserWindow.getAllWindows()[0].setContentSize(w,h),{w,h});
    await page.evaluate(({w,h})=>{pathFixture.context.objectInspector.hide();pathFixture.resize(w-16,h-100);},{w,h});
    await page.screenshot({path:`/tmp/nodevision-paths-${w}.png`});
    assert.ok(await page.evaluate(()=>pathFixture.renderer.info.render.triangles>1000),'terrain and road are rendered together');
    const first=await page.evaluate(()=>pathFixture.renderer.domElement.toDataURL());
    await page.evaluate(()=>{pathFixture.camera.position.x+=2;pathFixture.camera.lookAt(16,0,12);pathFixture.render();});
    assert.notEqual(await page.evaluate(()=>pathFixture.renderer.domElement.toDataURL()),first,'camera interaction changes rendered pixels');
    await page.evaluate(()=>{pathFixture.camera.position.x-=2;pathFixture.camera.lookAt(16,0,12);pathFixture.render();});
    await page.evaluate(()=>{const f=pathFixture;f.bridge.selectObject(f.context.objects.find(o=>o.userData.pathRuntime).userData.metaWorldLayerId);f.render();});
    await page.screenshot({path:`/tmp/nodevision-path-properties-${w}.png`});
    assert.ok(await page.evaluate(()=>{const s=document.querySelector('[data-path-properties]');return s.scrollWidth<=s.clientWidth+1;}),'path properties fit the inspector');
  }
  console.log('PASS: Playwright native multi-click creation, hover preview, double-click, point dragging, undo, desktop/narrow screenshots and moving canvas pixels');
}finally{await app.close();}
