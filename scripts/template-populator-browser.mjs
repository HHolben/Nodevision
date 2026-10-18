// Nodevision/scripts/template-populator-browser.mjs
// Browser regressions exercise production ODP adapters and Session controls using a preserved LibreOffice-generated package.
import {discoverPlaceholders,validateAssignments,readAssignment,populateTemplate,savePopulatedDocument} from '/TemplateSystem/Population/TemplatePopulation.mjs';
import {NS,elements,parseXml,containRect} from '/TemplateSystem/Population/adapters/OdpXml.mjs';
import {openOdp} from '/TemplateSystem/Population/adapters/OdpAdapter.mjs';
import {pickNotebook,readNotebookFile} from '/TemplateSystem/Population/NotebookAssets.mjs';
import {startTemplatePopulator} from '/Sessions/TemplatePopulatorSession.mjs';
import {testTextPlaceholders} from '/text-tests.mjs';
let count=0;
const check=(condition,message)=>{if(!condition)throw Error(message);count++;};
async function rejects(action,pattern){try{await action();}catch(error){check(pattern.test(error.message),error.message);return;}throw Error('Expected rejection');}
const serialize=doc=>new XMLSerializer().serializeToString(doc);
try {
  const original=new Uint8Array(await (await fetch('/fixture.odp')).arrayBuffer()),base=await openOdp(original);
  check((await base.zip.file('meta.xml').async('string')).includes('LibreOfficeDev/7.3'),'Real LibreOffice fixture');
  const unchangedText=elements(base.content,'draw','text-box')[0].textContent;
  const presentation=elements(base.content,'office','presentation')[0],page=elements(base.content,'draw','page')[0];
  function frame(parent,name,split=false) {
    const node=base.content.createElementNS(NS.draw,'draw:frame');
    for(const [key,value] of Object.entries({x:2,y:3,width:8,height:4}))node.setAttributeNS(NS.svg,'svg:'+key,value+'cm');
    const box=base.content.createElementNS(NS.draw,'draw:text-box'),p=base.content.createElementNS(NS.text,'text:p');
    if(split){p.append('{{'+name.slice(0,2));const span=base.content.createElementNS(NS.text,'text:span');span.textContent=name.slice(2)+'}}';p.append(span);}else p.textContent='{{'+name+'}}';
    box.append(p);node.append(box);parent.insertBefore(node,parent.firstChild);return node;
  }
  frame(page,'Wide',true);
  const packageFor=async()=>{base.zip.file('content.xml',serialize(base.content));return {name:'template.odp',bytes:await base.zip.generateAsync({type:'uint8array'})};};
  const single=await packageFor();check((await discoverPlaceholders(single)).placeholders.length===1,'One split-run placeholder');
  const second=base.content.createElementNS(NS.draw,'draw:page');second.setAttributeNS(NS.draw,'draw:name','second');second.setAttributeNS(NS.draw,'draw:master-page-name','Default');presentation.insertBefore(second,page.nextSibling);
  frame(second,'Wide');frame(second,'Tall');
  const existing=base.content.createElementNS(NS.draw,'draw:frame'),existingImage=base.content.createElementNS(NS.draw,'draw:image');
  existingImage.setAttributeNS(NS.xlink,'xlink:href','Thumbnails/thumbnail.png');existing.append(existingImage);page.append(existing);
  const template=await packageFor(),discovery=await discoverPlaceholders(template);
  check(discovery.slideCount===2 && discovery.placeholders.length===2,'Multiple slides and unique names');
  check(discovery.placeholders.find(p=>p.name==='Wide').occurrences.length===2,'Repeated names grouped');
  check(!validateAssignments(discovery.placeholders,new Map()).valid,'Missing assignments blocked');
  await rejects(()=>populateTemplate(template,new Map()),/Assign an image/);
  async function image(width,height,type,name){const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').fillRect(0,0,width,height);return readAssignment(new File([await new Promise(r=>c.toBlob(r,type))],name));}
  const wide=await image(120,30,'image/png','wide.png'),tall=await image(20,100,'image/jpeg','tall.jpeg');
  const assignments=new Map([['Wide',wide],['Tall',tall]]);
  check(validateAssignments(discovery.placeholders,assignments).valid,'PNG and JPEG decoded');
  await rejects(()=>readAssignment(new File(['bad'],'fake.png')),/does not contain/);
  await rejects(()=>readAssignment(new File(['bad'],'fake.gif')),/PNG, JPG/);
  const result=await populateTemplate(template,assignments),bytes=new Uint8Array(await result.blob.arrayBuffer()),output=await openOdp(bytes);
  check(output.placeholders.length===0,'All placeholder text replaced');
  const images=elements(output.content,'draw','image'),embedded=images.filter(n=>n.getAttributeNS(NS.xlink,'href').startsWith('Pictures/nv-'));
  check(embedded.length===3,'Every occurrence embedded');
  const hrefs=embedded.map(n=>n.getAttributeNS(NS.xlink,'href'));check(new Set(hrefs).size===2,'Repeated images share package resource');
  for(const href of new Set(hrefs)) {
    const entry=elements(output.manifest,'manifest','file-entry').find(n=>n.getAttributeNS(NS.manifest,'full-path')===href);
    check(Boolean(entry),'Embedded resource in manifest');
    const expected=entry.getAttributeNS(NS.manifest,'media-type')==='image/png'?wide:tall;
    const actual=await output.zip.file(href).async('uint8array');check(actual.every((v,i)=>v===expected.bytes[i]) && actual.length===expected.bytes.length,'Embedded image bytes intact');
  }
  for(const node of embedded){const rect=node.parentElement;const w=parseFloat(rect.getAttributeNS(NS.svg,'width')),h=parseFloat(rect.getAttributeNS(NS.svg,'height'));check(w<=8 && h<=4,'Contain within bounds');check(Math.abs(parseFloat(rect.getAttributeNS(NS.svg,'x'))+w/2-6)<1e-7 && Math.abs(parseFloat(rect.getAttributeNS(NS.svg,'y'))+h/2-5)<1e-7,'Image centered');}
  check(containRect({x:2,y:3,width:8,height:4},wide).height===2,'Wide image ratio preserved');
  check(containRect({x:2,y:3,width:8,height:4},tall).width===.8,'Tall image ratio preserved');
  check(elements(output.content,'draw','text-box').some(n=>n.textContent===unchangedText),'Original unrelated text preserved');
  check(images.some(n=>n.getAttributeNS(NS.xlink,'href')==='Thumbnails/thumbnail.png'),'Original image reference preserved');
  for(const entry of Object.values(base.zip.files)){if(entry.dir || ['content.xml','META-INF/manifest.xml'].includes(entry.name))continue;const before=await entry.async('uint8array'),after=await output.zip.file(entry.name).async('uint8array');check(before.length===after.length && before.every((v,i)=>v===after[i]),'Original resource preserved: '+entry.name);}
  const view=new DataView(bytes.buffer);check(view.getUint16(8,true)===0 && view.getUint16(28,true)===0 && new TextDecoder().decode(bytes.slice(30,38))==='mimetype','ODF mimetype first, stored, no extra');
  check(new Uint8Array(await (await fetch('/fixture.odp')).arrayBuffer()).every((v,i)=>v===original[i]),'Source fixture immutable');
  await rejects(()=>discoverPlaceholders({name:'broken.odp',bytes:new Uint8Array([1,2])}),/ZIP/);
  const bad=new JSZip();bad.file('mimetype','wrong');await rejects(async()=>discoverPlaceholders({name:'bad.odp',bytes:await bad.generateAsync({type:'uint8array'})}),/not an ODP/);
  const rotated=frame(second,'Rotated');rotated.setAttributeNS(NS.draw,'draw:transform','rotate(0.5)');
  check((await discoverPlaceholders(await packageFor())).issues.some(i=>i.message.includes('rotated')),'Rotated frame reported');rotated.remove();
  const inline=frame(second,'Inline');elements(inline,'text','p')[0].append(' extra text');
  check((await discoverPlaceholders(await packageFor())).issues.length>0,'Inline placeholder reported');inline.remove();
  const table=base.content.createElementNS('urn:oasis:names:tc:opendocument:xmlns:table:1.0','table:table');
  const p=base.content.createElementNS(NS.text,'text:p');p.textContent='{{Unsupported}}';table.append(p);page.append(table);
  check((await discoverPlaceholders(await packageFor())).issues.length>0,'Non-frame placeholder reported');table.remove();
  frame(second,'Bad-name');check((await discoverPlaceholders(await packageFor())).issues.length>0,'Unsupported placeholder reported');
  await rejects(()=>populateTemplate(single,assignments,{fit:'cover'}),/Contain/);
  const invalid=base.zip;invalid.file('content.xml','<broken>');await rejects(async()=>discoverPlaceholders({name:'bad.odp',bytes:await invalid.generateAsync({type:'uint8array'})}),/invalid XML/);
  await fetch('/generated.odp',{method:'POST',body:result.blob});
  // Exercise real Session DOM file controls, failed replacement, clear, and reopen retention.
  let cleanup;const context={executionContext:{addCleanup:fn=>cleanup=fn,emit:()=>{}}};
  await startTemplatePopulator(context);
  const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI wait timed out');};
  function choose(input,file){const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change'));}
  choose(document.querySelector('input[type=file]'),new File([single.bytes],'single.odp'));
  await wait(()=>document.querySelector('fieldset'));
  choose(document.querySelector('fieldset input'),new File([wide.bytes],'wide.png'));await wait(()=>document.querySelector('fieldset img'));
  cleanup();await startTemplatePopulator(context);check(document.querySelector('fieldset').textContent.includes('wide.png'),'Assignments survive Session reopen');
  const beforeFetch=window.fetch;
  window.fetch=async()=>new Response(JSON.stringify({error:'That output already exists.'}),{status:409});
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Generate populated copy').click();
  await wait(()=>document.querySelector('[role=status]').textContent.includes('already exists'));
  check(Boolean(document.querySelector('fieldset img')),'Save collision preserves assignments');window.fetch=beforeFetch;
  choose(document.querySelector('input[type=file]'),new File(['bad'],'bad.odp'));await wait(()=>document.querySelector('[role=status]').textContent.includes('ZIP'));
  check(Boolean(document.querySelector('fieldset img')),'Invalid template preserves prior state');
  choose(document.querySelector('fieldset input'),new File(['bad'],'bad.png'));await wait(()=>document.querySelector('[role=status]').textContent.includes('does not contain'));
  check(Boolean(document.querySelector('fieldset img')),'Failed replacement preserves assignment');
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Clear').click();
  check([...document.querySelectorAll('button')].find(b=>b.textContent==='Generate populated copy').disabled,'Clear disables generation');
  choose(document.querySelector('input[type=file]'),new File([template.bytes],'multiple.odp'));await wait(()=>document.querySelectorAll('fieldset').length===2);
  check(!document.querySelector('fieldset img'),'Changing templates resets assignments');
  cleanup();
  const realFetch=window.fetch;let refreshed=false;
  document.addEventListener('refreshFileManager',()=>refreshed=true,{once:true});
  window.fetch=async(url,options)=>{check(url==='/api/templates/populate-save' && options.body instanceof FormData,'Existing template API save');return new Response(JSON.stringify({path:'out.odp'}),{status:200});};
  await savePopulatedDocument(result,{filename:'out.odp',directory:''});check(refreshed,'File Manager refreshed');
  window.fetch=async url=>url.startsWith('/api/files')?new Response(JSON.stringify([{name:'photo.png',path:'photo.png',isDirectory:false},{name:'ignored.txt',path:'ignored.txt',isDirectory:false}])):new Response(wide.blob);
  const pending=pickNotebook(document.body,{extensions:['png']});await wait(()=>[...document.querySelectorAll('dialog button')].some(b=>b.textContent==='photo.png'));
  check(!document.querySelector('dialog').textContent.includes('ignored.txt'),'Notebook picker filters unsupported files');
  [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='photo.png').click();check(await pending==='photo.png','Notebook selection returns path');
  check((await readAssignment(await readNotebookFile('photo.png'))).width===120,'Notebook image API returns readable asset');window.fetch=realFetch;
  const mixed=await testTextPlaceholders(original,wide,check,rejects);
  await startTemplatePopulator(context);
  choose(document.querySelector('input[type=file]'),new File([mixed.bytes],'mixed.odp'));await wait(()=>document.querySelectorAll('textarea').length===4);
  const textInput=[...document.querySelectorAll('textarea')].find(t=>t.parentElement.textContent.includes('ComponentName1'));
  check(textInput.value==='default stale','UI displays existing default text');
  textInput.value='';textInput.dispatchEvent(new Event('input'));check(document.querySelector('section').textContent.includes('Enter text for ComponentName1.'),'Blank UI text shows validation without losing focus');
  check(document.contains(textInput),'Typing does not rebuild text controls');textInput.value='U1';textInput.dispatchEvent(new Event('input'));
  cleanup();await startTemplatePopulator(context);
  check([...document.querySelectorAll('textarea')].some(t=>t.value==='U1'),'Text edits retained after Session reopen');cleanup();
  document.getElementById('result').textContent=`PASS: ${count} Template Populator checks`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
