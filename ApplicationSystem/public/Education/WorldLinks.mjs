// Nodevision/ApplicationSystem/public/Education/WorldLinks.mjs
// This module binds educational records to persistent world-object identities through portable document references. It integrates association changes with native history and selection without rebuilding geometry.
import {activateElementTab} from './PanelNavigation.mjs';
import {getRelativeNotebookReference,resolveNotebookReference,normalizeNotebookRelativePath} from '../utils/notebookPath.mjs';
import {recordId} from './Records.mjs';
export const normalizeDocument=path=>normalizeNotebookRelativePath(path);
export function educationalLink(worldPath,documentPath,id){const document=getRelativeNotebookReference({sourcePath:worldPath,targetPath:documentPath});if(!document||!resolveNotebookReference({sourcePath:worldPath,reference:document}))throw Error('Save both documents in Notebook before linking');return {document,recordId:recordId(id)};}
export function linkDocument(worldPath,link){return resolveNotebookReference({sourcePath:worldPath,reference:link?.document});}
export function validateLinks(links){if(!Array.isArray(links))throw Error('Expected educational associations');return links.map(link=>{recordId(link?.recordId);if(typeof link.document!=='string'||!link.document||/^(?:[a-z][a-z0-9+.-]*:|\/)|\\/i.test(link.document)||/[\u0000-\u001f]/.test(link.document))throw Error('Educational associations require a relative Notebook document');return structuredClone(link);});}
export function indexWorldLinks(worldPath,objects){const index=new Map();for(const object of objects)for(const link of object.educationalLinks||[]){const path=linkDocument(worldPath,link);if(!path)continue;const key=path+'\0'+link.recordId;if(!index.has(key))index.set(key,[]);index.get(key).push(object.id);}return index;}
export function installEducationalWorldBridge(bridge,{entries,changed,THREE,camera}){
 const find=id=>entries.find(e=>e.id===id);
 const apply=(id,links)=>{const entry=find(id);if(!entry)throw Error('Linked world object is missing: '+id);entry.def.educationalLinks=structuredClone(links);if(entry.object3d)entry.object3d.userData.educationalLinks=structuredClone(links);changed(id);};
 bridge.getEducationalLinks=id=>structuredClone(find(id)?.def?.educationalLinks||[]);
 bridge.setEducationalLinks=(id,links)=>{const entry=find(id);if(!entry)throw Error('Choose an existing world object');const next=validateLinks(links),before=bridge.getEducationalLinks(id);if(JSON.stringify(before)===JSON.stringify(next))return false;apply(id,next);bridge.recordSessionTransaction({kind:'session',undo:()=>apply(id,before),redo:()=>apply(id,next)});return true;};
 bridge.educationalObjects=()=>entries.map(e=>({id:e.id,name:e.def.name||e.id,type:e.def.type,educationalLinks:e.def.educationalLinks||[]}));
 bridge.focusEducationalObject=async id=>{const entry=find(id);if(!entry?.object3d)return false;await activateElementTab(globalThis.window?.VRWorldContext?.panel);bridge.selectObject(id);if(camera&&THREE){const box=new THREE.Box3().setFromObject(entry.object3d),center=box.isEmpty()?entry.object3d.position.clone():box.getCenter(new THREE.Vector3()),distance=Math.max(3,box.isEmpty()?3:box.getSize(new THREE.Vector3()).length());camera.position.copy(center).add(new THREE.Vector3(distance*.7,distance*.5,distance));camera.lookAt(center);}return true;};
 for(const entry of entries)if(entry.object3d&&entry.def.educationalLinks)entry.object3d.userData.educationalLinks=structuredClone(entry.def.educationalLinks);
}
