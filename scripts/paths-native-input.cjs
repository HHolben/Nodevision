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
 assert.equal(await run('pathFixture.context.objects.filter(o=>o.userData.pathRuntime).length'),before+1,'native clicks and Enter commit a path');
 const drag=await run(`(async()=>{const f=pathFixture;await f.settle();const o=f.context.objects.find(o=>o.userData.pathRuntime);f.bridge.selectObject(o.userData.metaWorldLayerId);f.render();const d=o.userData.pathRuntime.serialize(),p=d.controlPoints[1].map((v,i)=>v+d.position[i]);return {id:d.id,old:d.controlPoints[1],from:f.screenPoint(p),to:f.screenPoint([p[0],p[1]-.025,p[2]+.4])};})()`);
 send('mouseMove',drag.from);send('mouseDown',drag.from,{button:'left',clickCount:1});await pause();
 for(let i=1;i<=8;i++){send('mouseMove',{x:drag.from.x+(drag.to.x-drag.from.x)*i/8,y:drag.from.y+(drag.to.y-drag.from.y)*i/8},{button:'left'});await pause();}
 send('mouseUp',drag.to,{button:'left',clickCount:1});await pause();
 assert.notDeepEqual(await run(`pathFixture.bridge.getPathDefinition(${JSON.stringify(drag.id)}).controlPoints[1]`),drag.old,'native drag edits control point: '+await run("document.querySelector('[data-path-properties] output')?.textContent"));
 await run('pathFixture.bridge.undo()');assert.deepEqual(await run(`pathFixture.bridge.getPathDefinition(${JSON.stringify(drag.id)}).controlPoints[1]`),drag.old,'drag undo restores coordinates');
 console.log('PASS: Native Path mouse drawing, Enter completion, control-point dragging and undo');
};
