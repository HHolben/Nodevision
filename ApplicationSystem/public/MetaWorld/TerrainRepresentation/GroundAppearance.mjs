// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GroundAppearance.mjs
// Coordinate optional ground shading with the existing atomic chunk replacement. Legacy worlds keep standard normals; pending style requests cannot leak into edits, cancelled work or a different representation request.
import {polygonalGroundStyle,terrainRepresentation} from './Representation.mjs';
export {GROUND_NORMAL_HALO} from './GroundNormals.mjs';
export function groundAppearance(definition,representation){
 let active=polygonalGroundStyle(definition.polygonalGroundStyle),pending=null,revision=0;
 return {
  get style(){return active;},
  get buildStyle(){return representation.progress.pending?(pending??active):active;},
  cancel(mode){if(mode!==undefined)terrainRepresentation(mode);revision++;pending=null;},
  async set(value,beforeCommit=()=>{}){
   const next=polygonalGroundStyle(value);if(next===active&&!representation.progress.pending)return true;
   const job=++revision;pending=next;
   try{return await representation.setRepresentation(representation.active,()=>{if(job!==revision)throw Error('Ground style request was superseded.');beforeCommit();active=next;definition.polygonalGroundStyle=next;},true);}
   finally{if(job===revision)pending=null;}
  }
 };
}
