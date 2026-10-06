// Nodevision/ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs
// These tests verify conservative Sandbox planning, stable generator settings, and temporary permissions without altering saved world rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultHtmlWorld } from './DefaultHtmlWorld.mjs';
import { classifySandboxWorld, planSandboxWorld, createSandboxSeed } from './SandboxWorldPlanner.mjs';
import { stageWorldDraft, readWorldDraft, clearWorldDraft, readEmbeddedWorld } from './WorldDocumentDrafts.mjs';
import { guardWorldLayerBridge, guardWorldControllers, guardMovementAuthoring, acquireWorldViewPermissions, worldAuthoringAllowed } from './WorldAuthoringPermissions.mjs';
import { installPlayerRulesAbility } from '../PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/PlayerRulesAbility.mjs';

test('missing and exact default worlds create one trusted finite terrain',()=>{
  for(const source of [null,createDefaultHtmlWorld('page.html')]) {
    let calls=0;const plan=planSandboxWorld(source,'page.html',()=>{calls++;return -123;});
    assert.equal(calls,1);assert.equal(plan.created,true);assert.equal(plan.definition.objects.length,1);
    const terrain=plan.definition.objects[0];assert.equal(terrain.voxelSize,0.25);assert.deepEqual(terrain.size,[1000,128,1000]);
    assert.deepEqual(terrain.generator,{id:'nodevision-terrain-v1',version:1,seed:-123});
    assert.deepEqual(terrain.chunks,{voxelsPerAxis:32,loadRadius:8});
    assert.equal(planSandboxWorld(plan.definition,'page.html',()=>{throw Error('seed regenerated');}).definition,plan.definition);
  }
  assert.equal(createSandboxSeed({getRandomValues:a=>{a[0]=-2147483648;return a;}}),-2147483648);
});
test('authored worlds including edited defaults and empty worlds are preserved',()=>{
  const modified=createDefaultHtmlWorld('page.html');modified.objects[0].position[1]=2;
  for(const world of [modified,{objects:[]},{objects:[{id:'page-ground',type:'box'},{id:'page-frame',type:'box'}]}, {...createDefaultHtmlWorld('page.html'),customData:42}]){
    assert.equal(classifySandboxWorld(world,'page.html'),'authored');
    assert.equal(planSandboxWorld(world,'page.html',()=>{throw Error('replaced authored world');}).definition,world);
  }
});
test('HTML-owned unsaved drafts retain seed and invalidate on source changes',()=>{
  const world=planSandboxWorld(null,'page.html',()=>42).definition;
  stageWorldDraft('/Notebook/page.html',world,'<h1>original</h1>');
  assert.deepEqual(readWorldDraft('page.html','<h1>original</h1>'),world);
  assert.deepEqual(readWorldDraft('page.html','<h1>external prose edit</h1>'),world);
  assert.equal(readWorldDraft('page.html','<script id="nodevision-metaworld">{"objects":[]}</script>'),null);
  clearWorldDraft('page.html');
});
test('Play denies authoring before creative override; Build and ordinary rules remain unchanged',()=>{
  const rules={allowPlace:true,allowBreak:true,allowInspect:true,allowToolUse:true,allowSave:true,allowFly:true};
  const state={playerMode:'creative',worldRules:rules,viewPermissions:{authoring:false}};
  const ctx={api:{},movementState:state};installPlayerRulesAbility(ctx);
  assert.equal(ctx.api.playerMode(),'survival');
  for(const key of ['allowPlace','allowBreak','allowInspect','allowToolUse','allowSave'])assert.equal(ctx.api.canUseAbility(key),false);
  assert.equal(ctx.api.canUseAbility('allowFly'),true);assert.deepEqual(state.worldRules,rules);
  let count=0;const bridge=guardWorldLayerBridge({listObjects:()=>['a'],addObjectLayer:()=>++count,removeObjectLayer:()=>++count,undo:()=>++count},state);
  assert.deepEqual(bridge.listObjects(),['a']);assert.equal(bridge.addObjectLayer(),false);assert.equal(bridge.removeObjectLayer(),false);assert.equal(bridge.undo(),false);
  const context={movementState:state,objectInspector:{inspectTarget:()=>++count},equationColliderController:{addPlane:()=>++count}};
  guardWorldControllers(context);assert.equal(context.objectInspector.inspectTarget(),false);assert.equal(context.equationColliderController.addPlane(),false);
  const methods=guardMovementAuthoring({tryPlaceVoxel:()=>++count,handleSelectedItemAction:()=>++count},state);
  assert.equal(methods.tryPlaceVoxel(),false);assert.equal(methods.handleSelectedItemAction(),false);assert.equal(count,0);
  state.viewPermissions={authoring:true};assert.equal(ctx.api.playerMode(),'creative');assert.equal(ctx.api.canUseAbility('allowPlace'),true);assert.equal(bridge.addObjectLayer(),1);
  delete state.viewPermissions;state.playerMode='survival';assert.equal(ctx.api.canUseAbility('allowPlace'),true);
});

test('a temporary Play scope also protects newly opened views and releases cleanly',()=>{
  const release=acquireWorldViewPermissions({authoring:false});
  try { assert.equal(worldAuthoringAllowed({}),false); } finally { release(); }
  assert.equal(worldAuthoringAllowed({}),true);
});

test('legacy commented JSON is read without damaging quoted URLs, and malformed worlds are not replaced',()=>{
  const parserFor=text=>class { parseFromString(){return {querySelector:()=>({textContent:text})};} };
  assert.deepEqual(readEmbeddedWorld('',parserFor('{/* note */"objects":[],"src":"https://example.test/a//b"}')),
    {objects:[],src:'https://example.test/a//b'});
  for(const text of ['null','[]','{broken'])assert.throws(()=>readEmbeddedWorld('',parserFor(text)),/unreadable/);
});
