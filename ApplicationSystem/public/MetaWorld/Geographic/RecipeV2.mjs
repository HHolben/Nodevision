// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/RecipeV2.mjs
// This module finalizes and validates version-two cropped recipes, separating selected-surface elevation limits from source metadata and retaining compact snapshots independent of the original files.
import { GEO_BUDGETS as B } from './Budgets.mjs';
import { unproject } from './Coordinates.mjs';
import { rasterData } from './Snapshot.mjs';
import { DEFAULT_MAPPING,GEOGRAPHIC_BIOMES } from './Biomes.mjs';
import { notebookPath } from './RangeSource.mjs';
export function finishRecipe(imported,settings,landcover=null) {
  const {plan,range,elevation}=imported,scale=Number(settings.horizontalScale??1),exaggeration=Number(settings.verticalExaggeration??1),detail=!!settings.detail;
  if(![scale,exaggeration].every(n=>Number.isFinite(n)&&n>0&&n<=10))throw Error('Scale and exaggeration must be positive and at most 10.');
  const b=plan.bounds,meters=[b[2]-b[0],b[3]-b[1]],size=meters.map(v=>Math.ceil(v*scale*4)/4);
  if(meters.some(n=>n>B.extentMeters)||size.some(n=>n<1||n>B.worldMeters))throw Error('The local-projection envelope supports up to 20 km per geographic axis within the engine’s one-million-meter coordinate envelope. Select a smaller region or horizontal scale.');
  const verticalOffset=settings.verticalOffset===undefined||settings.verticalOffset===''?1-range.min*exaggeration:Number(settings.verticalOffset);
  const low=range.min*exaggeration+verticalOffset,high=range.max*exaggeration+verticalOffset+(detail?.25:0);
  if(!Number.isFinite(verticalOffset)||low<.25||high+20>256)throw Object.assign(Error(`Selected elevation bound: ${range.min.toFixed(3)}–${range.max.toFixed(3)} m (${(range.max-range.min).toFixed(3)} m relief). Available ground relief is ${235-(detail?.25:0)} m within the 256 m vertical span and 20 m headroom. Use vertical exaggeration ≤ ${Math.min(10,(235-(detail?.25:0))/Math.max(.001,range.max-range.min)).toFixed(4)}, reset the offset, or select a smaller crop.`),{diagnostic:{...plan,range}});
  const origin=[b[0],b[3]],g={version:2,projection:'EPSG:32634',origin,geographicOrigin:unproject(origin),crop:settings.crop.map(Number),fitCoverage:!!settings.fitCoverage,
    boundary:settings.boundary??'',regions:settings.regions??[],effective:plan.effective,effectiveRaster:plan.local,sourceCoverage:plan.source,range,geographicSize:meters,
    horizontalScale:scale,verticalExaggeration:exaggeration,verticalOffset,defaultBiome:settings.defaultBiome??'temperate',mapping:{...(settings.mapping??DEFAULT_MAPPING)},detail,
    attribution:settings.attribution??'',elevation,landcover,landcoverSource:settings.landcoverSource??null,warnings:settings.warnings??[],kml:settings.kml??null,size:[size[0],Math.ceil((high+20)*4)/4,size[1]],access:imported.access};
  const bytes=JSON.stringify(g).length;if(bytes>B.snapshotBytes)throw Error('Saved crop recipe exceeds the 24 MiB snapshot budget. Reduce the crop or land-cover resolution.');
  g.savedBytes=bytes;validateRecipeV2({geographic:g,size:g.size});return g;
}
export function validateRecipeV2(def) {
  const g=def.geographic;
  if(!g||g.version!==2||g.projection!=='EPSG:32634')throw Error('Unsupported geographic recipe.');
  if(g.size?.length!==3||g.size.some((n,i)=>!Number.isFinite(n)||n<1||!Number.isInteger(n*4)||n>(i===1?256:B.worldMeters)||n!==def.size?.[i]))throw Error('Invalid geographic dimensions.');
  if(g.origin?.length!==2||!g.origin.every(Number.isFinite)||![g.horizontalScale,g.verticalExaggeration].every(n=>Number.isFinite(n)&&n>0&&n<=10)||!Number.isFinite(g.verticalOffset))throw Error('Invalid geographic placement.');
  if(!GEOGRAPHIC_BIOMES.includes(g.defaultBiome)||!g.mapping||Object.values(g.mapping).some(v=>!GEOGRAPHIC_BIOMES.includes(v)))throw Error('Unknown geographic biome.');
  for(const geometry of [g.effectiveRaster,g.effective])if(!Array.isArray(geometry)||!geometry.length||geometry.length>256||geometry.some(p=>!p.length||p.some(r=>r.length<4||r.length>65536||r.some(v=>v.length!==2||!v.every(Number.isFinite)))))throw Error('Invalid saved crop geometry.');
  for(const r of [g.elevation,g.landcover].filter(Boolean)){
    notebookPath(r.asset?.path);
    if(!/^[a-f0-9]{64}$/.test(r.asset?.sha256)||![4326,32634].includes(r.crs)||![0,.5].includes(r.offset)||!Number.isInteger(r.width)||!Number.isInteger(r.height)||r.width<(r===g.elevation?2:1)||r.height<(r===g.elevation?2:1)||r.width*r.height>B.samples)throw Error('Invalid cropped raster metadata.');
    if(r.origin?.length!==2||r.sourceOrigin?.length!==2||r.resolution?.length!==2||![...r.origin,...r.sourceOrigin,...r.resolution].every(Number.isFinite)||r.resolution[0]<=0||r.resolution[1]>=0||r.window?.length!==4||!r.window.every(Number.isInteger))throw Error('Invalid cropped raster georeference.');
    if(r.window[2]-r.window[0]!==r.width||r.window[3]-r.window[1]!==r.height||r.window.some(n=>n<0))throw Error('Cropped window dimensions disagree.');
    const values=rasterData(r);
    if(r===g.elevation&&!values.some(Number.isFinite))throw Error('Elevation snapshot has no valid support.');
    if(r===g.elevation&&values.some(v=>Number.isFinite(v)&&(v*g.verticalExaggeration+g.verticalOffset<.25||v*g.verticalExaggeration+g.verticalOffset+(g.detail?.25:0)+20>g.size[1])))throw Error('Cropped elevation exceeds the saved vertical budget.');
  }
  if(!g.elevation||!g.range||!Number.isFinite(g.range.min)||!Number.isFinite(g.range.max))throw Error('Missing cropped elevation.');
}
