import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {guardedWrite} from './conditionalWrite.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'construction-write-')),filePath=path.join(dir,'asset.gox'),hash=s=>createHash('sha256').update(s).digest('hex');
try{await guardedWrite({filePath,content:'old'},null);await assert.rejects(()=>guardedWrite({filePath,content:'bad'},null),/changed/);await assert.rejects(()=>guardedWrite({filePath,content:'bad'},'0'.repeat(64)),/changed/);assert.equal(await fs.readFile(filePath,'utf8'),'old');
 const results=await Promise.allSettled([guardedWrite({filePath,content:'new'},hash('old')),guardedWrite({filePath,content:'lost'},hash('old'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await fs.readFile(filePath,'utf8'),'new');assert.equal((await fs.readdir(dir)).length,1);
 await guardedWrite({filePath,content:Buffer.from([0,1,255]).toString('base64'),encoding:'base64'},hash('new'));assert.deepEqual([...await fs.readFile(filePath)],[0,1,255]);
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('Conditional source replacement, concurrent writer conflict and binary atomic save passed');
