// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/saveAsConstruction.mjs
// Native Edit command adapter for the shared construction capture workflow.
import {saveAsConstruction} from '../../MetaWorld/ConstructionCapture/Tool.mjs';
import {setStatus} from '../../StatusBar.mjs';
export default function(){try{return saveAsConstruction();}catch(error){setStatus('Save as Construction',error.message);return false;}}
