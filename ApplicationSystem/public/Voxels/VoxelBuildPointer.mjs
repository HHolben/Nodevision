// Nodevision/ApplicationSystem/public/Voxels/VoxelBuildPointer.mjs
// Face placement, gap-free strokes and cancellable shape previews using the existing document transaction.
import { buildContext } from './VoxelBuildContext.mjs';
import { brushPoints } from './VoxelBrush.mjs';
import { geometry,gridLine,constrain,symmetric } from './VoxelBuildGeometry.mjs';
import { key,chunkKey } from './VoxelModel.mjs';
export const buildTools=['orbit','select','select-box','add','brush','erase','paint','pick','line','rectangle','box','sphere','ellipsoid','cylinder','fill'];
export function pointerTools(api,viewport,signal){
 buildContext(api,viewport,signal);const canvas=viewport.renderer.domElement;let dragging=false,start=null,last=null,visited=new Set(),vertices=[],preview=[];
 const shapes=['line','rectangle','box','sphere','ellipsoid','cylinder','select-box'];
 const changed=()=>viewport.update(api.displayModel(),api.doc.selection,api.doc.layer);
 const pointsAt=(at)=>symmetric(brushPoints(at,{...api.brush,size:api.tool==='add'?1:api.brush.size,symmetry:[]}),api.brush.symmetry,api.build.symmetryOrigin);
 const hitAt=e=>{const hit=viewport.hit(e,['add','brush',...shapes].includes(api.tool));if(hit)hit.at=constrain(hit.at,start||api.build.anchor,api.build.constraint);return hit;};
 const show=e=>{const hit=hitAt(e);if(!hit){viewport.buildOverlay.preview([]);return null;}api.coordinates.textContent=`X ${hit.at[0]} · Y ${hit.at[1]} · Z ${hit.at[2]}`;
  if(start&&shapes.includes(api.tool)){const kind=api.tool==='select-box'?'box':api.tool;preview=symmetric([...geometry(kind,{...api.build,at:start,to:hit.at})],api.brush.symmetry,api.build.symmetryOrigin);if(api.tool==='line'){if(vertices.length+preview.length>262144)throw Error('Line exceeds operation limit');preview=[...new Map([...vertices,...preview].map(p=>[key(p),p])).values()];}}
  else preview=pointsAt(hit.at);viewport.buildOverlay.preview(preview,api.tool==='erase'?[255,70,70,255]:api.color());return hit;
 };
 const stroke=hit=>{if(!hit||(!['add','brush'].includes(api.tool)&&hit.layer!==api.doc.layer))return;api.doc.begin();for(const center of gridLine(last||hit.at,hit.at))for(const p of pointsAt(center)){const k=key(p);if(visited.has(k))continue;visited.add(k);if(visited.size>262144)throw Error('Stroke exceeds operation limit');const occupied=api.voxel(p)[3];if(api.tool==='paint'&&!occupied)continue;if(['add','brush'].includes(api.tool)&&occupied){if(api.build.collision==='cancel')throw Error('Destination collision');if(api.build.collision==='merge')continue;}api.doc.write(p,api.tool==='erase'?[0,0,0,0]:api.color());viewport.voxels.layers[api.doc.layer]?.data.delete(chunkKey(p));}last=hit.at;changed();};
 const guard=fn=>{try{fn();}catch(error){api.cancelTool();api.status.textContent=error.message;}};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||api.tool==='orbit')return;e.preventDefault();canvas.focus({preventScroll:true});guard(()=>{const hit=show(e);if(!hit)return;
  if(api.tool==='pick'){if(hit.layer!==undefined)api.pickColor(api.doc.model.layers[hit.layer]&&api.voxelAtLayer(hit.layer,hit.at));return;}
  if(api.tool==='select'){if(hit.layer!==undefined){if(api.doc.layer!==hit.layer){api.doc.layer=hit.layer;api.doc.selection.clear();}api.safe('select',{at:hit.at,mode:e.altKey?'subtract':e.shiftKey?'add':'replace'});}return;}
  if(api.tool==='select-box'){if(!start)start=hit.at;else{api.safe('select',{at:start,to:hit.at,mode:e.shiftKey?'add':'replace'});start=null;viewport.buildOverlay.preview([]);}return;}
  if(!api.editing)return;api.doc.editable();if(shapes.includes(api.tool)){if(!start){start=hit.at;vertices=[];}else if(api.tool==='line'){vertices=preview;start=hit.at;}else{api.safe('stamp',{points:preview,color:api.color(),collision:api.build.collision});start=null;viewport.buildOverlay.preview([]);}return;}
  if(api.tool==='fill'){if(hit.layer===api.doc.layer)api.safe('fill',{at:hit.at,color:api.color()});return;}
  canvas.setPointerCapture(e.pointerId);dragging=true;last=null;visited.clear();stroke(hit);
 });},{signal});
 canvas.addEventListener('pointermove',e=>{if(api.tool==='orbit')return;guard(()=>{const hit=show(e);if(dragging)stroke(hit);});},{signal});
 canvas.addEventListener('pointerup',e=>{if(e.button!==0)return;dragging=false;last=null;visited.clear();api.doc.commit();},{signal});
 canvas.addEventListener('pointercancel',()=>api.cancelTool(),{signal});canvas.addEventListener('pointerleave',()=>{if(!dragging)viewport.buildOverlay.preview([]);},{signal});
 api.finishTool=()=>{if(api.tool==='line'&&vertices.length){api.safe('stamp',{points:[...new Map(vertices.map(p=>[key(p),p])).values()],color:api.color(),collision:api.build.collision});}start=null;vertices=[];viewport.buildOverlay.preview([]);};
 api.cancelTool=()=>{api.previewOperation=null;start=null;vertices=[];dragging=false;last=null;visited.clear();api.doc.cancel();viewport.buildOverlay.preview([]);viewport.cursor(null);};canvas.tabIndex=0;
}
