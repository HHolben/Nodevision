// Nodevision/scripts/paths-native-input.cjs
// Exercises native mouse drawing and control-point dragging through the existing Electron world fixture.
const assert=require('node:assert/strict');
module.exports=async function(win){
 const run=code=>win.webContents.executeJavaScript(code),pause=()=>new Promise(r=>setTimeout(r,60));
 const send=(type,p,extra={})=>win.webContents.sendInputEvent({type,x:Math.round(p.x),y:Math.round(p.y),...extra});
 win.focus();await run('pathFixture.context.inventory=null;pathFixture.settle()');
 const before=await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length');await run('pathFixture.insertPath()');
 for(const [x,z] of [[5,20],[14,20],[24,20]]){const p=await run(`pathFixture.screenPoint(pathFixture.point(${x},${z}))`);send('mouseMove',p);send('mouseDown',p,{button:'left',clickCount:1});send('mouseUp',p,{button:'left',clickCount:1});await pause();}
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});await pause();
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),before+1,'native clicks and Enter commit a path: '+await run("[...document.querySelectorAll('output')].map(e=>e.textContent).join(' | ')"));
 const drag=await run(`(async()=>{const f=pathFixture;await f.settle();const o=f.context.objects.find(o=>o.userData.pathRuntime);f.bridge.selectObject(o.userData.metaWorldLayerId);f.render();const d=o.userData.pathRuntime.serialize(),p=d.controlPoints[1].map((v,i)=>v+d.position[i]);return {id:d.id,old:d.controlPoints[1],from:f.screenPoint(p),to:f.screenPoint([p[0],p[1]-.025,p[2]+.4])};})()`);
 send('mouseMove',drag.from);send('mouseDown',drag.from,{button:'left',clickCount:1});await pause();
 for(let i=1;i<=8;i++){send('mouseMove',{x:drag.from.x+(drag.to.x-drag.from.x)*i/8,y:drag.from.y+(drag.to.y-drag.from.y)*i/8},{button:'left'});await pause();}
 send('mouseUp',drag.to,{button:'left',clickCount:1});await pause();
 assert.notDeepEqual(await run(`pathFixture.bridge.getPathDefinition(${JSON.stringify(drag.id)}).controlPoints[1]`),drag.old,'native drag edits control point: '+await run("document.querySelector('[data-path-properties] output')?.textContent"));
 await run('pathFixture.bridge.undo()');assert.deepEqual(await run(`pathFixture.bridge.getPathDefinition(${JSON.stringify(drag.id)}).controlPoints[1]`),drag.old,'drag undo restores coordinates');
 // The held tool places a complete segment with two native right-clicks, without Enter.
 await run('pathFixture.context.cancelPathDrawing?.();pathFixture.insertPath()');
 const right=async p=>{send('mouseMove',p);send('mouseDown',p,{button:'right',clickCount:1});send('mouseUp',p,{button:'right',clickCount:1});await pause();};
 const count=await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length');
 await right(await run('pathFixture.screenPoint(pathFixture.point(5,4))'));
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),count,'first right-click only places start');
 await right(await run('pathFixture.screenPoint(pathFixture.point(14,4))'));
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),count+1,'second right-click commits without Enter');
 const junction=await run(`(()=>{const f=pathFixture,o=f.context.objects.filter(o=>o.userData.pathRuntime).at(-1),r=o.userData.pathRuntime.ribbon,p=r.samples[Math.floor(r.samples.length/2)];return {id:o.userData.metaWorldLayerId,point:p,screen:f.screenPoint([p[0],p[1]+.025,p[2]])};})()`);
 await right(await run('pathFixture.screenPoint(pathFixture.point(10,1))'));
 await right(junction.screen);
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),count+2,'clicking existing path conjoins a new branch');
 const end=await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).at(-1).userData.pathRuntime.ribbon.samples.at(-1)');
 assert.ok(Math.abs(end[2]-junction.point[2])<.05,'junction shares existing centerline');
 const height=await run(`pathFixture.context.objects.find(o=>o.userData.metaWorldLayerId===${JSON.stringify(junction.id)}).userData.pathRuntime.ribbon.heightAt(${end[0]},${end[2]})`);
 assert.ok(Math.abs(height-end[1])<.01,'junction shares existing surface height');
 await run('pathFixture.context.cancelPathDrawing?.();pathFixture.bridge.undo()');
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),count+1,'junction undo is one transaction');
 await run('pathFixture.bridge.redo()');assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),count+2,'junction redo restores segment');
 console.log('PASS: Native right-click start/end, path junctions and undo/redo');
 console.log('PASS: Native Path mouse drawing, Enter completion, control-point dragging and undo');
};
