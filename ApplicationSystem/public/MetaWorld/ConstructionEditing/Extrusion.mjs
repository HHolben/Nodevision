// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Extrusion.mjs
// Adapts focused construction selection and transactions to the existing GOX extrusion controller and transient overlay.
import {installExtrusion} from '../../Voxels/GoxExtrusion.mjs';
import {newLayer,setVoxel} from '../../Voxels/VoxelModel.mjs';
import {MAX_BATCH} from '../SessionVoxels/SessionLayer.mjs';
export function installConstructionExtrusion(edit,status,signal){
 const {ctx}=edit,T=ctx.THREE,canvas=ctx.renderer.domElement,priorTabIndex=canvas.getAttribute('tabindex'),root=new T.Group(),geometry=new T.BoxGeometry(1,1,1);root.position.fromArray(edit.position);root.scale.setScalar(.25);ctx.scene.add(root);canvas.tabIndex=0;
 let revision=-1,active=newLayer(),pending=[],selection=new Set(),beforeSelection=null;
 const doc={layer:0,get active(){return active;},get revision(){return edit.layer.revision;},get selection(){return selection;},set selection(v){selection=v;},onChange(){},
  editable(){edit.assertValid();if(edit.busy)throw Error('Construction save is in progress');if(edit.conflict)throw Error(edit.conflict);if(revision!==edit.layer.revision){active=newLayer();for(const c of edit.geometry.cells)setVoxel(active,c.at,c.rgba);revision=edit.layer.revision;}},
  begin(){pending=[];beforeSelection=new Set(selection);},write(pos,color){pending.push({pos,color});},cancel(){pending=[];if(beforeSelection)selection=beforeSelection;beforeSelection=null;},
  commit(){if(pending.length>MAX_BATCH)throw Error('Construction extrusion exceeds '+MAX_BATCH+' new voxels');const plan=api.extrusion.plan;edit.batch(pending.map(v=>({at:v.pos,value:{...edit.layer.effective(plan.added.get(v.pos.join(',')).source),rgba:v.color}})));edit.api.flush();pending=[];}
 };
 const viewport={camera:ctx.camera,renderer:ctx.renderer,controls:{enabled:true},host:ctx.panel,voxels:{root},buildOverlay:{root,geometry,sync(){}},theme:{cursor:0xffdd44,blocked:0xff3355},cursor(){},render(){}};
 const api={element:ctx.panel,doc,status,editing:true,cancelTool(){edit.setVolumeHandles?.(false);ctx.controls?.unlock?.();ctx.stopSessionVoxelTools?.();edit.cancelPreview?.();},previewExtrusion(plan,overlay){const conflicts=[...plan.added.values()].filter(v=>edit.intersections({cells:[{at:v.pos}]}).length);overlay.batch('terrain',conflicts,true);overlay.batches.get('terrain').material.color.set(0xff3355);},syncBuildControls(){const plan=api.extrusion?.plan;if(plan){const conflicts=[...plan.added.values()].filter(v=>edit.intersections({cells:[{at:v.pos}]}).length);if(conflicts.length)status.textContent+=` · ${conflicts.length} terrain conflicts (save blocked)`;}}};
 installExtrusion(api,viewport,signal);edit.extrusion=api.extrusion;edit.selection=doc;
 const ray=new T.Raycaster();ctx.renderer.domElement.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});if(!e.shiftKey||api.extrusion.active||e.button!==0)return;const rect=e.currentTarget.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),ctx.camera);const hit=edit.raycast(ray.ray.origin.toArray(),ray.ray.direction.toArray(),'pick');if(!hit?.value)return;const key=edit.local(hit.at).join(',');selection.has(key)?selection.delete(key):selection.add(key);edit.onChange?.();status.textContent=`${selection.size} construction voxels selected · E to extrude`;e.preventDefault();e.stopImmediatePropagation();},{capture:true,signal});
 signal.addEventListener('abort',()=>{if(priorTabIndex===null)canvas.removeAttribute('tabindex');else canvas.setAttribute('tabindex',priorTabIndex);root.removeFromParent();geometry.dispose();},{once:true});return api;
}
