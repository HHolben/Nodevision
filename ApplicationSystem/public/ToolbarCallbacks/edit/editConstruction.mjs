import {chooseConstructionEdit} from '../../MetaWorld/ConstructionEditing/Controls.mjs';
import {setStatus} from '../../StatusBar.mjs';
export default function(){try{return chooseConstructionEdit();}catch(error){setStatus('Edit Construction',error.message);return false;}}
