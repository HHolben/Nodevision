import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {resolveCreature} from './Registry.mjs';
import {BUILTIN_HARE} from '../Creatures/Document.mjs';
import {mobPlacement} from './AimPlacement.mjs';
export async function insertCreature(reference=BUILTIN_HARE){const ctx=window.VRWorldContext;if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;const bridge=await ensureEditableMetaWorldBridge();if(!bridge?.updateMob)return false;if(ctx.currentWorldDefinition?.metadata?.creature)throw Error('Open an ordinary world to insert creature instances.');const assembly=await resolveCreature(reference,{reload:true});const placement=mobPlacement(ctx);const defaults=creaturePlacement(ctx.THREE,assembly,placement);const def=bridge.updateMob(null,{...defaults,speciesId:assembly.species.id,creatureDocument:assembly.document});ctx.objectInspector?.inspectTarget(ctx.objects.find(o=>o.userData.metaWorldLayerId===def.id));return def;}

export const insertBrownHare=()=>insertCreature(BUILTIN_HARE);

export function creaturePlacement(THREE,assembly,placement){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...placement.rotation)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...assembly.root.rotation)));return {...placement,rotation:new THREE.Euler().setFromQuaternion(q).toArray().slice(0,3),scale:[...assembly.root.scale]};}
