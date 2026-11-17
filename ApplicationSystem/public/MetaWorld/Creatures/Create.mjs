import {creatureAssembly} from '../Mobs/Registry.mjs';
import {BUILTIN_HARE,creatureHtml,resourcePath} from './Document.mjs';
import {invalidateCreatureDiscovery} from './Discovery.mjs';
export function newCreatureWorld({name='New Creature',speciesId='user-'+crypto.randomUUID(),documentId=crypto.randomUUID()}={}){
 const a=creatureAssembly(BUILTIN_HARE),c=structuredClone(a.metadata);Object.assign(c,{speciesId,documentId,displayName:name,author:'User',description:'User creature',taxonomy:['Animal'],scientificName:''});c.definition={...structuredClone(a.species),id:speciesId,name,scientificName:''};for(const key of ['runtimeBehaviorProgram','document','documentId','taxonomy','origin','componentTypes','license'])delete c.definition[key];c.dependencies=[a.species.model,a.species.attribution];c.license.notice=a.species.attribution;
 return {name,type:'meta-world',version:1,spawnPosition:{x:0,y:.8,z:2},metadata:{creature:c,objectGroundOnly:true,gravityModel:{mode:'none'},playerRules:{allowInspect:true,allowToolUse:true},environment:{backgroundMode:'color',skyColor:'#eef2f4'}},objects:[{id:c.rootId,type:'mob',creatureRoot:true,speciesId,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}]};
}
export async function writeNewCreature(path,world,{html}={}){
 const ref=resourcePath(path.startsWith('/')?path:'/Notebook/'+path);if(!ref.startsWith('/Notebook/')||!ref.endsWith('.html'))throw Error('Choose a Notebook .html path');const relative=decodeURIComponent(ref.slice(10));let content=creatureHtml(world,ref);if(html!==undefined){const {injectWorldDefinitionIntoHtml}=await import('../../PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs');content=injectWorldDefinitionIntoHtml(html,world);}
 let response=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:relative})});if(!response.ok)throw Error('Cannot create creature: path exists or directory is unavailable');
 response=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:relative,content})});if(!response.ok)throw Error('Creature HTML save failed');invalidateCreatureDiscovery();return {path:relative,world};
}
export async function createCreatureDocument(options={}){
 let path=options.path;if(!path){const {showNewFileOverlay}=await import('../../TemplateSystem/NewDocumentController.mjs');const request=await showNewFileOverlay({title:'New Creature (HTML)',defaultFilename:'Creature.html'});if(!request)return false;const {getCurrentNotebookDirectory}=await import('../../TemplateSystem/TemplateApi.mjs');path=[getCurrentNotebookDirectory(),request.filename].filter(Boolean).join('/');}
 const result=await writeNewCreature(path,newCreatureWorld({name:options.name||decodeURIComponent(path.split('/').pop()).replace(/\.html$/i,'')}));if(globalThis.window){window.selectedFilePath=result.path;await (await import('../../TemplateSystem/TemplateApi.mjs')).refreshNotebookDirectory(path.split('/').slice(0,-1).join('/'));document.dispatchEvent(new CustomEvent('fileSelected',{detail:{filePath:result.path}}));}return result;
}
