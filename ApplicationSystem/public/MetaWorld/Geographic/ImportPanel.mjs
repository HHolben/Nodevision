// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/ImportPanel.mjs
// This shared controller inspects source metadata, offers explicit crop fitting, and commits only the current cancellable worker preview to either voxel-world insertion entry point.
import { importControls } from './ImportControls.mjs';
import { ImportJobs } from './ImportJobs.mjs';
import { drawCropPreview,showRecipe } from './CropPreview.mjs';
import { geographicBounds,rectangle,transformGeometry } from './CropGeometry.mjs';
import { project,unproject } from './Coordinates.mjs';
import { parseRegions } from './KmlRegions.mjs';
export function mountGeographicPanel(form,values) {
  const old=values.geographic,jobs=new ImportJobs();let snapshot=old??null,metadata=null,regions=old?.regions??[],disposed=false,busy=false,explicit=!!old,fitCoverage=old?.fitCoverage??false;
  const ui=importControls(form,old,invalidate),{host,controls,buttons,status}=ui;
  const preview=buttons['Import / Preview'],stop=buttons['Cancel import'];stop.disabled=true;
  function invalidate(key){
    jobs.cancel('Settings changed. Preview again.');snapshot=null;busy=false;preview.disabled=false;stop.disabled=true;
    if(key==='crop'){explicit=!!controls.crop.value.trim();fitCoverage=false;}
    if(key==='elevation')metadata=null;
    if(key==='boundary'&&!explicit){const polygon=regions.find(r=>r.id===controls.boundary.value);controls.crop.value=polygon?geographicBounds([polygon.rings]).join(','):'';}
    status.textContent='Settings changed. Import / Preview before placement.';
  }
  function begin(){jobs.cancel();busy=true;stop.disabled=false;snapshot=null;return jobs.revision;}
  const current=revision=>!disposed&&jobs.revision===revision;
  stop.onclick=()=>{jobs.cancel();busy=false;stop.disabled=true;preview.disabled=false;status.textContent='Import cancelled.';};
  function valuesNow(){return Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c.type==='checkbox'?c.checked:c.value]));}
  async function inspect(revision) {
    metadata=await jobs.read({op:'inspect',path:controls.elevation.value});if(!current(revision))return;
    let kml=null;
    if(controls.kml.value){const file=await jobs.read({op:'text',path:controls.kml.value});if(!current(revision))return;regions=parseRegions(file.text);kml=file.asset;}else regions=[];
    const selected=controls.boundary.value;controls.boundary.replaceChildren(new Option('No polygon',''),...regions.map(r=>new Option(r.name,r.id)));controls.boundary.value=selected;
    return kml;
  }
  function centerCrop(){
    const b=metadata.bounds,center=project([(b[0]+b[2])/2,(b[1]+b[3])/2]);
    const geo=geographicBounds(rectangle([center[0]-64,center[1]-64,center[0]+64,center[1]+64]));
    return [Math.max(geo[0],b[0]+(b[2]-b[0])*.05),Math.max(geo[1],b[1]+(b[3]-b[1])*.05),Math.min(geo[2],b[2]-(b[2]-b[0])*.05),Math.min(geo[3],b[3]-(b[3]-b[1])*.05)];
  }
  preview.onclick=async()=>{
    const revision=begin();status.textContent='Inspecting source metadata and range support…';
    try{
      const kml=await inspect(revision);if(!current(revision))return;
      const requested=valuesNow(),polygon=regions.find(r=>r.id===requested.boundary);
      const crop=requested.crop.trim()?requested.crop.split(',').map(Number):polygon?geographicBounds([polygon.rings]):centerCrop();
      const settings={...requested,crop,regions,kml,fitCoverage,mapping:JSON.parse(requested.mapping)};
      const result=await jobs.read({op:'prepare',path:requested.elevation,landcover:requested.landcover,settings},text=>{if(current(revision))status.textContent=text;});
      if(!current(revision))return;snapshot=result;controls.crop.value=crop.join(',');showRecipe(ui,result);
    }catch(error){if(current(revision)){status.textContent=error.message;if(error.diagnostic)drawCropPreview(ui.canvas,{...error.diagnostic,boundary:regions.find(r=>r.id===controls.boundary.value)},metadata);}}
    finally{if(current(revision)){busy=false;stop.disabled=true;preview.disabled=false;}}
  };
  async function fit(action){
    invalidate();const revision=jobs.revision;
    try{
      if(!metadata){busy=true;stop.disabled=false;await inspect(revision);if(!current(revision))return;}
      if(action==='source'){controls.crop.value=metadata.bounds.join(',');fitCoverage=true;explicit=true;}
      if(action==='polygon'){const p=regions.find(r=>r.id===controls.boundary.value);if(!p)throw Error('Select a KML crop polygon first.');controls.crop.value=geographicBounds([p.rings]).join(',');fitCoverage=false;explicit=false;}
      if(action==='coverage')fitCoverage=true;
      status.textContent='Crop updated. Import / Preview validates resource and elevation budgets.';
    }catch(error){if(current(revision))status.textContent=error.message;}finally{if(current(revision)){busy=false;stop.disabled=true;}}
  }
  buttons['Fit to source'].onclick=()=>fit('source');buttons['Fit bounds to polygon'].onclick=()=>fit('polygon');buttons['Fit to available coverage'].onclick=()=>fit('coverage');
  buttons['Reset crop'].onclick=()=>{controls.crop.value='';explicit=false;fitCoverage=false;invalidate();};
  if(old){
    showRecipe(ui,old);const verify=document.createElement('button');verify.type='button';verify.textContent='Verify saved source files';host.append(verify);
    verify.onclick=async()=>{
      jobs.cancel();const revision=jobs.revision;busy=true;stop.disabled=false;
      try{for(const asset of [old.elevation.asset,old.landcover?.asset??old.landcoverSource,old.kml].filter(Boolean))await jobs.read({op:'verify',asset});if(current(revision))status.textContent='Saved sources match their fingerprints. The saved snapshot remains active.';}
      catch(error){if(current(revision))status.textContent=error.message+' The saved snapshot remains usable. Restore the source or explicitly reimport.';}
      finally{if(current(revision)){busy=false;stop.disabled=true;}}
    };
  }
  return {host,get(){if(busy||!snapshot)throw Error('Import / Preview geographic terrain before placement.');return snapshot;},dispose(){disposed=true;jobs.cancel();}};
}
