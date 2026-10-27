// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertConstruction.mjs
// Opens the native world construction placement settings.
import {insertConstruction} from '../../MetaWorld/Constructions/ConstructionTool.mjs';
import {setStatus} from '../../StatusBar.mjs';
export default async function(){try{return await insertConstruction();}catch(error){setStatus('Construction',error.message);return false;}}
