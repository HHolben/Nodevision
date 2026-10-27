// Serializes server saves to a path; optional SHA-256 precondition and atomic single-file replacement.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePayloadToFile} from './writePayload.js';
const pending=new Map();
export async function guardedWrite(payload,expectedSha256){
 const {filePath}=payload,previous=pending.get(filePath)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  if(expectedSha256===undefined)return writePayloadToFile(payload);
  if(expectedSha256!==null&&!/^[a-f0-9]{64}$/.test(expectedSha256))throw Object.assign(Error('Invalid source revision'),{code:'REVISION_CONFLICT'});
  let current=null;try{current=createHash('sha256').update(await fs.readFile(filePath)).digest('hex');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(current!==expectedSha256)throw Object.assign(Error('Source changed since editing began; reload or save a unique copy'),{code:'REVISION_CONFLICT'});
  await writePayloadToFile(payload);
 });pending.set(filePath,task);try{return await task;}finally{if(pending.get(filePath)===task)pending.delete(filePath);}
}
