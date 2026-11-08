// Nodevision/scripts/teleporter-chromium-input.mjs
// Supplies trusted primary mouse input requested by the production teleporter browser fixture without substituting its input handlers.
export async function runTeleporterInput(send,sessionId){
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result?.value;
 while(true){
  const request=await evaluate('window.teleporterInputRequest');
  if(request){
   await send('Input.dispatchMouseEvent',{type:'mousePressed',x:request.x,y:request.y,button:'left',buttons:1,clickCount:1},sessionId);
   await new Promise(r=>setTimeout(r,150));
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:request.x,y:request.y,button:'left',buttons:0,clickCount:1},sessionId);
   await evaluate('window.teleporterInputRequest=null');
  }
  if(await evaluate('/^(PASS:|FAIL:)/.test(document.querySelector("#result")?.textContent)'))return;
  await new Promise(r=>setTimeout(r,50));
 }
}
