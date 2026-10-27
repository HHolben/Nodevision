// Nodevision/scripts/gox-numeric-extrude-browser.mjs
// Exercises numeric keyboard extrusion through the real controller, toolbar, history and persistence.
export async function numericExtrusionChecks(files,ok){
 const {newModel,setVoxel,getVoxel,voxels}=await import('/Voxels/VoxelModel.mjs'),{encodeGox,decodeGox}=await import('/Voxels/GoxCodec.mjs'),{renderGox}=await import('/Voxels/GoxPanel.mjs');
 const {showToolbarSubToolbar}=await import('/panels/createToolbar.mjs');
 const model=newModel();setVoxel(model.layers[0],[0,0,0],[12,34,56,127]);files.set('/Notebook/numeric.gox',await encodeGox(model));
 const cell=document.createElement('div');cell.className='panel-cell';cell.style.cssText='width:800px;height:600px';document.body.append(cell);window.activeCell=cell;
 try{
  await renderGox('numeric.gox',cell,true);const api=cell.querySelector('[data-nv-gox]').__nvGoxApi,canvas=api.viewport.renderer.domElement;
  await api.run('mode',{name:'selection'});await api.run('select',{kind:'all'});
  const key=(value,target=canvas,extra={})=>target.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}));
  const type=value=>{for(const c of value)key(c);};
  const move=(x,y)=>canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,bubbles:true,pointerId:1}));
  const start=axis=>{key('e');if(axis)key(axis);};
  for(const axis of ['x','y','z'])for(const distance of [12,-12]){
   const history=api.doc.undoStack.length;start(axis);type(String(distance));
   ok(api.extrusion.plan.steps===distance&&api.doc.undoStack.length===history&&!api.doc.dirty,axis+' signed multidigit preview is transient');
   const p=[0,0,0];p['xyz'.indexOf(axis)]=distance;key('Enter');
   ok(getVoxel(api.doc.active,p).join(',')==='12,34,56,127'&&api.doc.selection.has(p.join(',')),axis+' numeric endpoint and RGBA');
   ok(api.doc.undoStack.length===history+1,axis+' numeric commit has one history entry');
   await api.run('undo');ok([...voxels(api.doc.active)].length===1&&api.doc.selection.has('0,0,0'),axis+' numeric undo');
   await api.run('redo');ok(getVoxel(api.doc.active,p)[3]===127,axis+' numeric redo');await api.run('undo');
  }
  start('x');type('12');key('Backspace');ok(api.extrusion.plan.steps===1&&api.extrusion.numeric==='1','Backspace corrects twelve to one');key('y');ok(api.extrusion.plan.steps===1&&api.extrusion.axis==='y','axis changes preserve numeric value');key('Escape');
  start('x');type('-3');key('z');ok(api.extrusion.plan.steps===-3&&api.extrusion.axis==='z','axis changes preserve negative sign');key('Escape');
  const rect=canvas.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  move(x,y);start('x');move(x+100,y);ok(api.extrusion.plan.steps!==0,'mouse starts displacement');type('2');move(x+200,y-100);ok(api.extrusion.plan.steps===2,'numeric overrides later pointer movement');key('Backspace');move(x+120,y);ok(api.extrusion.numeric===''&&api.extrusion.plan.steps!==2,'clearing numeric resumes mouse control');key('Escape');
  const history=api.doc.undoStack.length;start('x');type('12');key('Escape');ok(!api.extrusion.active&&api.doc.undoStack.length===history&&!api.doc.dirty,'numeric cancellation changes no history or dirty state');
  start('x');type('0');key('Enter');ok(api.doc.undoStack.length===history&&!api.doc.dirty,'numeric zero is no-op');
  start('x');type('1.5');key('Enter');ok(api.extrusion.active&&api.extrusion.plan.added.size===0&&api.doc.undoStack.length===history,'fractional input blocks commit and removes stale preview');key('Backspace');key('Backspace');ok(api.extrusion.plan.steps===1,'fractional input can be corrected');key('Escape');
  start('x');type('4097');key('Enter');ok(api.extrusion.active&&api.extrusion.plan.added.size===0&&api.doc.undoStack.length===history,'excessive distance rejected before preview allocation');type('9999999999999999');ok(api.status.textContent.includes('too large'),'unsafe integer rejected');key('Escape');
  move(x,y);start();type('8');key('Enter');ok(api.extrusion.active&&api.extrusion.axis===null,'numeric auto requires a determinable axis');move(x+80,y);ok(api.extrusion.axis&&api.extrusion.plan.steps===8,'pointer infers auto axis without replacing typed distance');const inferred=api.extrusion.axis;key('Backspace');ok(api.extrusion.axis===inferred,'clearing numeric retains locked inferred axis');type('8');key('Enter');ok(api.doc.undoStack.length===history+1,'inferred numeric value commits');await api.run('undo');
  start('x');type('2');const field=document.createElement('input');api.element.append(field);key('9',field);key('Backspace',field);key('Escape',field);key('9',canvas,{ctrlKey:true});ok(api.extrusion.numeric==='2'&&api.extrusion.active,'text input and modified global shortcuts isolated');field.remove();key('Escape');
  showToolbarSubToolbar('Extrude',{force:true,toggle:false});for(let n=0;n<100&&!document.querySelector('[data-gox-extrude-controls] button');n++)await new Promise(r=>setTimeout(r,20));
  const bar=document.querySelector('[data-gox-extrude-controls]');bar.querySelectorAll('button')[1].click();const distanceField=bar.querySelector('input');distanceField.value='3';distanceField.dispatchEvent(new Event('change'));move(x+200,y);ok(api.extrusion.plan.steps===3,'toolbar numeric distance also overrides mouse');key('Backspace');type('12');ok(document.activeElement===canvas&&api.extrusion.plan.steps===12,'toolbar start accepts canvas numeric keys');key('Enter');
  await api.save();const saved=await decodeGox(files.get('/Notebook/numeric.gox'));ok(getVoxel(saved.layers[0],[12,0,0]).join(',')==='12,34,56,127','numeric extrusion saves exact RGBA endpoint');
  const expected=JSON.stringify([...voxels(api.doc.active)]);cell._dispose();await renderGox('numeric.gox',cell,true);ok(JSON.stringify([...voxels(cell.querySelector('[data-nv-gox]').__nvGoxApi.doc.active)])===expected,'numeric extrusion reopens exactly');
 }finally{cell._dispose?.();cell.remove();}
}
