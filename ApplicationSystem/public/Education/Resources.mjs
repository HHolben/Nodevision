// Nodevision/ApplicationSystem/public/Education/Resources.mjs
// This module resolves educational Notebook resources and creates associated portals through the existing world editor. It verifies destinations and editing context before introducing scene objects.
import {resolveNotebookReference,toNotebookAssetUrl} from '../utils/notebookPath.mjs';
import {educationalLink} from './WorldLinks.mjs';
export function educationalResource(documentPath,href){const path=resolveNotebookReference({sourcePath:documentPath,reference:href});if(!path)throw Error('Notebook link is unresolved or outside this Notebook; the original link was preserved');return {path,url:toNotebookAssetUrl(path)};}
export async function createEducationalPortal({bridge,documentPath,record,position,isCurrent=()=>true}){
 if(!bridge?.addGameObjectLayer||!record?.url)throw Error('Open an editable world and choose a record with a Notebook link');const resource=educationalResource(documentPath,record.url);
 if(!/\.(html?|xhtml|php)$/i.test(resource.path))throw Error('Existing world portals require an HTML or PHP Notebook page');
 const response=await fetch(resource.url,{method:'HEAD'});if(!response.ok)throw Error(`Notebook destination is unavailable (${response.status}): ${resource.path}`);
 if(!isCurrent())throw Error('The originating world or document changed; no portal was created');
 const definition=bridge.addGameObjectLayer({type:'portal',name:record.name||record.identifier,position,targetWorld:resource.url,sameWorld:false,portalDestinationMode:'world',educationalLinks:[educationalLink(bridge.sourcePath,documentPath,record.identifier)]});
 if(!definition)throw Error('The world is in read-only Play mode');return definition;
}
