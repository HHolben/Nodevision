// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionCapture/Selection.mjs
// Pointer region selection shares the world camera and effective raycaster; the preview is never world geometry or history.
import {bounds} from './Region.mjs';
import {captureContext} from './Publish.mjs';
import {setStatus} from '../../StatusBar.mjs';
export function beginSelection({complete=()=>{}}={}){
 const {ctx,api}=captureContext();ctx.cancelConstructionCapture?.();ctx.cancelPathDrawing?.();ctx.stopSessionVoxelTools?.();ctx.controls?.unlock?.();const old=ctx.movementState.textEditing;ctx.movementState.textEditing=true;
 const THREE=ctx.THREE,preview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({wireframe:true,color:0xf4b44c,depthTest:false}));preview.userData.isEditorHelper=true;preview.raycast=()=>{};preview.visible=false;ctx.scene.add(preview);
 const element=ctx.canvas||ctx.renderer?.domElement||ctx.panel,ray=new THREE.Raycaster();let anchor=null,dragging=false,selected=null,disposed=false,active=true;
 function aim(event){const r=element.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),ctx.camera);const hit=api.raycast(ray.ray.origin.toArray(),ray.ray.direction.toArray());if(hit)return hit.at;if(anchor){const y=api.point(anchor)[1],d=ray.ray.direction.y,t=d?(y-ray.ray.origin.y)/d:-1;if(t>=0&&t<=64)return api.cell(ray.ray.at(t,new THREE.Vector3()).toArray());}return null;}
 function update(at){if(!anchor||!at)return;const min=anchor.map((n,i)=>Math.min(n,at[i])),max=anchor.map((n,i)=>Math.max(n,at[i])+1);max[1]=Math.max(max[1],min[1]+4);try{setBounds({min,max});}catch(error){setStatus('Capture selection',error.message);}}
 function setBounds(value){selected=bounds(value);preview.visible=true;preview.position.fromArray(selected.min.map((n,i)=>api.origin[i]+(n+selected.size[i]/2)*.25));preview.scale.fromArray(selected.size.map(n=>n*.25));return selected;}
 function down(e){if(e.button!==0||e.target.closest?.('dialog,input,textarea,button'))return;e.preventDefault();e.stopImmediatePropagation();const at=aim(e);if(!at)return;anchor=at;dragging=true;update(at);try{element.setPointerCapture?.(e.pointerId);}catch{}}
 function move(e){if(!dragging)return;e.preventDefault();e.stopImmediatePropagation();update(aim(e));}
 function finish(){if(!selected||!active)return;active=false;detachInput();complete(structuredClone(selected));}
 function up(e){if(!dragging)return;e.preventDefault();e.stopImmediatePropagation();dragging=false;try{element.releasePointerCapture?.(e.pointerId);}catch{}finish();}
 function key(e){if(e.target.closest?.('input,textarea,select,[contenteditable="true"],dialog'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}else if(e.key==='Enter'&&selected&&active){e.preventDefault();e.stopImmediatePropagation();finish();}}
 function detachInput(){element.removeEventListener('pointerdown',down,true);element.removeEventListener('pointermove',move,true);element.removeEventListener('pointerup',up,true);element.removeEventListener('pointercancel',cancel,true);ctx.movementState.textEditing=old;ctx.movementState.skipClickFrame=true;}
 function cancel(){if(disposed)return;disposed=true;detachInput();document.removeEventListener('keydown',key,true);preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();if(ctx.captureSelection===controller)ctx.captureSelection=null;}
 const controller={get bounds(){return selected;},setBounds,finish,cancel};ctx.captureSelection=controller;ctx.cancelConstructionCapture=cancel;element.addEventListener('pointerdown',down,true);element.addEventListener('pointermove',move,true);element.addEventListener('pointerup',up,true);element.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);setStatus('Select construction region','Drag across the world, then adjust height and dimensions. Escape cancels.');return controller;
}
