// Real Chromium input exercises pointer capture and focus-owned shortcuts, beyond synthetic pointer fixtures.
export async function runMapNativeChecks(send,id){
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},id);if(result.exceptionDetails)throw Error(result.exceptionDetails.text+': '+result.exceptionDetails.exception?.description);return result.result.value;};
 const check=(v,m)=>{if(!v)throw Error(m);};
 const p=await evaluate(`(()=>{const a=window.__nvMapTest;a.activateTool('set');a.settings.radius=2;a.settings.target=11.375;a.canvas.addEventListener('pointerdown',e=>a.lastPointer=e.pointerId);const r=a.canvas.getBoundingClientRect();return {x:r.left+(20-a.view.x)*a.view.scale,y:r.top+(20-a.view.z)*a.view.scale,step:4*a.view.scale};})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1},id);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+p.step,y:p.y,button:'left',buttons:1},id);
 check(await evaluate('window.__nvMapTest.canvas.hasPointerCapture(window.__nvMapTest.lastPointer)'),'native mouse captured by canvas');
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+p.step,y:p.y,button:'left',buttons:0,clickCount:1},id);
 check(await evaluate('(async()=>{const a=window.__nvMapTest;await a.flush();return (await a.doc.inspect(22,20)).elevation===11.375;})()'),'native mouse stroke interpolates');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:2,windowsVirtualKeyCode:90},id);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'z',code:'KeyZ',modifiers:0,windowsVirtualKeyCode:90},id);
 check(await evaluate('(async()=>{const a=window.__nvMapTest;await a.flush();return (await a.doc.inspect(22,20)).elevation!==11.375;})()'),'native Ctrl+Z routes to map history');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.4},id);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},id);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},id);
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'},id);
 check(await evaluate('(async()=>{const a=window.__nvMapTest;await a.flush();return !a.doc.stroke&&(await a.doc.inspect(20,20)).elevation!==11.375;})()'),'native Escape cancels pen operation');
 const revision=await evaluate('window.__nvMapTest.doc.state.revision');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]},id);await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+20,y:p.y+10,id:1}]},id);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},id);
 check(await evaluate('window.__nvMapTest.doc.state.revision')===revision,'touch navigation does not paint');
 console.log('PASS: Native mouse pointer capture, interpolated stroke, Ctrl+Z, pen cancellation and touch navigation');
 await evaluate('document.getElementById("editor")._dispose()');
}
