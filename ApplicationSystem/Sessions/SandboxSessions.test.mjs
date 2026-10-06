// Nodevision/ApplicationSystem/Sessions/SandboxSessions.test.mjs
// This test exercises built-in Sandbox discovery and validates the shared command and script contract using the existing registry.
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listSessions,readSession } from './SessionRegistry.mjs';
import { getNodevisionCommandDefinition } from '../public/Commands/NodevisionCommandRegistry.mjs';
import { isKnownNodevisionEvent } from '../public/Commands/NodevisionEventRegistry.mjs';
assert.equal(isKnownNodevisionEvent('sandbox.finished'),true);
const root=await mkdtemp(path.join(tmpdir(),'nv-sandbox-'));
try {
 const ctx={runtimeRoot:root,applicationSystemRoot:path.resolve('ApplicationSystem'),notebookDir:path.join(root,'Notebook'),userDataDir:path.join(root,'UserData')};
 const listed=await listSessions(ctx);
 for(const [suffix,mode] of [['Build','build'],['Play','play']]){
  const id=`Sandbox${suffix}.NodevisionSession.js`;
  assert.ok(listed.builtIn.some(s=>s.id===id&&s.title===`Sandbox — ${suffix}`));
  const session=await readSession('builtin',id,ctx);
  assert.ok(session.source.includes(`run("sandbox.open", "${mode}")`));
  assert.ok(session.source.includes('wait("sandbox.finished")'));
 }
 const command=getNodevisionCommandDefinition('sandbox.open');assert.equal(command.sessionSafe,true);
 assert.deepEqual(command.arguments[0].values,['build','play']);
 console.log('Sandbox built-in discovery and command metadata passed.');
}finally{await rm(root,{recursive:true,force:true});}
