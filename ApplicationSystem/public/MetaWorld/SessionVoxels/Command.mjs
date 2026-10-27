// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/Command.mjs
// Shared terminal command registry adapter; inventory remains the active-tool authority.
import {TOOLS} from './Authoring.mjs';
import {openSessionVoxelSettings} from './Settings.mjs';
export function sessionVoxelCommand([action='count',options={}]){const api=window.VRWorldContext?.sessionVoxels;if(!api)throw Error('Open a procedural world first');if(TOOLS.includes(action))return api.select(action);if(action==='count')return (api.constructionEdit?.layer||api.session).count;if(action==='clear')return api.clear();if(action==='settings')return openSessionVoxelSettings();if(action==='edit'||action==='revert-cell'){const result=api.edit(action==='revert-cell'?'revert':options.tool||api.settings.tool,options.points||[options.at],options.material);api.flush();return result;}throw Error('Unknown temporary voxel command');}
