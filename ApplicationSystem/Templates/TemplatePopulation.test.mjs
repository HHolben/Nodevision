// Nodevision/ApplicationSystem/Templates/TemplatePopulation.test.mjs
// These tests verify populated document writes preserve source files, reject collisions, and respect existing Notebook filesystem boundaries.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {savePopulatedDocument} from './TemplateRegistry.mjs';
test('exclusive populated ODP writes and Notebook boundaries',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'nv-populate-'));
  try {
    const ctx={notebookDir:path.join(root,'Notebook')};await fs.mkdir(ctx.notebookDir);
    const options={filename:'report.odp',destinationDirectory:'reports',outputExtension:'odp',fileBuffer:Buffer.from('test document')};
    const result=await savePopulatedDocument(options,ctx);assert.equal(result.path,'reports/report.odp');
    await assert.rejects(savePopulatedDocument({...options,fileBuffer:Buffer.from('changed')},ctx),error=>error.status===409);
    assert.equal(await fs.readFile(path.join(ctx.notebookDir,result.path),'utf8'),'test document');
    await assert.rejects(savePopulatedDocument({...options,destinationDirectory:'../../outside'},ctx));
    await assert.rejects(savePopulatedDocument({...options,filename:'bad.txt'},ctx));
    await assert.rejects(savePopulatedDocument({...options,fileBuffer:Buffer.alloc(0)},ctx));
    const outside=path.join(root,'outside');await fs.mkdir(outside);await fs.symlink(outside,path.join(ctx.notebookDir,'escape'));
    await assert.rejects(savePopulatedDocument({...options,destinationDirectory:'escape'},ctx));
    assert.deepEqual(await fs.readdir(outside),[]);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
