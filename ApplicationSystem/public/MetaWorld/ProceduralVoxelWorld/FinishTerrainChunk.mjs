// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/FinishTerrainChunk.mjs
// This module installs one prepared terrain mesh using the shared material palette and records CPU installation cost. Geometry remains owned by the existing chunk manager for replacement and disposal.
import {chunkToVoxel,voxelToWorld} from "./VoxelCoordinates.mjs";
export function finishTerrainChunk(THREE,root,palette,floorOffset,definition,cell,result,generationMs,meshingMs,hidden=false){
    const commitStart=performance.now();
    let mesh = null;
    if (result.faceCount) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(result.positions,3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(result.uvs,2));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(result.normals,3));
      for (const group of result.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.setIndex(result.indices); geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(geometry, palette.materials);
      mesh.position.fromArray(voxelToWorld(chunkToVoxel(cell), [0,floorOffset,0]));
      Object.assign(mesh.userData, { proceduralTerrainId: definition.id, proceduralChunk: cell.slice(),
        runtimeGenerated: true, breakable: false });
      mesh.userData.terrainSubmitted=false;mesh.onAfterRender=function(){this.userData.terrainSubmitted=true;delete this.onAfterRender;};
      mesh.visible=!hidden;root.add(mesh);
    }
    return { mesh, faceCount: result.faceCount, solidVoxels: result.solidVoxels,
      generationMs, meshingMs,installationMs:performance.now()-commitStart,buildMs:generationMs+meshingMs+performance.now()-commitStart,
      residentBytes:result.positions.length*4+result.normals.length*4+result.uvs.length*4+result.indices.length*4 };
  }
