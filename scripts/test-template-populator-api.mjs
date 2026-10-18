// Nodevision/scripts/test-template-populator-api.mjs
// This integration check sends real multipart requests through the existing template router and verifies authentication and exclusive output creation.
import express from 'express';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import createTemplateRoutes from '../ApplicationSystem/Templates/TemplateRoutes.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'nv-populate-api-'));
const app=express();
app.use((req,res,next)=>{if(req.headers['x-test-auth'])req.identity={id:'test'};next();});
app.use('/api',createTemplateRoutes({notebookDir:root}));
const server=app.listen(0,'127.0.0.1');
try {
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const url=`http://127.0.0.1:${server.address().port}/api/templates/populate-save`;
  const bytes=await fs.readFile(new URL('./fixtures/template-populator/libreoffice-tdf129430.odp',import.meta.url));
  function form(){const data=new FormData();data.append('file',new Blob([bytes]),'filled.odp');data.append('filename','filled.odp');data.append('destinationDirectory','reports');data.append('outputExtension','odp');return data;}
  assert.equal((await fetch(url,{method:'POST',body:form()})).status,401);
  const saved=await fetch(url,{method:'POST',headers:{'x-test-auth':'1'},body:form()});assert.equal(saved.status,200);assert.equal((await saved.json()).path,'reports/filled.odp');
  assert.equal((await fetch(url,{method:'POST',headers:{'x-test-auth':'1'},body:form()})).status,409);
  assert.deepEqual(await fs.readFile(path.join(root,'reports/filled.odp')),bytes);
  assert.equal((await fetch(url,{method:'POST',headers:{'x-test-auth':'1'},body:new FormData()})).status,400);
  console.log('PASS: Template Populator multipart API authentication, save, collision, bytes, missing upload');
} finally {await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
