import { startSolderJointAreaAnalysis } from '/Sessions/SolderJointAreaSession.mjs';
import { saveAnalysisFile } from '/SolderAnalysis/Files.mjs';
import { parseAnalysis } from '/SolderAnalysis/Document.mjs';
let checks = 0;
const check = (value, message) => { if (!value) throw Error(message); checks++; };
const wait = async fn => { const start = performance.now(); while (!fn()) { if (performance.now() - start > 10000) throw Error('Timed out'); await new Promise(r => setTimeout(r, 20)); } };
try {
  const saved = [], root = document.getElementById('nv-session-root');
  const session = await startSolderJointAreaAnalysis({ root, noPrompt: true, skipConfirm: true, save: async (state, content, report) => { saved.push({state,content,report});return 'sample'; } });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgb(100,100,100)'; ctx.fillRect(0,0,100,80);
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',1));
  const original = await blob.arrayBuffer();
  const f = new File([blob], 'sample.jpeg', {type:'image/jpeg'});
  check(root.dataset.escapeDisabled==='true','Session framework Escape interception disabled');
  const transfer=new DataTransfer(); transfer.items.add(f); const fileInput=session.surface.querySelector('[aria-label="Open JPEG"]'); fileInput.files=transfer.files; fileInput.dispatchEvent(new Event('change')); await wait(() => session.result); check(session.snapshot().width === 100,'JPEG dimensions');
  const button = text => [...session.surface.querySelectorAll('button')].find(b => b.textContent === text);
  check(button('Freehand Trace').getAttribute('aria-pressed')==='true','Freehand default mode');
  button('100%').click();
  const svg = session.surface.querySelector('main svg');
  function event(type,x,y,target=svg) { const p = new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());target.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:p.x,clientY:p.y,pointerId:1,button:0,buttons:type==='pointerup'?0:1})); }
  function polygon(points) { button('Polygon / Vertex').click(); for(const [x,y] of points) {event('pointerdown',x,y);event('pointerup',x,y);} session.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
  polygon([[0,0],[40,0],[40,40],[0,40]]);
  polygon([[50,0],[90,0],[90,20],[50,20]]);
  button('Void Area').click(); polygon([[0,0],[20,0],[20,20],[0,20]]); polygon([[10,0],[30,0],[30,20],[10,20]]);
  polygon([[50,0],[60,0],[60,20],[50,20]]);
  await wait(() => session.result?.regions.length===5);
  check(session.result.warnings.length===0,'Valid children assigned');
  check(session.result.totalArea===2400 && session.result.voidArea===800,'Multiple regions and void union');
  check(Math.abs(session.result.overallPercentage-100/3)<1e-9,'Area weighted percentage');
  check(session.result.regions[2].label==='A-1' && session.result.regions[4].label==='B-1','Parent labels');
  check(session.result.regions.every(r=>r.rgba[3]===255),'JPEG alpha');
  const measure = JSON.stringify(session.result);
  button('+').click();button('Fit').click();session.surface.querySelector('main').scrollLeft=15;
  check(JSON.stringify(session.result)===measure,'Zoom and pan leave native measurement unchanged');
  button('Save analysis').click();await wait(()=>saved.length===1);
  button('Generate HTML Report').click();await wait(()=>saved.length===2);
  const doc=new DOMParser().parseFromString(saved[1].content,'text/html');
  check(doc.querySelectorAll('section').length===4,'Four report sections');
  check(doc.querySelector('#original img').src===session.snapshot().source.dataUrl,'Exact JPEG embedded');
  check(!doc.querySelector('#void-only text') && doc.querySelectorAll('#void-only path').length===3,'Fourth section only unlabeled voids');
  check([...doc.querySelectorAll('#void-only path')].every(p=>p.getAttribute('stroke')==='#80DFFF'),'Fourth section no red');
  const before=session.snapshot(); await session.loadState(parseAnalysis(saved[0].content));await wait(()=>session.result?.regions.length===5);
  check(JSON.stringify(session.snapshot().regions)===JSON.stringify(before.regions),'Reopen retains IDs, parents and geometry');
  check(session.result.voidArea===800,'Reopen measurements');
  button('Edit Perimeter').click(); const select=session.surface.querySelector('[aria-label="Selected region"]');select.value=before.regions[0].id;select.dispatchEvent(new Event('change'));
  // Synthetic capture is not supported; the editor still receives the gesture on its SVG root.
  const handle=svg.querySelector('[data-vertex="1"][data-handle="anchor"]');event('pointerdown',40,0,handle);event('pointermove',42,0);event('pointerup',42,0);
  await wait(()=>session.result && session.result.regions[0].area!==1600);
  check(session.result.regions[0].area===1640,'Vertex edit remeasures completed region');
  button('Undo').click();await wait(()=>session.result?.regions[0].area===1600);check(true,'Undo edit');
  button('Redo').click();await wait(()=>session.result?.regions[0].area===1640);check(true,'Redo edit');
  button('Undo').click();await wait(()=>session.result?.regions[0].area===1600);
  button('100%').click();button('Total Area').click();button('Bezier').click();
  for(const [x,y] of [[0,50],[20,50],[20,70],[0,70]]) {event('pointerdown',x,y);event('pointerup',x,y);}
  session.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await wait(()=>session.result?.regions.length===6);check(session.result.regions.at(-1).area===400,'Shared Bezier controller closes paths: '+JSON.stringify(session.result.regions.at(-1))+' '+JSON.stringify(session.snapshot().regions.at(-1)));
  button('Freehand Trace').click(); event('pointerdown',30,50);event('pointermove',40,50);event('pointermove',40,60);event('pointermove',30,60);event('pointerup',30,50);
  await wait(()=>session.result?.regions.length===7);check(session.result.regions.at(-1).area===100,'Shared freehand controller closes paths');
  // Exercise the actual binding with pen identity, coalesced events and palm input.
  button('Undo').click(); await wait(()=>session.result?.regions.length===6);
  button('Redo').click(); await wait(()=>session.result?.regions.length===7);
  check(session.result.regions.at(-1).area===100,'Freehand undo/redo');
  button('Freehand Trace').click();
  function pen(type,x,y,id=42,pointerType='pen',samples=[]) {
    const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
    const e=new PointerEvent(type,{bubbles:true,clientX:p.x,clientY:p.y,pointerId:id,pointerType,button:0,buttons:type==='pointerup'?0:1,isPrimary:true});
    if(samples.length) Object.defineProperty(e,'getCoalescedEvents',{value:()=>samples.map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return {clientX:q.x,clientY:q.y};})});
    svg.dispatchEvent(e);
  }
  editorZoomTest();
  function editorZoomTest() { session.editor.setZoom(8); session.surface.querySelector('main').scrollLeft=40; session.surface.querySelector('main').scrollTop=25; }
  button('Redraw selected').click();
  pen('pointerdown',30,50); pen('pointerdown',80,70,43,'touch');
  pen('pointermove',30,60,42,'pen',[[40,50],[40,60]]);
  pen('pointercancel',80,70,43,'touch'); pen('pointerup',30,60);
  await wait(()=>session.result?.regions.length===7);
  check(session.result.regions.at(-1).area===100,'Coalesced pen redraw closes gap and ignores palm cancellation');
  check(session.result.regions.at(-1).rgba.every((v,i)=>Math.abs(v-[100,100,100,255][i])<2),'Freehand JPEG mean RGBA');
  const touchToggle=[...session.surface.querySelectorAll('header input')].find(e=>e.type==='checkbox'); touchToggle.checked=false;touchToggle.dispatchEvent(new Event('change'));
  pen('pointerdown',70,50,50,'touch');pen('pointermove',80,50,50,'touch');pen('pointermove',80,60,50,'touch');pen('pointerup',70,60,50,'touch');
  check(session.snapshot().regions.length===7 && !session.editor.hasDraft,'Touch disabled prevents palm marks outside pen strokes');
  touchToggle.checked=true;touchToggle.dispatchEvent(new Event('change'));
  const traced=session.snapshot();
  check(traced.regions.at(-1).model.closed,'Freehand model closed');
  check(traced.regions.at(-1).model.nodes.length===4,'All fast coalesced corners retained');
  button('Save analysis').click();await wait(()=>saved.length===3);
  button('Generate HTML Report').click();await wait(()=>saved.length===4);
  const tracedReport=new DOMParser().parseFromString(saved[3].content,'text/html');
  check(tracedReport.querySelectorAll('section').length===4 && tracedReport.querySelector('#original img').src===traced.source.dataUrl,'Freehand report retains original and four sections');
  await session.loadState(parseAnalysis(saved[2].content));await wait(()=>session.result?.regions.length===7);
  check(JSON.stringify(session.snapshot().regions)===JSON.stringify(traced.regions),'Freehand save/reopen geometry');
  const picker=session.surface.querySelector('[aria-label="Selected region"]');picker.value=traced.regions.at(-1).id;picker.dispatchEvent(new Event('change'));
  const tracedHandle=svg.querySelector('[data-vertex="1"][data-handle="anchor"]');event('pointerdown',40,50,tracedHandle);event('pointermove',42,50);event('pointerup',42,50);
  await wait(()=>session.result && session.result.regions.at(-1).area!==100);check(Math.abs(session.snapshot().regions.at(-1).model.nodes[1].x-42)<1e-9,'Traced perimeter point editing');
  button('Undo').click();await wait(()=>session.result?.regions.at(-1).area===100);
  button('Polygon / Vertex').click();event('pointerdown',60,60);session.surface.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(session.snapshot().regions.length===7,'Escape cancels draft');
  check(new Uint8Array(await f.arrayBuffer()).every((v,i)=>v===new Uint8Array(original)[i]),'Source JPEG unchanged');
  const prior=session.snapshot();
  try { await session.loadState({...prior,width:999}); throw Error('Accepted wrong dimensions'); } catch(e) { check(e.message.includes('dimensions'),'Mismatched saved image dimensions rejected'); }
  check(session.snapshot().width===100 && session.snapshot().regions.length===7,'Failed reopen preserves current analysis');
  button('100%').click();button('+').click();button('+').click();
  polygon([[60,50],[70,50],[70,60],[60,60]]);await wait(()=>session.result?.regions.length===8);
  check(session.result.regions.at(-1).area===100,'Drawing under zoom maps to original pixels');
  const locked=session.surface.querySelector('[aria-label="Total Area Locked"]');locked.checked=true;locked.dispatchEvent(new Event('change'));
  polygon([[75,50],[85,50],[85,60],[75,60]]);check(session.snapshot().regions.length===8,'Locked layer prevents drawing');
  locked.checked=false;locked.dispatchEvent(new Event('change'));
  let written='', suggested='';const nativePicker=window.showSaveFilePicker;
  window.showSaveFilePicker=async options=>{suggested=options.suggestedName;return {name:suggested,createWritable:async()=>({write:async text=>{written=text;},close:async()=>{}})};};
  await saveAnalysisFile(session.snapshot(),saved[1].content,true);
  check(suggested==='sample.html' && written===saved[1].content,'Native Save As receives exact report and filename');
  window.showSaveFilePicker=async()=>({name:'sample.jpeg'});
  try { await saveAnalysisFile(session.snapshot(),'bad',true);throw Error('Source overwrite accepted'); } catch(e) {check(e.message.includes('cannot be overwritten'),'Source JPEG overwrite refused');}
  window.showSaveFilePicker=nativePicker;
  button('Dock / undock analysis panel').click();
  await wait(()=>document.querySelector('[data-instance-name="SolderAnalysisPanel"] .nv-solder-controls'));
  check(true,'Live controls use standard dockable information panel');
  document.querySelector('[data-instance-name="SolderAnalysisPanel"] .panel-close-btn').click();
  await wait(()=>session.surface.querySelector('.nv-solder-controls'));
  check(true,'Closing floating panel returns controls to the session');
  session.dispose();check(!root.querySelector('.nv-solder-session'),'Session cleanup');
  document.getElementById('result').textContent=`PASS: ${checks} solder analysis browser checks`;
} catch(error) {document.getElementById('result').textContent='FAIL: '+error.stack;}
