// World drops reuse the existing model placement, object-file, image and iframe bridges.
import { registerResourceDropTarget } from './ResourceDropTarget.mjs';
import { resourceReference } from './ResourceTransfer.mjs';
import { IMAGE_EXTENSIONS } from '/Media/LinkedResourceMarkup.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { worldAuthoringAllowed } from '/MetaWorld/WorldAuthoringPermissions.mjs';
export function worldDropHit(context,point) {
  const canvas=context.renderer?.domElement||context.canvas||context.panel,r=canvas.getBoundingClientRect();
  if(point.clientX<r.left||point.clientX>r.right||point.clientY<r.top||point.clientY>r.bottom)throw Error('Drop inside the world viewport.');
  const {THREE,camera}=context,ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((point.clientX-r.left)/r.width*2-1,-(point.clientY-r.top)/r.height*2+1),camera);
  const hit=ray.intersectObjects(context.ground?[...context.objects,context.ground]:context.objects,true).find(hit=>{for(let node=hit.object;node;node=node.parent)if(node.visible===false||node.userData?.isEditorHelper)return false;return !!hit.face;});
  if(!hit)throw Error('Drop on a visible world surface.');return hit.point.clone();
}
export function installWorldResourceDrops(context) {
  const root=context.panel;let indicator=null;
  const clearPreview=()=>{indicator?.removeFromParent();indicator?.geometry.dispose();indicator?.material.dispose();indicator=null;};
  return registerResourceDropTarget(root,{clearPreview,preview(operation){
    if(!indicator){indicator=new context.THREE.Mesh(new context.THREE.SphereGeometry(.08,12,8),new context.THREE.MeshBasicMaterial({color:0x22cc88,depthTest:false}));indicator.userData.isEditorHelper=true;context.scene.add(indicator);}
    indicator.position.copy(operation.position);
  },capture(resource,point){
    const bridge=getActiveMetaWorldLayerBridge();
    const validate=()=>{if(window.VRWorldContext!==context||getActiveMetaWorldLayerBridge()!==bridge||!worldAuthoringAllowed(context.movementState)||context.movementState?.worldMode==='2d'||!root.isConnected)throw Error('The receiving world is unavailable or read-only.');};validate();
    resourceReference(context.currentWorldPath,resource.path); // Require a real Notebook owner; native world fields retain canonical Notebook identities.
    const ext=resource.extension;
    if(!['gox','gltf','glb','stl','obj','scad','html','htm','php'].includes(ext)&&!IMAGE_EXTENSIONS.has(ext))throw Error('This resource has no supported world representation.');
    const position=worldDropHit(context,point);
    return {label:'Place linked '+resource.name,position,validate,async insert(){
      validate();
      if(['gox','gltf','glb'].includes(ext)){
        const {startModelPlacement}=await import('/Models/ModelPlacement.mjs');
        const placement=await startModelPlacement(resource.path,{name:resource.name,repeat:false,validate:()=>{try{validate();return true;}catch{return false;}}});
        try{await placement.configure({position:position.toArray()});return await placement.commit();}finally{placement.cancel();}
      }
      if(['stl','obj','scad'].includes(ext)){
        const {applyObjectFileGeometry}=await import('/PanelInstances/ViewPanels/GameViewDependencies/objectFileLoader.mjs');
        const probe=new context.THREE.Mesh(new context.THREE.BoxGeometry(1,1,1),new context.THREE.MeshBasicMaterial());
        probe.userData.objectFilePath=resource.path;probe.userData.objectFileFormat=ext;
        try{if(!await applyObjectFileGeometry(probe))throw Error('The 3D resource could not be loaded.');}finally{probe.geometry.dispose();probe.material.dispose();}
        validate();
        const {insertWorldModelObject}=await import('/ToolbarJSONfiles/insertMediaModel.mjs');
        return insertWorldModelObject({objectFile:resource.path,label:resource.name,ext,position:[position.x,position.y+.5,position.z],bindCollider:false,validate:()=>{validate();return true;}});
      }
      if(IMAGE_EXTENSIONS.has(ext))return bridge.insertDownloadedImage({imageFile:resource.path,name:resource.name,position:position.toArray(),validate:()=>{validate();return true;}});
      const {iframeWorldDefinition,iframeDefaults}=await import('/Media/IframeProperties.mjs');
      validate();const def=iframeWorldDefinition({...iframeDefaults,src:resourceReference(context.currentWorldPath,resource.path),title:resource.name},position.toArray());def.iframeDocumentPath=context.currentWorldPath;
      return bridge.addGameObjectLayer(def);
    }};
  }});
}
