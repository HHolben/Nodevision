// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathTool.mjs
// Shares path settings and suspended drafts through the existing world bridge, inventory and cursor system.
import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {beginPathDrawing} from './PathInteraction.mjs';
import {validatePath} from './PathDefinition.mjs';
import {setStatus} from '../../StatusBar.mjs';
export const PATH_TOOL_ID='path';
const states=new WeakMap();
export function pathToolState(bridge=getActiveMetaWorldLayerBridge()){
 if(!bridge)throw Error('Open an editable Virtual World first.');
 if(!states.has(bridge))states.set(bridge,{settings:{width:2,surfaceMaterial:'gravel',interpolation:'smooth',elevationMode:'locally-flat',terrainInteraction:'overlay',transitionWidth:1,smoothing:.5,elevationOffset:0,snap:'terrain',gridSize:.25},points:[],id:null});return states.get(bridge);
}
export function configurePathTool(patch){const state=pathToolState(),next={...state.settings,...patch};validatePath({...next,id:'preview',controlPoints:[[0,0,0],[10,0,0]]});state.settings=next;window.VRWorldContext?.pathDrawing?.refresh();return next;}
export async function activatePathTool({editId}={}){
 const context=window.VRWorldContext;
 try{if(!context||!worldAuthoringAllowed(context.movementState)||context.movementState?.worldMode==='2d')throw Error('Path placement requires an editable 3D world; leave Play or read-only mode first.');
 const bridge=await ensureEditableMetaWorldBridge();if(window.VRWorldContext!==context)throw Error('The active world changed.');if(!bridge?.updatePath)throw Error('Path authoring is unavailable in this world.');
 if(editId){context.cancelPathDrawing?.();const def=bridge.getPathDefinition(editId);if(!def)throw Error('Select an existing path to extend.');const state=pathToolState(bridge);state.id=editId;state.settings={...def,position:[0,0,0]};state.points=def.controlPoints.map(p=>p.map((n,i)=>n+def.position[i]));}
 if(context.inventory?.getSelectedItem?.()?.id!=='path')context.inventory?.equipItemToActiveHand?.('path');
 if(!beginPathDrawing(context))throw Error('The world canvas is unavailable.');return true;
 }catch(error){setStatus('Path',error.message);return false;}
}
export async function pathToolAction(action='use'){if(action==='attack'){window.VRWorldContext?.cancelPathDrawing?.();return true;}if(!window.VRWorldContext?.pathDrawing&&!await activatePathTool())return false;if(action==='adjust')return(await import('./PathToolSettings.mjs')).openPathToolSettings();return true;}
export async function pathCommand([action='activate',options={}]=[]){
 if(action==='activate')return activatePathTool(options);
 if(!window.VRWorldContext||!worldAuthoringAllowed(window.VRWorldContext.movementState))throw Error('Path editing requires an editable world.');
 if(action==='settings')return Object.keys(options).length?configurePathTool(options):(await import('./PathToolSettings.mjs')).openPathToolSettings();
 if(action==='finish')return window.VRWorldContext?.pathDrawing?.finish();
 if(action==='cancel')return window.VRWorldContext?.cancelPathDrawing?.();
 const bridge=await ensureEditableMetaWorldBridge();if(action==='create')return bridge.updatePath(null,options);if(action==='update')return bridge.updatePath(options.id,options);if(action==='delete')return bridge.removeObjectLayer(options.id);if(action==='extend')return activatePathTool({editId:options.id});throw Error('Unknown path action.');
}
