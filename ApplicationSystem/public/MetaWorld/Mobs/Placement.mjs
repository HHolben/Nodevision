import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {targetPlacement} from '../ArcheryTarget/Placement.mjs';
export async function insertBrownHare(){const ctx=window.VRWorldContext;if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;const bridge=await ensureEditableMetaWorldBridge();if(!bridge?.updateMob)return false;const placement=targetPlacement({...ctx,objects:ctx.objects.filter(o=>!o.userData.mobRuntime)});placement.rotation=[0,placement.rotation[1],0];const def=bridge.updateMob(null,{...placement,speciesId:'brown-hare'});ctx.objectInspector?.inspectTarget(ctx.objects.find(o=>o.userData.metaWorldLayerId===def.id));return def;}
