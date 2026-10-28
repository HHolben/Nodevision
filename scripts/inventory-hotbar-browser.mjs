// Nodevision/scripts/inventory-hotbar-browser.mjs
// This regression verifies clickable inventory/HUD slots, single-click assignment, native browser dragging, shared state, and separation from world mouse input.
import {createPlayerInventory} from '/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs';
import {createInputHandlers} from '/PanelInstances/ViewPanels/GameViewDependencies/inputHandlers.mjs';
let checks=0;
const ok=(value,label)=>{checks++;if(!value)throw Error(label);};
try {
  window.NodevisionState={currentMode:'Virtual World Editing'};
  const panel=document.getElementById('editor');panel.style.cssText='position:relative;width:1000px;height:760px';
  const inventory=createPlayerInventory({panel});window.VRWorldContext={panel,inventory,movementState:{playerMode:'creative'}};
  const input=createInputHandlers({getBindings:()=>({}),normalizeKeyName:key=>key.toLowerCase(),movementState:window.VRWorldContext.movementState,acceptsInput:()=>true});
  inventory.setMenuOpen(true);
  const row=location=>document.querySelector(`[data-inventory-hotbar="${location}"]`);
  const slot=(location,index)=>row(location).querySelector(`[data-hotbar-slot-index="${index}"]`);
  const item=id=>document.querySelector(`[data-inventory-item-id="${id}"]`);
  const consistent=(index,id)=>{
    ok(inventory.dominantSlots[index]===id,'assigned slot '+index+' expected '+id+' got '+inventory.dominantSlots[index]);
    for(const location of ['inventory','hud']){
      ok(slot(location,index).getAttribute('aria-pressed')==='true',location+' selected highlight');
      ok(slot(location,index).getAttribute('aria-label').includes(inventory.items.find(i=>i.id===id)?.label || 'Empty'),location+' updated item');
    }
  };
  ok(row('inventory').children.length===9 && row('hud').children.length===9,'nine slots on both surfaces');
  ok(row('inventory').nextElementSibling.matches('[data-inventory-categories]'),'categories immediately below hotbar');
  ok([...document.querySelector('[data-inventory-categories]').children].map(b=>b.textContent).join('|')==='Tools|Passive Modifiers|Instruments|Resources|Building Blocks','category order preserved');
  slot('inventory',0).click();item('procedural-voxel-world').click();consistent(0,'procedural-voxel-world');
  slot('hud',3).click();item('tape-measure').click();consistent(3,'tape-measure');
  inventory.setActiveCategory('building-blocks');item('box').click();consistent(3,'box');
  ok(inventory.items.find(i=>i.id==='box').count===10,'assignment does not consume items');
  function drag(id,location,index) {
    const transfer=new DataTransfer();item(id).dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    const over=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer});slot(location,index).dispatchEvent(over);
    ok(over.defaultPrevented,'drop target accepts inventory drag');
    slot(location,index).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  }
  drag('sphere','inventory',5);consistent(5,'sphere');drag('cylinder','hud',8);consistent(8,'cylinder');
  const before=JSON.stringify(inventory.dominantSlots),foreign=new DataTransfer();foreign.setData('application/x-nodevision-inventory-item',JSON.stringify({owner:'other-inventory',id:'box'}));
  slot('hud',2).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:foreign}));
  ok(JSON.stringify(inventory.dominantSlots)===before,'foreign drags cannot change assignments');
  inventory.setActiveCategory('tools');slot('inventory',0).click();item('').click();consistent(0,null);
  slot('inventory',0).click();item('procedural-voxel-world').click();
  inventory.equipItemToActiveHand(null);ok(inventory.getSelectedItem()===null && inventory.dominantSlots[0]==='procedural-voxel-world','tool cancellation keeps slot 1 assignment');
  inventory.selectDominantSlot(0);ok(inventory.getSelectedItem()?.id==='procedural-voxel-world','keyboard slot selection can reactivate slot 1');
  inventory.setActiveCategory('instruments');item('coordinates-hud').click();ok(panel.textContent.includes('Coordinates HUD'),'instrument click retains toggle behavior');
  ok(!item('coordinates-hud').draggable,'non-equippable instruments are not draggable');
  inventory.setActiveCategory('tools');
  slot('hud',0).dispatchEvent(new PointerEvent('pointermove',{bubbles:true,buttons:1}));
  ok(input.heldKeys.mouse0===false,'HUD movement does not trigger world mouse actions');
  const clickSlot=slot('hud',2);clickSlot.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
  ok(!input.heldKeys.mouse0,'HUD press does not trigger world use');
  if(window.nativeTestInput){
    let sequence=0;const pending=new Map();window.nativeInputDone=id=>{pending.get(id)();pending.delete(id);};
    const send=(method,params)=>new Promise(resolve=>{pending.set(++sequence,resolve);window.nativeTestInput(JSON.stringify({id:sequence,method,params}));});
    await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
    const position=element=>{const r=element.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
    const click=async element=>{const p=position(element);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p});};
    await click(slot('inventory',2));await click(item('procedural-voxel-world'));consistent(2,'procedural-voxel-world');
    await click(slot('hud',6));await click(item('tape-measure'));consistent(6,'tape-measure');
    const nativeDrag=async(id,location,index)=>{
      const trace=[];const log=e=>trace.push([e.type,e.target.closest?.('[data-inventory-item-id]')?.dataset.inventoryItemId,e.target.closest?.('[data-hotbar-slot-index]')?.dataset.hotbarSlotIndex]);
      for(const type of ['dragstart','dragenter','dragover','drop','dragend'])document.addEventListener(type,log,true);
      const start=position(item(id)),end=position(slot(location,index));
      ok(slot(location,index).contains(document.elementFromPoint(end.x,end.y)), 'native target visible '+location+' '+JSON.stringify(end)+' '+document.elementFromPoint(end.x,end.y)?.outerHTML.slice(0,180));
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...start});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...start});
      for(let i=1;i<=12;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12});
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...end});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...end});
      for(const type of ['dragstart','dragenter','dragover','drop','dragend'])document.removeEventListener(type,log,true);
      ok(inventory.dominantSlots[index]===id,'native drag '+id+' '+JSON.stringify(trace));
      consistent(index,id);
    };
    await nativeDrag('voxel-placer','inventory',7);
    await nativeDrag('procedural-voxel-world','hud',1);
    ok(!input.heldKeys.mouse0,'native UI interaction leaves no world mouse button held');
  }
  inventory.setMenuOpen(false);slot('hud',8).click();ok(inventory.getSelectedItem()?.id==='cylinder','HUD works with inventory closed');
  inventory.setMenuOpen(true);consistent(8,'cylinder');
  const {RESOURCE_MIME,makeResourcePayload}=await import('/ResourceDrop/ResourceTransfer.mjs');
  const originalFetch=window.fetch;let releaseHead=null;window.fetch=async(url,options)=>options?.method==='HEAD'?(String(url).includes('wait')?new Promise(resolve=>{releaseHead=()=>resolve(new Response(null));}):new Response(null,{status:String(url).includes('missing')?404:200})):originalFetch(url,options);
  let viewportDrops=0;panel.addEventListener('drop',()=>viewportDrops++);
  const dropModel=(path,target)=>{const dataTransfer=new DataTransfer();dataTransfer.setData(RESOURCE_MIME,JSON.stringify(makeResourcePayload({path})));const root=target.closest('[data-player-hotbar]')||target.closest('[data-inventory-hotbar]')?.parentElement||target;const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Model drop timed out'));},10000);function cleanup(){clearTimeout(timer);root.removeEventListener('nodevision-resource-inserted',done);root.removeEventListener('nodevision-resource-drop-error',failed);}function done(e){cleanup();resolve({ok:true,...e.detail});}function failed(e){cleanup();resolve({ok:false,...e.detail});}root.addEventListener('nodevision-resource-inserted',done);root.addEventListener('nodevision-resource-drop-error',failed);});target.dispatchEvent(new DragEvent('dragover',{dataTransfer,bubbles:true,cancelable:true}));target.dispatchEvent(new DragEvent('drop',{dataTransfer,bubbles:true,cancelable:true}));return result;};
  ok((await dropModel('Models/house.glb',slot('hud',4))).ok,'Notebook GLB drops onto HUD');consistent(4,'model:Models/house.glb');
  ok((await dropModel('Models/tree.gltf',slot('inventory',6))).ok,'Notebook glTF drops onto inventory hotbar');consistent(6,'model:Models/tree.gltf');
  const beforeInventoryDrop=JSON.stringify(inventory.dominantSlots),inventoryHost=row('inventory').parentElement;
  ok((await dropModel('Models/statue.gox',inventoryHost)).ok,'Notebook GOX drops into inventory');ok(inventory.items.some(i=>i.modelFile==='Models/statue.gox')&&JSON.stringify(inventory.dominantSlots)===beforeInventoryDrop,'inventory drop does not overwrite or fill hotbar slots');
  const modelItem=inventory.items.find(i=>i.modelFile==='Models/statue.gox');modelItem.modelPlacement.scale=[2,2,2];drag(modelItem.id,'hud',7);consistent(7,modelItem.id);
  ok((await dropModel('Models/statue.gox',slot('hud',7))).ok&&modelItem.modelPlacement.scale[0]===2&&inventory.items.filter(i=>i.id===modelItem.id).length===1,'repeat drops reuse item and preserve placement settings');
  const preserved=JSON.stringify(inventory.dominantSlots),count=inventory.items.length;
  ok(!(await dropModel('Models/missing.glb',slot('hud',4))).ok,'missing source is rejected');ok(!(await dropModel('Models/note.txt',slot('hud',4))).ok,'unsupported file is rejected');
  window.VRWorldContext.movementState.playerMode='survival';ok(!(await dropModel('Models/locked.glb',slot('hud',4))).ok,'Play mode rejects model inventory drops');window.VRWorldContext.movementState.playerMode='creative';
  const pending=dropModel('Models/wait.glb',slot('hud',4));while(!releaseHead)await new Promise(r=>setTimeout(r,0));const previousWorld=window.VRWorldContext;window.VRWorldContext={...previousWorld};releaseHead();ok(!(await pending).ok,'world changes invalidate pending drops');window.VRWorldContext=previousWorld;
  ok(JSON.stringify(inventory.dominantSlots)===preserved&&inventory.items.length===count,'failed drops leave assignments and inventory unchanged');ok(viewportDrops===0,'inventory drops do not bubble into world placement');const {dropResourceAtPoint}=await import('/ResourceDrop/ResourceDropTarget.mjs');const targetRect=slot('inventory',0).getBoundingClientRect();ok(await dropResourceAtPoint(makeResourcePayload({path:'Models/graph.glb',sourcePanel:'graph-manager'}),{clientX:targetRect.left+targetRect.width/2,clientY:targetRect.top+targetRect.height/2}),'Graph Manager pointer drop finds the inventory hotbar target');ok(inventory.dominantSlots[0]==='model:Models/graph.glb','pointer drop assigns the targeted slot');window.fetch=originalFetch;
  input.dispose();inventory.dispose();ok(!document.querySelector('[data-inventory-hotbar]'),'inventory cleanup removes both slot surfaces');
  document.getElementById('result').textContent=`PASS: ${checks} inventory hotbar layout, click, drag/drop and input isolation checks`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
