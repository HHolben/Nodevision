// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/conditionalWrite.mjs
// This module serializes competing saves to the same file and applies optional content preconditions. It coordinates atomic replacement with the existing payload writer to protect Notebook data from partial or conflicting writes.
// Serializes server saves to a path; optional SHA-256 precondition and atomic single-file replacement.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePayloadToFile} from './writePayload.js';
const pending=new Map();
export async function withFileWriteLock(filePath,operation){
 const previous=pending.get(filePath)||Promise.resolve(),task=previous.catch(()=>{}).then(operation);pending.set(filePath,task);try{return await task;}finally{if(pending.get(filePath)===task)pending.delete(filePath);}
}
export async function guardedWrite(payload,expectedSha256){
 const {filePath}=payload;return withFileWriteLock(filePath,async()=>{
  if(expectedSha256===undefined)return writePayloadToFile(payload);
  if(expectedSha256!==null&&!/^[a-f0-9]{64}$/.test(expectedSha256))throw Object.assign(Error('Invalid source revision'),{code:'REVISION_CONFLICT'});
  let current=null;try{current=createHash('sha256').update(await fs.readFile(filePath)).digest('hex');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(current!==expectedSha256)throw Object.assign(Error('Source changed since editing began; reload or save a unique copy'),{code:'REVISION_CONFLICT'});
  await writePayloadToFile(payload);
 });
}
