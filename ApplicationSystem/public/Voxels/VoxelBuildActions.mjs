// Nodevision/ApplicationSystem/public/Voxels/VoxelBuildActions.mjs
// Build-mode command adapter preserving the existing viewport, document and save lifecycle.
import { buildSettings } from './VoxelBuildSettings.mjs';
import { geometry,symmetric,constrain } from './VoxelBuildGeometry.mjs';
import { transformed,transferPlan } from './VoxelTransfers.mjs';
export const drawingActions=['line','rectangle','box','sphere','ellipsoid','cylinder'];
export function buildAction(api,action,args){
 const viewport=api.viewport;
 if(action==='settings'){api.cancelTool?.();api.build=buildSettings(args,api.build);viewport.workplane=api.build;viewport.buildOverlay.settings(api.build,api.brush.symmetry);api.syncBuildControls();return true;}
 if(action==='settings-open'){api.openSettings();return true;}
 if(action==='finish'){api.finishTool?.();return true;}
 if(action==='preview'){
  if(!api.editing)throw Error('Switch to Build Mode first');api.doc.editable();api.cancelTool?.();const operation=args.action,params={...api.build,...args.parameters,color:args.parameters?.color||api.color()};if(params.to)params.to=constrain(params.to,params.at,api.build.constraint);if(params.offset)params.offset=constrain(params.offset,[0,0,0],api.build.constraint);let points;
  if(drawingActions.includes(operation))points=symmetric([...geometry(operation,params)],api.brush.symmetry,api.build.symmetryOrigin);
  else if(['move','rotate','mirror','duplicate'].includes(operation))points=transferPlan(api.doc,transformed(api.doc,operation,params),api.doc.active,params.collision,operation!=='duplicate').map(v=>v.next);
  else throw Error('Preview supports drawing tools and selection transforms');api.previewOperation={action:operation,args:params};viewport.buildOverlay.preview(points,params.color);return true;
 }
 if(action==='commit-preview'){const operation=api.previewOperation;if(!operation)throw Error('No pending preview');api.previewOperation=null;viewport.buildOverlay.preview([]);return api.run(operation.action,operation.args).then(()=>true);}
 return false;
}
