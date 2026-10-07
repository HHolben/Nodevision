// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkManager.mjs
// This module bounds chunk residency and synchronous work while exposing cumulative and resident generation measurements.

import { CHUNK_SIZE, chunkKey, voxelToChunk } from "./VoxelCoordinates.mjs";
export class VoxelChunkManager {
  constructor(generator, radius, build, release) {
    Object.assign(this, { generator, radius, build, release });
    this.loaded = new Map(); this.queue = []; this.center = "";
    this.stats = { loaded: 0, queued: 0, generated: 0, voxels: 0, faces: 0, generationMs: 0, meshingMs: 0, maxBuildMs: 0 };
  }
  update(voxel) {
    const [cx,,cz] = voxelToChunk(voxel), center = `${cx},${cz}`;
    if (center !== this.center) {
      this.center = center;
      const wanted = [];
      const [width,,depth] = this.generator.dimensions;
      for (let z = Math.max(0, cz-this.radius); z <= Math.min(Math.ceil(depth/CHUNK_SIZE)-1, cz+this.radius); z++) {
        for (let x = Math.max(0, cx-this.radius); x <= Math.min(Math.ceil(width/CHUNK_SIZE)-1, cx+this.radius); x++) {
          // The generator supplies its vertical occupancy bound; world height is never enumerated.
          const top = Math.ceil(this.generator.maxSolidHeight/CHUNK_SIZE);
          const levels=this.generator.getChunkLevels?.(x,z)||Array.from({length:top},(_,y)=>y);
          for (const y of levels) wanted.push([x,y,z]);
        }
      }
      for (const [key, entry] of this.loaded) {
        if (Math.abs(entry.cell[0]-cx)>this.radius+1 || Math.abs(entry.cell[2]-cz)>this.radius+1) {
          this.release(entry); this.loaded.delete(key);
          this.stats.voxels -= entry.solidVoxels; this.stats.faces -= entry.faceCount;
        }
      }
      this.queue = wanted.filter(cell => !this.loaded.has(chunkKey(cell)))
        .sort((a,b) => (a[0]-cx)**2+(a[2]-cz)**2 - ((b[0]-cx)**2+(b[2]-cz)**2) || b[1]-a[1]);
    }
    // One fixed-size chunk per update; workers can later replace build without changing residency.
    const cell = this.queue.shift();
    if (cell) {
      const start = performance.now(), entry = this.build(cell);
      this.loaded.set(chunkKey(cell), { ...entry, cell });
      this.stats.generated++; this.stats.voxels += entry.solidVoxels; this.stats.faces += entry.faceCount;
      this.stats.generationMs += entry.generationMs; this.stats.meshingMs += entry.meshingMs;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, performance.now()-start);
    }
    this.stats.loaded = this.loaded.size; this.stats.queued = this.queue.length;
  }
  dispose() {
    for (const entry of this.loaded.values()) this.release(entry);
    this.loaded.clear(); this.queue.length = 0; this.center = "";
    Object.assign(this.stats, { loaded: 0, queued: 0, voxels: 0, faces: 0 });
  }
}
