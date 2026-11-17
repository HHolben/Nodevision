// Reuse ordinary world drafts for unsaved creature edits; no simulation state enters a draft.
import {stageWorldDraft} from '../WorldDocumentDrafts.mjs';
import {buildWorldDefinition} from '../../PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
function definition(ctx){return buildWorldDefinition({existingWorldDefinition:ctx.currentWorldDefinition,objects:ctx.objects,lights:ctx.lights,movementState:ctx.movementState});}
function signature(ctx){const world=definition(ctx);return JSON.stringify({creature:world.metadata.creature,objects:world.objects});}
export function startCreatureSession(ctx,path,html,restored=false){
 let baseline=signature(ctx),source=html,initialDirty=restored;
 const session={get dirty(){return initialDirty||signature(ctx)!==baseline;},saved(updatedHtml){source=updatedHtml;baseline=signature(ctx);initialDirty=false;},capture(){if(session.dirty)stageWorldDraft(path,definition(ctx),source);},dispose(){window.removeEventListener('beforeunload',unload);}};
 const unload=event=>{if(session.dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',unload);ctx.creatureDocumentSession=session;
}
export function captureCreatureSession(ctx){const session=ctx?.creatureDocumentSession;if(!session)return;session.capture();session.dispose();delete ctx.creatureDocumentSession;}
export function allowCreatureSwitch(ctx,path){if(!ctx?.creatureDocumentSession||ctx.currentWorldPath===path||!ctx.creatureDocumentSession.dirty)return true;return window.confirm('This creature has unsaved definition edits. Keep a session draft and open the other file? Save the creature to preserve it across application restarts.');}
