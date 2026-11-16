// Trusted keyboard and mouse events for the production input router, requested by the browser fixture.
import {mkdir,writeFile} from 'node:fs/promises';
export async function runArcheryInput(send,sessionId){
 await send('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false},sessionId);
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result?.value;
 while(true){const r=await evaluate('window.archeryInputRequest');if(r){
  if(r.capture){if(!/^archery-(voxel|polygonal|target|target-properties|hare)\.png$/.test(r.capture))throw Error('Invalid capture name');await mkdir('docs/ArcheryVisuals',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile('docs/ArcheryVisuals/'+r.capture,Buffer.from(shot.data,'base64'));}
  else if(r.mouse)await send('Input.dispatchMouseEvent',{type:r.down?'mousePressed':'mouseReleased',x:r.x,y:r.y,button:'left',buttons:r.down?1:0,clickCount:1},sessionId);
  else await send('Input.dispatchKeyEvent',{type:r.down?'keyDown':'keyUp',key:r.key,code:'Key'+r.key.toUpperCase(),windowsVirtualKeyCode:r.key.toUpperCase().charCodeAt(0),nativeVirtualKeyCode:r.key.toUpperCase().charCodeAt(0),autoRepeat:!!r.repeat},sessionId);
  await evaluate('window.archeryInputRequest=null');
 }if(await evaluate('/^(PASS:|FAIL:)/.test(document.querySelector("#result")?.textContent)'))return;await new Promise(r=>setTimeout(r,15));}
}
