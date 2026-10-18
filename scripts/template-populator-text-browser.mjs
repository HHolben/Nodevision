// Nodevision/scripts/template-populator-text-browser.mjs
// Named text regression cases derive mixed slides from a real LibreOffice document and verify editable text and exact frame properties.
import {discoverPlaceholders,populateTemplate,validateAssignments} from '/TemplateSystem/Population/TemplatePopulation.mjs';
import {openOdp} from '/TemplateSystem/Population/adapters/OdpAdapter.mjs';
import {NS,elements,textValue} from '/TemplateSystem/Population/adapters/OdpXml.mjs';
export async function testTextPlaceholders(original,image,check,rejects) {
  const source=await openOdp(original),doc=source.content,page=elements(doc,'draw','page')[0];
  const originalBox=elements(page,'draw','text-box')[0],originalText=originalBox.textContent;
  function add(name,text) {
    const frame=doc.createElementNS(NS.draw,'draw:frame');frame.setAttributeNS(NS.draw,'name',name);
    for(const [key,value] of Object.entries({x:2,y:3,width:5,height:2}))frame.setAttributeNS(NS.svg,'svg:'+key,value+'cm');
    frame.setAttributeNS(NS.draw,'style-name','NamedStyle');frame.setAttributeNS(NS.draw,'transform','rotate(0.2) translate(2cm 3cm)');
    const box=doc.createElementNS(NS.draw,'draw:text-box'),p=doc.createElementNS(NS.text,'text:p');p.setAttributeNS(NS.text,'style-name','P1');
    const span=doc.createElementNS(NS.text,'text:span');span.setAttributeNS(NS.text,'style-name','FirstRun');span.textContent=text;
    const stale=doc.createElementNS(NS.text,'text:span');stale.textContent=' stale';p.append(span,stale);box.append(p);frame.append(box);page.append(frame);return frame;
  }
  const first=add('ComponentName1','default'),repeat=add('ComponentName1','default'),last=add('ComponentName3','L74');
  const board=add('BoardID','old'),date=add('ReportDate','date');
  const style=doc.createElementNS(NS.style,'style:style');style.setAttributeNS(NS.style,'style:name','NamedStyle');style.setAttributeNS(NS.style,'style:family','graphic');
  const props=doc.createElementNS(NS.style,'style:graphic-properties');props.setAttributeNS(NS.draw,'draw:fill','solid');props.setAttributeNS(NS.draw,'draw:fill-color','#abcdef');style.append(props);elements(doc,'office','automatic-styles')[0].append(style);
  const character=doc.createElementNS(NS.style,'style:style');character.setAttributeNS(NS.style,'style:name','FirstRun');character.setAttributeNS(NS.style,'style:family','text');
  const font=doc.createElementNS(NS.style,'style:text-properties');font.setAttributeNS(NS.fo,'fo:font-weight','bold');font.setAttributeNS(NS.fo,'fo:font-size','18pt');character.append(font);elements(doc,'office','automatic-styles')[0].append(character);
  const picture=add('PictureObject','ignored');picture.removeAttributeNS(NS.draw,'transform');elements(picture,'text','p')[0].textContent='{{XRayMicrochip1}}';
  const second=page.cloneNode(false);second.setAttributeNS(NS.draw,'draw:name','second');page.parentElement.insertBefore(second,page.nextSibling);second.append(repeat);
  const attrs=frame=>Array.from(frame.attributes).map(a=>[a.namespaceURI,a.localName,a.value]).sort().toString();
  const firstAttrs=attrs(first),styleBefore=new XMLSerializer().serializeToString(style);
  async function template(){source.zip.file('content.xml',new XMLSerializer().serializeToString(doc));return {name:'mixed.odp',bytes:await source.zip.generateAsync({type:'uint8array'})};}
  const input=await template(),discovery=await discoverPlaceholders(input);
  check(discovery.placeholders.length===5,'Named text and image auto discovery');
  const component=discovery.placeholders.find(p=>p.name==='ComponentName1');
  check(component.type==='text' && component.occurrences.length===2,'Repeated named boxes grouped across slides');
  check(component.defaultText==='default stale','Default text independent of object name');
  const values=new Map([['ComponentName1','U1'],['ComponentName3','L74'],['BoardID','PCB-001  & <board>\nSecond\tline'],['ReportDate','2026-10-17'],['XRayMicrochip1',image]]);
  check(validateAssignments(discovery.placeholders,values).valid,'Mixed assignments validated');
  const missing=new Map(values);missing.delete('BoardID');check(!validateAssignments(discovery.placeholders,missing).valid,'Missing text blocked');
  missing.set('BoardID','  ');check(!validateAssignments(discovery.placeholders,missing).valid,'Blank text blocked');
  missing.set('BoardID','bad\u0000');check(!validateAssignments(discovery.placeholders,missing).valid,'Invalid XML text blocked');
  const defaults=new Map(values);defaults.set('ComponentName1','default stale');
  const unchanged=await openOdp(await (await populateTemplate(input,defaults)).blob.arrayBuffer());
  check(elements(unchanged.content,'draw','frame').filter(f=>f.getAttributeNS(NS.draw,'name')==='ComponentName1').every(f=>elements(f,'text','span').length===2),'Unchanged default preserves all rich runs');
  const result=await populateTemplate(input,values),output=await openOdp(await result.blob.arrayBuffer());
  const frames=elements(output.content,'draw','frame'),named=name=>frames.filter(f=>f.getAttributeNS(NS.draw,'name')===name);
  check(named('ComponentName1').every(f=>textValue(elements(f,'text','p')[0])==='U1'),'Repeated U1 replaces all stale runs');
  check(textValue(elements(named('ComponentName3')[0],'text','p')[0])==='L74','Different component receives L74');
  check(attrs(named('ComponentName1')[0])===firstAttrs,'Geometry rotation style and object name unchanged');
  check(elements(named('ComponentName1')[0],'text','p')[0].getAttributeNS(NS.text,'style-name')==='P1','Paragraph formatting retained');
  check(elements(named('ComponentName1')[0],'text','span')[0].getAttributeNS(NS.text,'style-name')==='FirstRun','First character style retained');
  check(elements(named('BoardID')[0],'text','p').map(textValue).join('\n')===values.get('BoardID'),'Multiline spaces tabs and XML characters round trip');
  check(elements(output.content,'style','style').some(s=>new XMLSerializer().serializeToString(s)===styleBefore),'Frame style definition preserved');
  check(elements(output.content,'draw','text-box').some(b=>b.textContent===originalText),'Unnamed text remains unchanged');
  check(elements(named('PictureObject')[0],'draw','image').length===1,'Image convention takes precedence over object name');
  check(elements(doc,'draw','text-box').some(b=>b.textContent==='default stale'),'Source DOM remains unchanged');
  await fetch('/generated.odp',{method:'POST',body:result.blob});
  elements(repeat,'text','p')[0].textContent='different';
  check((await discoverPlaceholders(await template())).placeholders.find(p=>p.name==='ComponentName1').defaultConflict,'Differing duplicate defaults require explicit input');
  add('XRayMicrochip1','conflict');const conflicting=await template();
  check((await discoverPlaceholders(conflicting)).issues.some(i=>i.message.includes('Conflicting')),'Cross-type name conflicts reported');
  await rejects(()=>populateTemplate(conflicting,values),/Conflicting/);
  const bad=add('Bad name','text');check((await discoverPlaceholders(await template())).issues.some(i=>i.message.includes('Unrecognized')),'Invalid object names reported');bad.remove();
  const linked=add('Linked','text');elements(linked,'text','p')[0].append(doc.createElementNS(NS.text,'text:a'));
  check((await discoverPlaceholders(await template())).issues.some(i=>i.message.includes('links')),'Unsupported rich text objects reported');
  const shape=doc.createElementNS(NS.draw,'draw:custom-shape');shape.setAttributeNS(NS.draw,'draw:name','ShapeName');const paragraph=doc.createElementNS(NS.text,'text:p');paragraph.textContent='shape';shape.append(paragraph);page.append(shape);
  check((await discoverPlaceholders(await template())).issues.some(i=>i.message.includes('use a text box')),'Named text-bearing shapes reported');
  return input;
}
