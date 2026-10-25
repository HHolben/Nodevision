// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GridDefinition.mjs
// Restores the existing polygonal height grid through the same constructor for document loading and history replay.
import {createTerrainSurfaceMesh} from '../../PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainSurfaceMesh.mjs';
export function terrainGridFromDefinition(THREE,def){
  const t=def.terrain||{};
  return createTerrainSurfaceMesh(THREE,{
    columns:def.columns??t.columns,rows:def.rows??t.rows,tileSize:def.tileSize??t.tileSize,
    heights:def.heights??t.heights,colors:def.vertexColors??t.vertexColors,color:def.color??t.color,
    texture:def.texture??t.texture,kind:def.kind??t.kind,opacity:def.opacity??t.opacity,isSolid:def.isSolid===true||def.collidable===true,
    metadata:{...t,representation:def.representation??t.representation,MatterState:def.MatterState??t.MatterState,
      matterState:def.matterState??t.matterState,isLiquid:def.isLiquid===true||t.isLiquid===true,
      materialName:def.materialName??t.materialName,physicsMaterialId:def.physicsMaterialId??t.physicsMaterialId,
      physicsMaterialFile:def.physicsMaterialFile??t.physicsMaterialFile}
  });
}
