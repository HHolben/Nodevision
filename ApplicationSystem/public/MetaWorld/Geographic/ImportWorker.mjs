// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/ImportWorker.mjs
// This worker performs metadata inspection, bounded range-window imports, crop support validation, and compact recipe creation without blocking editor input.
import { openRangeRaster,readSmallAsset,sha256 } from './RangeSource.mjs';
import { rasterMetadata } from './RasterMetadata.mjs';
import { importCrop,importLandcover } from './WindowImport.mjs';
import { finishRecipe } from './RecipeV2.mjs';
self.onmessage=async({data})=>{
  try {
    if(data.op==='text'){self.postMessage({result:await readSmallAsset(data.path)});return;}
    if(data.op==='verify'){
      const asset=data.asset;
      if(asset.fingerprint){
        const source=await openRangeRaster(asset.path);
        for(const r of asset.fingerprint.ranges)if(await sha256(await source.readRange(r.offset,r.length))!==r.sha256)throw Error('Source changed: '+asset.path);
        if(source.stats().sourceBytes!==asset.fingerprint.size)throw Error('Source changed: '+asset.path);
      }else{
        const response=await fetch(asset.path,{cache:'no-store',redirect:'error'});
        if(!response.ok)throw Error('Source is missing or unavailable: '+asset.path);
        const reader=response.body.getReader(),parts=[];let size=0;
        while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16*1024**2){await reader.cancel();throw Error('Legacy source exceeds verification budget.');}parts.push(value);}
        const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
        if(await sha256(bytes)!==asset.sha256)throw Error('Source changed: '+asset.path);
      }
      self.postMessage({result:true});return;
    }
    const source=await openRangeRaster(data.path);
    if(data.op==='inspect'){self.postMessage({result:{...rasterMetadata(source.image),asset:await source.asset(),access:source.stats()}});return;}
    self.postMessage({progress:'Reading cropped elevation and interpolation halo…'});
    const imported=await importCrop(source,data.settings);let landcover=null;
    if(data.landcover){self.postMessage({progress:'Reading cropped land cover…'});const cover=await importLandcover(await openRangeRaster(data.landcover),imported.plan,undefined,imported.elevation.samples.length*2);landcover=cover.snapshot;data.settings.landcoverSource=cover.asset??null;data.settings.warnings=cover.warning?[cover.warning]:[];}
    self.postMessage({progress:'Checking crop elevation budget and encoding portable snapshots…'});
    self.postMessage({result:finishRecipe(imported,data.settings,landcover)});
  }catch(error){self.postMessage({error:error.message,diagnostic:error.diagnostic});}
};
