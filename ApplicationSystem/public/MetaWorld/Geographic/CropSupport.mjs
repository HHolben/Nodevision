// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/CropSupport.mjs
// This module enumerates every bilinear cell intersecting the effective raster polygon so crop extrema and NoData validation include precisely its interpolation support rather than sparse preview samples.
import { intersection,rectangle,geometryBounds,area } from './CropGeometry.mjs';
export function cropSupport(r,geometry,data) {
  const mask=new Uint8Array(r.width*r.height),missing=[];let min=Infinity,max=-Infinity,used=0;
  // A connected polygon clipped to one cell-high strip has a continuous X projection.
  // Hole interiors spanning the strip split into disconnected polygons automatically.
  for(let y=0;y<r.height-1;y++) {
    const strip=intersection(geometry,rectangle([0,y,r.width-1,y+1]));
    for(const polygon of strip){
      if(area([polygon])<1e-14)continue;
      const b=geometryBounds([polygon]),lo=Math.max(0,Math.floor(b[0]+1e-10)),hi=Math.min(r.width-1,Math.ceil(b[2]-1e-10));
      for(let x=lo;x<hi;x++)for(const i of [y*r.width+x,y*r.width+x+1,(y+1)*r.width+x,(y+1)*r.width+x+1])mask[i]=1;
    }
  }
  for(let i=0;i<mask.length;i++)if(mask[i]){
    used++;const v=data[i];if(!Number.isFinite(v)){if(missing.length<64)missing.push([i%r.width,Math.floor(i/r.width)]);}else{min=Math.min(min,v);max=Math.max(max,v);}
  }
  if(missing.length)throw Object.assign(Error(`Elevation NoData affects required interpolation support near raster samples ${missing.slice(0,5).map(p=>p.join(',')).join('; ')}. Adjust the crop or polygon holes; automatic filling is disabled.`),{diagnostic:{code:'NODATA',missing}});
  if(!used||!Number.isFinite(min))throw Error('The selected region has no usable bilinear terrain cells.');
  // Only values capable of affecting generated terrain are retained inside the rectangular window.
  for(let i=0;i<data.length;i++)if(!mask[i])data[i]=NaN;
  return {min,max,supportSamples:used,rangeMethod:'conservative-intersecting-bilinear-cells'};
}
