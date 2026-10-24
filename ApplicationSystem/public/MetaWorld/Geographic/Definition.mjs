// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Definition.mjs
// This module validates portable geographic recipes and prepares conservative regional crop dimensions before the shared world authoring path may allocate terrain.
import { validateRecipeV2 } from './RecipeV2.mjs';
import { insideGeometry } from './CropGeometry.mjs';
import { rasterPoint } from './Coordinates.mjs';
import { project, unproject, sampleRaster, inPolygon } from './Coordinates.mjs';
import { DEFAULT_MAPPING, GEOGRAPHIC_BIOMES } from './Biomes.mjs';
export function assetReference(path) {
  if(typeof path!=='string'||!path.startsWith('/Notebook/')||/[?#\\]/.test(path)||decodeURIComponent(path).split('/').some(p=>['.','..'].includes(p)))throw Error('Select a portable /Notebook/ asset reference.');
  return path;
}
export function prepareGeographic({elevation,landcover=null,kml=null,regions=[],crop,boundary='',horizontalScale=1,verticalExaggeration=1,verticalOffset,defaultBiome='temperate',mapping=DEFAULT_MAPPING,detail=false,attribution=''}) {
  crop=crop.map(Number);horizontalScale=Number(horizontalScale);verticalExaggeration=Number(verticalExaggeration);
  if(crop.length!==4||!crop.every(Number.isFinite)||crop[0]<18||crop[2]>24||crop[1]<0||crop[3]>84||crop[0]>=crop[2]||crop[1]>=crop[3])throw Error('Crop must be west,south,east,north within UTM zone 34N (18–24°E, 0–84°N).');
  if(!(horizontalScale>0&&horizontalScale<=10&&verticalExaggeration>0&&verticalExaggeration<=10))throw Error('Scale and exaggeration must be positive and at most 10.');
  const corners=[[crop[0],crop[1]],[crop[0],crop[3]],[crop[2],crop[1]],[crop[2],crop[3]]].map(project);
  const origin=[Math.min(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
  const meters=[Math.max(...corners.map(p=>p[0]))-origin[0],origin[1]-Math.min(...corners.map(p=>p[1]))];
  if(meters.some(v=>v>2000))throw Error('Geographic crops are limited to 2 km per axis.');
  const size=meters.map(v=>Math.ceil(v*horizontalScale*4)/4);
  if(size.some(v=>v<1||v>512))throw Error('Resulting horizontal dimensions must be 1–512 m. Reduce crop or horizontal scale.');
  if(elevation.invalid)throw Error('Elevation contains NoData. This iteration requires a cropped raster with complete valid coverage; fill gaps externally or supply a smaller raster.');
  const offset=verticalOffset===undefined||verticalOffset===''?1-elevation.min*verticalExaggeration:Number(verticalOffset);
  const low=elevation.min*verticalExaggeration+offset,high=elevation.max*verticalExaggeration+offset+(detail?.25:0);
  if(!Number.isFinite(offset)||low<.25||high+20>256)throw Error('Elevation plus offset needs positive ground and 20 m vegetation headroom within 256 m. Reduce exaggeration or crop the source raster; adjust vertical offset.');
  const g={version:1,projection:'EPSG:32634',origin,geographicOrigin:unproject(origin),crop,boundary,regions,horizontalScale,verticalExaggeration,verticalOffset:offset,defaultBiome,mapping:{...mapping},detail:!!detail,attribution:String(attribution),elevation,landcover,kml,size:[size[0],Math.ceil((high+20)*4)/4,size[1]]};
  validateGeographic({terrainSource:'geographic',geographic:g,size:g.size});
  // Check the full crop edge in projection space; no edge clamping or invented elevations.
  for(let i=0;i<=128;i++)for(const p of [[crop[0]+(crop[2]-crop[0])*i/128,crop[1]],[crop[0]+(crop[2]-crop[0])*i/128,crop[3]],[crop[0],crop[1]+(crop[3]-crop[1])*i/128],[crop[2],crop[1]+(crop[3]-crop[1])*i/128]])if(sampleRaster(elevation,...project(p))===null)throw Error('Crop extends outside valid elevation sample centers. Inset the crop or supply a larger raster.');
  let covered=false;
  for(let z=0;z<64&&!covered;z++)for(let x=0;x<64&&!covered;x++)covered=insideCrop(g,geographicPoint(g,x/64*g.size[0]*4,z/64*g.size[2]*4));
  if(!covered)throw Error('Selected polygon has no usable area within the crop. Choose another boundary or crop.');
  return g;
}
export function geographicPoint(g,x,z) {
  return [g.origin[0]+(x+.5)*.25/g.horizontalScale,g.origin[1]-(z+.5)*.25/g.horizontalScale];
}
export function insideCrop(g,p) {
  if(g.version===2)return insideGeometry(rasterPoint(g.elevation,...p),g.effectiveRaster);
  const [lon,lat]=unproject(p),b=g.crop;
  if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])return false;
  const polygon=g.regions.find(r=>r.id===g.boundary);
  return !polygon||inPolygon(p,polygon);
}
export function validateGeographic(def) {
  if(def.terrainSource!==undefined&&!['procedural','geographic'].includes(def.terrainSource))throw Error('Unsupported terrain source.');
  if(def.terrainSource!=='geographic')return;
  const g=def.geographic;
  if(g?.version===2)return validateRecipeV2(def);
  if(!g||g.version!==1||g.projection!=='EPSG:32634')throw Error('Unsupported geographic recipe. Restore or reimport the source.');
  if(!GEOGRAPHIC_BIOMES.includes(g.defaultBiome)||!g.mapping||Object.values(g.mapping).some(b=>!GEOGRAPHIC_BIOMES.includes(b)))throw Error('Unknown geographic biome mapping.');
  if(Object.keys(g.mapping).some(k=>!/^\d+$/.test(k)))throw Error('Land-cover mapping keys must be integer class codes.');
  if(g.landcover?.data?.some(v=>v!==null&&(!Number.isInteger(v)||v<0)))throw Error('Land-cover samples must be nonnegative integer class codes or NoData.');
  for(const r of [g.elevation,g.landcover].filter(Boolean)) {
    assetReference(r.asset?.path);
    if(!/^[a-f0-9]{64}$/.test(r.asset?.sha256))throw Error('Missing raster fingerprint. Reimport the source.');
    if(![4326,32634].includes(r.crs)||![0,.5].includes(r.offset)||!Number.isInteger(r.width)||!Number.isInteger(r.height)||r.width<2||r.height<2||r.width*r.height>262144||!Array.isArray(r.data)||r.data.length!==r.width*r.height||r.data.some(v=>v!==null&&!Number.isFinite(v)))throw Error('Invalid bounded raster snapshot.');
    if(r.origin?.length!==2||r.resolution?.length!==2||![...r.origin,...r.resolution].every(Number.isFinite)||r.resolution[0]<=0||r.resolution[1]>=0)throw Error('Invalid raster transform.');
  }
  if(!g.elevation||g.elevation.data.some(v=>v===null))throw Error('Elevation snapshot is missing or incomplete. Reimport a fully covered crop.');
  if(g.kml)assetReference(g.kml.path);
  const span=g.size?.[1];
  if(typeof g.detail!=='boolean'||g.elevation.data.some(v=>v*g.verticalExaggeration+g.verticalOffset<.25||v*g.verticalExaggeration+g.verticalOffset+(g.detail?.25:0)+20>span))throw Error('Saved elevation exceeds its supported vertical span. Reimport with a smaller exaggeration.');
  if(!Array.isArray(g.regions)||g.regions.length>64||g.regions.some(r=>!Array.isArray(r.rings)||!r.rings.length||r.rings.some(ring=>ring.length<4||ring.length>4096||ring.some(p=>p.length!==2||!p.every(Number.isFinite)))||(r.biome&&!GEOGRAPHIC_BIOMES.includes(r.biome))))throw Error('Invalid geographic polygon snapshot.');
  if(g.boundary&&!g.regions.some(r=>r.id===g.boundary))throw Error('Selected crop polygon is missing.');
  if(g.origin?.length!==2||!g.origin.every(Number.isFinite)||g.crop?.length!==4||!g.crop.every(Number.isFinite)||![g.horizontalScale,g.verticalExaggeration].every(n=>Number.isFinite(n)&&n>0&&n<=10)||!Number.isFinite(g.verticalOffset))throw Error('Invalid geographic placement.');
  if(g.crop[0]<18||g.crop[2]>24||g.crop[1]<0||g.crop[3]>84||g.crop[0]>=g.crop[2]||g.crop[1]>=g.crop[3])throw Error('Invalid geographic crop.');
  const corners=[[g.crop[0],g.crop[1]],[g.crop[0],g.crop[3]],[g.crop[2],g.crop[1]],[g.crop[2],g.crop[3]]].map(project);
  const west=Math.min(...corners.map(p=>p[0])),north=Math.max(...corners.map(p=>p[1]));
  const extent=[Math.max(...corners.map(p=>p[0]))-west,north-Math.min(...corners.map(p=>p[1]))];
  if(extent.some(n=>n>2000)||Math.abs(g.origin[0]-west)>1e-6||Math.abs(g.origin[1]-north)>1e-6||extent.some((n,i)=>Math.ceil(n*g.horizontalScale*4)/4!==g.size?.[i===0?0:2]))throw Error('Saved crop, origin, scale and dimensions disagree. Reimport the source.');
  if(def.environment||(def.heightLimits&&def.heightLimits.min!==0))throw Error('Geographic terrain uses its saved vertical offset and no procedural environment.');
  if(!Array.isArray(g.size)||g.size.length!==3||g.size.some((n,i)=>!Number.isFinite(n)||!Number.isInteger(n*4)||n<1||n>(i===1?256:512)||n!==def.size?.[i]))throw Error('Geographic dimensions differ from the imported preview. Reimport explicitly.');
}
