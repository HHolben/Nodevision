// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/CropPreview.mjs
// This module draws source coverage, requested and effective terrain boundaries, holes and NoData diagnostics beside a crop-specific elevation and memory summary.
import { geometryBounds,rectangle,transformGeometry,rasterToMeters } from './CropGeometry.mjs';
import { geographicPoint,insideCrop } from './Definition.mjs';
import { project,sampleRaster } from './Coordinates.mjs';
export function drawCropPreview(canvas,view,metadata) {
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  const geometries=[view.source,view.requested,view.effective].filter(g=>g?.length);if(!geometries.length)return;
  const b=geometryBounds(geometries.flat()),scale=Math.min((canvas.width-20)/(b[2]-b[0]),(canvas.height-30)/(b[3]-b[1]));
  const point=([x,y])=>[10+(x-b[0])*scale,10+(b[3]-y)*scale];
  function draw(g,color,fill){if(!g?.length)return;ctx.beginPath();for(const p of g)for(const r of p){r.forEach((v,i)=>{const [x,y]=point(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.strokeStyle=color;ctx.fillStyle=fill;ctx.fill('evenodd');ctx.stroke();}
  draw(view.source,'#777','#ddd');draw(view.requested,'#c76b00','#ffa50022');draw(view.effective,'#087d32','#17ae6655');
  if(view.boundary)draw([view.boundary.rings],'#7433ad','#7433ad11');
  ctx.fillStyle='#d00000';if(metadata&&view.missing)for(const p of view.missing){const meters=rasterToMeters(metadata,[p[0]+(view.window?.[0]??0),p[1]+(view.window?.[1]??0)]),[x,y]=point(meters);ctx.fillRect(x-2,y-2,4,4);}
  ctx.fillStyle='#222';ctx.font='11px sans-serif';ctx.fillText('Gray: source   Orange: request   Green: terrain   Red: NoData',5,canvas.height-3);
}
export function showRecipe(ui,g) {
  const e=g.elevation,source=e.source??e,range=g.range??{min:e.min,max:e.max},mid=[(source.bounds[0]+source.bounds[2])/2,(source.bounds[1]+source.bounds[3])/2],p0=project(mid);
  const resolution=e.crs===32634?e.resolution.map(Math.abs):e.resolution.map((v,i)=>{const p=project(mid.map((n,j)=>n+(i===j?v:0)));return Math.hypot(p[0]-p0[0],p[1]-p0[1]);});
  ui.status.textContent=`Ready. Recipe version ${g.version}\nSource coverage: ${source.bounds.join(', ')}\nSource raster: ${source.width} × ${source.height}, EPSG:${e.crs}; resolution ≈ ${resolution.map(n=>n.toFixed(2)).join(' × ')} m\nCrop window including interpolation halo: ${e.width} × ${e.height}; ${e.window?.join(', ')??'legacy full raster'}\nElevation: ${range.min}…${range.max} m (conservative bilinear-support bound)\nGeographic size: ${(g.geographicSize??[g.size[0]/g.horizontalScale,g.size[2]/g.horizontalScale]).map(n=>n.toFixed(2)).join(' × ')} m\nWorld: ${g.size.join(' × ')} m\nCrop: ${g.crop.join(', ')}\nDecoded samples: ${e.width*e.height}; peak memory proxy: ${(Math.max(e.budget?.peakBytes??e.width*e.height*8,g.landcover?.budget?.peakBytes??0)/1024**2).toFixed(2)} MiB\nSaved recipe: ${((g.savedBytes??JSON.stringify(g).length)/1024**2).toFixed(2)} MiB\nLand cover: ${g.landcover?JSON.stringify(g.mapping):'default '+g.defaultBiome}\nKML: ${g.regions.length} polygons; later overrides win; holes retained.\nViewing distance remains 8–64 m; large extents do not add distant terrain.`;
  if(g.warnings?.length)ui.status.textContent+='\n'+g.warnings.join('\n');
  drawCropPreview(ui.canvas,{source:g.sourceCoverage??transformGeometry(rectangle(source.bounds),project),requested:transformGeometry(rectangle(g.crop),project),effective:g.effective??transformGeometry(rectangle(g.crop),project),boundary:g.regions.find(r=>r.id===g.boundary)},source);
  const ctx=ui.heightmap.getContext('2d'),image=ctx.createImageData(96,96);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){const p=geographicPoint(g,x/96*g.size[0]*4,y/96*g.size[2]*4),v=insideCrop(g,p)?sampleRaster(e,...p):null,i=(y*96+x)*4,shade=v===null?0:50+Math.round((v-range.min)/Math.max(1,range.max-range.min)*205);image.data.set([shade,shade,shade,v===null?0:255],i);}ctx.putImageData(image,0,0);
}
