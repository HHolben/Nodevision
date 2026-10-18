// Nodevision/ApplicationSystem/public/TemplateSystem/Population/TemplatePopulation.mjs
// This format-independent service dispatches template discovery and population to registered adapters, validates image assignments, and saves new documents through the existing template API.
import {odpAdapter} from './adapters/OdpAdapter.mjs';
import {refreshNotebookDirectory} from '../TemplateApi.mjs';
const adapters=new Map();
export function registerTemplateAdapter(adapter) {for(const extension of adapter.extensions)adapters.set(extension.toLowerCase(),adapter);}
registerTemplateAdapter(odpAdapter);
function adapterFor(template) {
  const extension=template.name.split('.').pop().toLowerCase(),adapter=adapters.get(extension);
  if(!adapter)throw Error(`Unsupported template format: .${extension}`);
  return adapter;
}
export async function discoverPlaceholders(template) {return adapterFor(template).discover(template);}
export function validateAssignments(placeholders,assignments,issues=[]) {
  const errors=issues.map(issue=>`${issue.slide?'Slide '+issue.slide+': ':''}${issue.message}`);
  if(!placeholders.length)errors.push('No supported placeholders were found.');
  for(const placeholder of placeholders) {
    const image=assignments.get(placeholder.name);
    if(placeholder.type==='text') {
      if(typeof image!=='string' || !image.trim())errors.push(`Enter text for ${placeholder.name}.`);
      else if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(image))errors.push(`Text for ${placeholder.name} contains invalid XML characters.`);
      continue;
    }
    if(!image)errors.push(`Assign an image to ${placeholder.name}.`);
    else if(!image.bytes?.byteLength || !['image/png','image/jpeg'].includes(image.mimeType) || !(image.width>0 && image.height>0))errors.push(`Unreadable or unsupported image for ${placeholder.name}.`);
  }
  return {valid:!errors.length,errors};
}
export async function readAssignment(file) {
  if(!/\.(png|jpe?g)$/i.test(file.name))throw Error('Select a PNG, JPG or JPEG image.');
  if(!file.size || file.size>20*1024*1024)throw Error('Images must contain data and be smaller than 20 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const png=[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value),jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(!png && !jpeg)throw Error('The selected file does not contain PNG or JPEG data.');
  const mimeType=png?'image/png':'image/jpeg',blob=new Blob([bytes],{type:mimeType});
  let image;
  try {image=await createImageBitmap(blob);} catch {throw Error('The image could not be decoded. Choose a readable PNG or JPEG.');}
  const {width,height}=image;image.close();
  if(!width || !height || width*height>50_000_000)throw Error('Images must be smaller than 50 megapixels.');
  return {name:file.name,bytes,blob,mimeType,extension:png?'png':'jpg',width,height,fit:'contain'};
}
export async function populateTemplate(template,assignments,options={}) {
  const discovery=await discoverPlaceholders(template);
  const result=validateAssignments(discovery.placeholders,assignments,discovery.issues);
  if(!result.valid)throw Error(result.errors.join('\n'));
  return adapterFor(template).populate(template,assignments,options);
}
export async function savePopulatedDocument(result,destination,{signal}={}) {
  const form=new FormData();form.append('file',result.blob,'populated.'+result.extension);
  form.append('filename',destination.filename);form.append('destinationDirectory',destination.directory||'');
  form.append('outputExtension',result.extension);
  const response=await fetch('/api/templates/populate-save',{method:'POST',body:form,signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error || `Unable to save (${response.status}).`);
  // A refresh failure must not turn a successful exclusive write into a retry.
  try {await refreshNotebookDirectory(destination.directory);} catch { /* The file is visible on the next File Manager refresh. */ }
  return data;
}
