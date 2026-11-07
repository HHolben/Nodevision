// Nodevision/scripts/terrain-phase-a-baseline.mjs
// Materializes only the changed terrain runtime modules from a specified Git revision for repeatable before/after measurements without modifying the working tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
export const baselineRevision = process.env.NV_TERRAIN_BASELINE_REF || '0b7a0e8e6e08b8ed1e51639b6469e0e3332b2aef';
export async function prepareTerrainBaseline(directory, cwd, revision = baselineRevision) {
  const files = ['ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs', 'ProceduralVoxelWorld/VoxelChunkManager.mjs',
    'ProceduralVoxelWorld/ProgressiveChunks.mjs', 'TerrainRepresentation/ChunkRepresentation.mjs', 'TerrainRepresentation/SurfaceNets.mjs'];
  for (const name of files) {
    const content = await new Promise((resolve,reject) => {
      const child=spawn('git',['show',`${revision}:ApplicationSystem/public/MetaWorld/${name}`],{cwd});
      let output='',error='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>error+=data);
      child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(Error(error)));
    });
    const destination=path.join(directory,'MetaWorld',name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,content);
  }
}
