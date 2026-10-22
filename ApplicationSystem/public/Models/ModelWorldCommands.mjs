// Nodevision/ApplicationSystem/public/Models/ModelWorldCommands.mjs
// One terminal/GUI/inventory command surface for model placement and source-instance actions.
import {getActiveMetaWorldLayerBridge} from '/MetaWorld/MetaWorldLayerState.mjs';
import {worldAuthoringAllowed} from '/MetaWorld/WorldAuthoringPermissions.mjs';
import {modelSource} from './ModelWorldAsset.mjs';
import {placementSettings} from './ModelPlacementMath.mjs';
import {startModelPlacement,getModelPlacement,cancelModelPlacement} from './ModelPlacement.mjs';
export function assignModelInventory(source,options={},slot){if(slot!==undefined&&(!Number.isInteger(slot)||slot<0||slot>8))throw Error('Hotbar slot must be 0–8');const inventory=window.VRWorldContext?.inventory;if(!inventory)throw Error('World inventory is unavailable');const path=modelSource(source),id='model:'+path,settings=placementSettings(options),existing=inventory.items.find(i=>i.id===id);if(existing){existing.modelFile=path;existing.modelPlacement=settings;}else inventory.addItem(id,1,'3D Model: '+path.split('/').pop(),{category:'tools',tool:true,modelFile:path,modelPlacement:settings});if(slot!==undefined){if(!Number.isInteger(slot)||slot<0||slot>8)throw Error('Hotbar slot must be 0–8');inventory.assignItemToSlot(slot,id);}return id;}
export async function modelWorldCommand([action='choose',args={}]=[]){
 const context=window.VRWorldContext;if(!context||!worldAuthoringAllowed(context.movementState))throw Error('Activate an editable world');const bridge=getActiveMetaWorldLayerBridge();
 if(action==='choose')return(await import('./ModelPlacementUI.mjs')).openModelPicker();
 if(action==='place')return startModelPlacement(args.path,args);
 if(action==='cancel')return cancelModelPlacement();
 if(action==='settings'){const api=getModelPlacement();if(!api)throw Error('Activate 3D Model placement');if(Object.keys(args).length)return api.configure(args);return api.openSettings();}
 if(action==='commit'){const api=getModelPlacement();if(!api)throw Error('No placement preview');return api.commit();}
 if(action==='inventory')return assignModelInventory(args.path,args.settings,args.slot);
 const target=args.id?context.objects.find(o=>o.userData.metaWorldLayerId===args.id):context.objectInspector?.getActiveTarget?.();if(!target?.userData?.modelRuntime)throw Error('Select a 3D Model instance');const id=target.userData.metaWorldLayerId;
 if(action==='reload')return bridge.reloadModelAsset(id);
 if(action==='duplicate')return bridge.duplicateModelAsset(id);
 if(action==='delete')return bridge.removeObjectLayer(id);
 if(action==='select')return bridge.selectObject(id);
 if(action==='transform'){if(args.pivot!==undefined)throw Error('Choose the pivot during placement; instance transforms retain that pivot');const current=target.userData.modelRuntime.serialize(),settings=placementSettings(args,current);bridge.recordObjectTransform(target);target.position.fromArray(settings.position);target.rotation.fromArray([...settings.rotation,'XYZ']);target.scale.fromArray(settings.scale);if(args.visible!==undefined)target.visible=!!args.visible;context.objectInspector?.refreshActiveTarget?.();return true;}
 if(action==='edit-source'){const path=target.userData.modelRuntime.serialize().modelFile,cell=context.panel?.closest?.('.panel-cell')||window.activeCell;if(typeof window.__nvOpenPanelTab==='function'&&cell)return window.__nvOpenPanelTab(cell,'GraphicalEditor','EditorPanel',{filePath:path});window.dispatchEvent(new CustomEvent('toolbarAction',{detail:{id:'GraphicalEditor',type:'EditorPanel',replaceActive:false,panelVars:{filePath:path}}}));return true;}
 throw Error('Unknown model world action');
}
