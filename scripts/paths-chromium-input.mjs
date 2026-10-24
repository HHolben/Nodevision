// Nodevision/scripts/paths-chromium-input.mjs
// Adapts Chromium's trusted input API to the shared native Path regression checks.
import nativeChecks from './paths-native-input.cjs';
export async function runPathNativeChecks(send,sessionId) {
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.bringToFront',{},sessionId);
  let queue=Promise.resolve(),buttons=0;
  const win={focus(){},webContents:{
    async executeJavaScript(expression){
      await queue;
      const value=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
      if(value.exceptionDetails)throw Error(value.exceptionDetails.exception?.description||JSON.stringify(value.exceptionDetails));
      return value.result?.value;
    },
    sendInputEvent(event){
      queue=queue.then(()=>{
        if(event.type.startsWith('key'))return send('Input.dispatchKeyEvent',{type:event.type,key:event.keyCode==='Return'?'Enter':event.keyCode,windowsVirtualKeyCode:event.keyCode==='Return'?13:0},sessionId);
        const button=event.button||'none';
        if(event.type==='mouseDown')buttons=button==='right'?2:1;
        if(event.type==='mouseUp')buttons=0;
        return send('Input.dispatchMouseEvent',{type:{mouseMove:'mouseMoved',mouseDown:'mousePressed',mouseUp:'mouseReleased'}[event.type],x:event.x,y:event.y,button,buttons,clickCount:event.clickCount||0},sessionId);
      });
    }
  }};
  await nativeChecks(win);await queue;
}
