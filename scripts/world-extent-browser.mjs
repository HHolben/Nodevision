// Nodevision/scripts/world-extent-browser.mjs
// Verifies the native extent control, signed streaming, construction cuts, history, editing and Viewer save/reopen through the actual GameView render loop.
import {setupPanel} from '/PanelInstances/ViewPanels/GameView.mjs';
import {createToolbar} from '/panels/createToolbar.mjs';
import {getActiveMetaWorldLayerBridge} from '/MetaWorld/MetaWorldLayerState.mjs';
import {openVoxelWorldDialog} from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs';
import {saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
const check=(v,m)=>{if(!v)throw Error(m);},wait=async(fn,label)=>{const end=performance.now()+90000;while(!fn()){if(performance.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,25));}};
try{
 const originalError=console.error;console.error=(...args)=>{console.log('NV_TEST_PROGRESS','console error',...args.map(v=>v?.stack||String(v)));originalError(...args);};
 window.NodevisionState={currentMode:'Virtual World Editing',virtualWorldMode:'creative'};window.confirm=()=>true;
 await createToolbar();const panel=document.getElementById('editor');Object.assign(panel.style,{width:'800px',height:'600px'});
 await setupPanel(panel,{filePath:'world.html'});check(await panel.worldReady,'Editor ready');
 const runtime=()=>window.VRWorldContext.objects.find(o=>o.userData.terrainRuntime).userData.terrainRuntime;
 let bridge=getActiveMetaWorldLayerBridge();await runtime().ready;await bridge.constructionsReady;
 openVoxelWorldDialog(bridge,'terrain');let form=document.querySelector('[data-voxel-world-dialog]'),extent=form.querySelector('[name=worldExtentMode]');
 check(!extent.disabled&&extent.options.length===2&&extent.value==='finite','procedural finite/infinite choice');extent.value='infinite';extent.dispatchEvent(new Event('change'));check(form.querySelector('[name=sizeX]').disabled,'infinite hides finite dimensions');await form.onsubmit({preventDefault(){}});
 check(runtime().definition.worldExtent.mode==='infinite','UI installs infinite runtime');await runtime().ready;
 bridge.undo();check(!runtime().definition.worldExtent,'undo restores legacy finite');bridge=getActiveMetaWorldLayerBridge();bridge.redo();bridge=getActiveMetaWorldLayerBridge();await runtime().ready;await bridge.constructionsReady;
 check(runtime().definition.worldExtent.mode==='infinite','redo restores infinite');
 const ctx=window.VRWorldContext;ctx.camera.position.set(-127,45,-127);ctx.camera.lookAt(-120,15,-120);
 await wait(()=>[...runtime().manager.loaded.values()].some(e=>e.cell[0]<-10&&e.mesh?.geometry.attributes.position.count),'negative streamed geometry');
 check(Number.isFinite(ctx.objects.find(o=>o.userData.terrainRuntime).userData.colliderRef.sampleGroundY(-127,-127)),'negative collision');
 check(runtime().generator.getVoxel(-512,1,-512)===0&&runtime().generator.getVoxel(-515,1,-515)!==0,'linked excavation applies outside original bounds');
 const api=bridge.sessionVoxels;api.sync();const at=api.cell([-127.875,40.125,-127.875]);check(api.contains(at),'infinite voxel authoring contains negative cells');api.edit('add',[at],{materialId:'stone',rgba:[140,140,140,255],solid:true,customColor:true});api.flush();check(api.session.opinion(at),'negative temporary edit recorded');api.edit('revert',[at]);api.flush();
 const height=bridge.pathTerrainHeight(-125,-125);check(Number.isFinite(height)&&height>0,'negative path sampling');
 bridge.updatePath(null,{name:'Saved path',controlPoints:[[-125,height,-125],[-121,height,-125]],width:1,elevationMode:'authored',terrainInteraction:'grade',interpolation:'straight'});
 await runtime().setRepresentation('polygonal');
 openVoxelWorldDialog(bridge,'terrain');form=document.querySelector('[data-voxel-world-dialog]');check(form.querySelector('[name=worldExtentMode]').options[0].disabled,'unsafe finite conversion disabled');bridge.voxelWorldDialog.close();
 check(await saveCurrentWorldFile({state:ctx.state,movementState:ctx.movementState,objects:ctx.objects,lights:ctx.lights}),'save infinite definition');
 panel.cleanup();window.NodevisionState.currentMode='Virtual World Viewing';await setupPanel(panel,{filePath:'world.html',viewPermissions:{authoring:false}});check(await panel.worldReady,'Viewer reopen');await runtime().ready;await getActiveMetaWorldLayerBridge().constructionsReady;
 const reopened=window.VRWorldContext;check(runtime().definition.worldExtent.mode==='infinite'&&runtime().representation==='polygonal','extent and appearance persist');check(reopened.objects.some(o=>o.userData.metaWorldLayerId==='authored-marker'),'authored marker retained');check(reopened.objects.some(o=>o.userData.pathRuntime),'path retained');check(runtime().generator.getVoxel(-512,1,-512)===0,'linked excavation survives reopen');
 reopened.camera.position.set(-127,45,-127);await wait(()=>[...runtime().manager.loaded.values()].some(e=>e.cell[0]<-10&&e.mesh),'Viewer signed streaming');
 panel.cleanup();document.getElementById('result').textContent='PASS: native extent UI, undo/redo, negative streaming/collision/editing, linked excavation, paths and actual Editor save/Viewer reopen';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
