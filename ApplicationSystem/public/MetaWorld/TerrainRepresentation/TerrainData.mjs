// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/TerrainData.mjs
// Describes authoritative terrain data independently of derived geometry, with explicit optional occupancy and height-grid adapters rather than assuming identical generators.
export function terrainData(root,{kind,parameters,dimensions,seed,originOffset=[0,0,0],sampleVoxel,sampleHeight,biome,materials}){
  const source=()=>typeof parameters==='function'?parameters():parameters;
  return Object.freeze({kind,get parameters(){return source();},dimensions:dimensions.slice(),seed,
    get id(){return source().id||root.userData.metaWorldLayerId;},
    get origin(){return root.position.toArray().map((v,i)=>v+originOffset[i]);},
    sampleVoxel,sampleHeight,biome,get materials(){return materials();}
  });
}
export function gridHeight(t,x,z){
  const width=t.columns*t.tileSize,depth=t.rows*t.tileSize,gx=(x+width/2)/t.tileSize,gz=(z+depth/2)/t.tileSize;
  if(gx<0||gz<0||gx>t.columns||gz>t.rows)return NaN;
  const ix=Math.min(t.columns-1,Math.floor(gx)),iz=Math.min(t.rows-1,Math.floor(gz)),tx=gx-ix,tz=gz-iz,i=iz*(t.columns+1)+ix;
  const a=t.heights[i],b=t.heights[i+1],c=t.heights[i+t.columns+1],d=t.heights[i+t.columns+2];
  return tx+tz<=1?a+(b-a)*tx+(c-a)*tz:d+(c-d)*(1-tx)+(b-d)*(1-tz);
}
