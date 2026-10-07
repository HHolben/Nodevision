// Nodevision/scripts/render-distance-browser.mjs
// This browser fixture exercises the real pause slider, keyboard pause handling, live runtime updates and listener cleanup.
import { installWorldPause } from '/PanelInstances/ViewPanels/GameViewDependencies/worldPause.mjs';
const ok=(value,message)=>{if(!value)throw Error(message);};
try {
  const panel=document.getElementById('editor'),canvas=document.createElement('canvas');panel.append(canvas);
  const runtime={renderDistance:32,setRenderDistance(value){this.renderDistance=value;}};
  const pause=installWorldPause({panel,canvas,controls:{isLocked:false,unlock(){}},movementState:{},objects:[{userData:{proceduralVoxelRuntime:runtime}}],isActive:()=>true});
  pause.state.pause();
  const input=panel.querySelector('input[type="range"]');
  ok(input.value==='32'&&!input.disabled,'current distance appears');
  input.value='16';input.dispatchEvent(new Event('input',{bubbles:true}));
  ok(runtime.renderDistance===16,'input updates runtime');
  ok(panel.querySelector('output').textContent==='16 m','distance is labelled');
  input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  ok(!pause.state.paused,'Escape resumes with slider focus');
  pause.dispose();input.value='64';input.dispatchEvent(new Event('input'));
  ok(runtime.renderDistance===16&&!panel.querySelector('.nv-world-pause-menu'),'teardown removes control and listener');
  const empty=installWorldPause({panel,canvas,controls:{isLocked:false,unlock(){}},movementState:{},objects:[],isActive:()=>true});
  ok(panel.querySelector('input').disabled,'non-streamed worlds disable the control');empty.dispose();
  document.getElementById('result').textContent='PASS: pause render distance, live input, Escape, non-streamed worlds and cleanup';
} catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
