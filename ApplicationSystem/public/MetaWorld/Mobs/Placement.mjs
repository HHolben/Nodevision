import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {mobPlacement} from './AimPlacement.mjs';
export async function insertBrownHare(){const ctx=window.VRWorldContext;if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;const bridge=await ensureEditableMetaWorldBridge();if(!bridge?.updateMob)return false;const placement=mobPlacement(ctx);const def=bridge.updateMob(null,{...placement,speciesId:'brown-hare'});ctx.objectInspector?.inspectTarget(ctx.objects.find(o=>o.userData.metaWorldLayerId===def.id));return def;}
