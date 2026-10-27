// Nodevision/scripts/gox-toolbar-browser.mjs
// Verifies the real shared Block subtoolbar, editor-owned state, context activation and listener cleanup without mocking toolbar management.
export async function toolbarChecks(api,cell,ok,files){
 const {showToolbarSubToolbar,updateToolbarState}=await import('/panels/createToolbar.mjs');
 const {executeVoxelCommand}=await import('/Voxels/GoxCommands.mjs');
 const tick=()=>new Promise(r=>setTimeout(r,20));
 for(let i=0;i<100&&!document.querySelector('#sub-toolbar [data-gox-block-controls]');i++)await tick();
 const bar=()=>document.querySelector('#sub-toolbar [data-gox-block-controls]');
 ok(!!bar(),'opening GOX automatically mounts shared Block controls');ok(!cell.querySelector('[data-gox-block-controls],select'),'no internal GOX toolbar');
 const tool=()=>bar().querySelector('[aria-label="Voxel tool"]');
 for(const name of (await import('/Voxels/VoxelBuildPointer.mjs')).buildTools){
   tool().value=name;tool().dispatchEvent(new Event('change'));await tick();ok(api.tool===name,'shared tool '+name+' activates editor');
 }
 await executeVoxelCommand(['tool',{name:'paint'}]);ok(tool().value==='paint','terminal selection synchronizes toolbar');
 api.activateTool('erase');await tick();ok(tool().value==='erase','cursor registry selection synchronizes toolbar');
 await executeVoxelCommand(['color',{rgba:[12,34,56,127]}]);ok(bar().querySelector('[aria-label="Voxel color"]').value==='#0c2238'&&bar().querySelector('[aria-label="Voxel alpha"]').value==='127','command color synchronizes inputs');
 await executeVoxelCommand(['brush',{size:4,shape:'sphere',symmetry:['x']}]);ok(bar().querySelector('[aria-label="Brush size"]').value==='4'&&bar().querySelector('[aria-label="Mirror x"]').checked,'command brush synchronizes controls');
 await api.run('brush',{size:1,shape:'box',symmetry:[]});await api.run('color',{rgba:[220,140,60,255]});
 const mode=bar().querySelector('[aria-label="Voxel interaction mode"]');mode.value='selection';mode.dispatchEvent(new Event('change'));await tick();ok(api.interaction==='selection'&&tool().value==='select','selection mode remains distinct from tool');await api.run('mode',{name:'build'});
 const oldBar=bar();showToolbarSubToolbar('Insert',{force:true,toggle:false});await tick();ok(!bar(),'manual toolbar selection respected');
 api.element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await tick();ok(!bar(),'ordinary clicks do not force Block');
 await api.run('tool',{name:'pick'});ok(oldBar.querySelector('[aria-label="Voxel tool"]').value!=='pick','detached widget unsubscribed');
 for(const mode of ['HTMLediting','SVG Editing','GraphicalEditing']){
   const other=document.createElement('div');document.body.append(other);window.activeCell=other;updateToolbarState({currentMode:mode});window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell:other}}));await tick();ok(!bar()&&window.NodevisionState.currentMode===mode,'other editor owns toolbar '+mode);
   window.activeCell=cell;window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell}}));await tick();ok(!!bar()&&tool().value==='pick','GOX refocus restores Block and current tool');other.remove();
 }
 showToolbarSubToolbar('Insert',{force:true,toggle:false});cell.__nvOnPanelTabActivate();await tick();ok(!bar(),'repeated same-context tab hook preserves manual toolbar');
 window.activeCell=null;window.dispatchEvent(new CustomEvent('activePanelChanged'));window.activeCell=cell;cell.__nvOnPanelTabActivate();await tick();ok(!!bar(),'restored tab activates Block');
 for(let i=0;i<3;i++){showToolbarSubToolbar('Block',{force:true,toggle:false});await tick();}ok(document.querySelectorAll('[data-gox-block-controls]').length===1,'only one live controls instance');
 const action=bar().querySelector('[aria-label="Voxel action"]'),params=bar().querySelector('[aria-label="Action parameters (JSON)"]');action.value='add';params.value=JSON.stringify({at:[40,0,0],color:[1,2,3,255]});const history=api.doc.undoStack.length;action.form.dispatchEvent(new Event('submit',{cancelable:true}));await tick();ok(api.doc.undoStack.length===history+1,'shared command form contributes one undo entry');
 [...bar().querySelectorAll('button')].find(b=>b.textContent==='Undo').click();await tick();ok(api.doc.undoStack.length===history,'shared Undo uses existing history');await api.run('tool',{name:'add'});
 const {encodeGox}=await import('/Voxels/GoxCodec.mjs'),{newModel}=await import('/Voxels/VoxelModel.mjs'),{concat,utf8,integer}=await import('/Voxels/Binary.mjs');
 files.set('/Notebook/readonly.gox',concat([await encodeGox(newModel()),utf8('UNKN'),integer(3),new Uint8Array([1,2,3]),integer(0)]));
 const second=document.createElement('div');second.style.height='400px';cell.append(second);api.element.hidden=true;
 const {renderGox}=await import('/Voxels/GoxPanel.mjs');ok(await renderGox('readonly.gox',second,true),'unsupported GOX still opens');await tick();const readonly=second.querySelector('[data-nv-gox]').__nvGoxApi;
 ok(!readonly.editing&&readonly.interaction==='view','unsupported file remains read-only');ok(bar().querySelector('[aria-label="Voxel interaction mode"] option[value="build"]').disabled,'shared build control disabled for unsupported files');
 await executeVoxelCommand(['tool',{name:'pick'}]);ok(readonly.tool==='pick'&&api.tool==='add','terminal targets visible GOX tab instead of hidden sibling');
 let refused=false;try{await executeVoxelCommand(['mode',{name:'build'}]);}catch{refused=true;}ok(refused&&!readonly.editing,'terminal cannot bypass read-only mode');
 second.hidden=true;api.element.hidden=false;window.dispatchEvent(new CustomEvent('activePanelChanged',{detail:{cell}}));await tick();ok(tool().value==='add','return to first GOX restores its independent tool state');
 second._dispose();second.remove();await tick();ok(!!bar(),'disposing inactive GOX preserves active Block controls');
}

