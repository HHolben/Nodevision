// Nodevision/ApplicationSystem/public/Education/Navigation.mjs
// This module navigates from world associations to educational entries in existing HTML editor panels. It reuses Notebook path resolution and checks unavailable documents before opening a new editor.
import {activateElementTab} from './PanelNavigation.mjs';
import {htmlDocuments} from './HtmlController.mjs';
import {normalizeDocument} from './WorldLinks.mjs';
export async function goToEducationalEntry(path,id){const target=[...htmlDocuments.values()].find(api=>normalizeDocument(api.filePath)===normalizeDocument(path));if(target){await activateElementTab(target.root);if(!target.goTo(id))throw Error('The record or its HTML entry is missing; no content was removed');return true;}
 const response=await fetch('/Notebook/'+normalizeDocument(path).split('/').map(encodeURIComponent).join('/'),{method:'HEAD'});if(!response.ok)throw Error(`Linked document is unavailable (${response.status}): ${path}`);
 const {loadPanelIntoCell}=await import('/panels/workspace.mjs');await loadPanelIntoCell('GraphicalEditor',{id:'GraphicalEditor',filePath:path,displayName:path.split('/').pop()});const opened=[...htmlDocuments.values()].find(api=>normalizeDocument(api.filePath)===normalizeDocument(path));if(!opened?.goTo(id))throw Error('Document opened, but its educational entry could not be found');return true;}
