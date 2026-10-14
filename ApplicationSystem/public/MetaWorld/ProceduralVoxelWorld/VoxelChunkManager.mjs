// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkManager.mjs
// This module bounds chunk residency and synchronous work while exposing cumulative and resident generation measurements.

import { CHUNK_SIZE, chunkKey, voxelToChunk } from "./VoxelCoordinates.mjs";
export class VoxelChunkManager {
  constructor(generator, radius, build, release) {
    Object.assign(this, { generator, radius, build, release });
    this.loaded = new Map(); this.invalidated = new Set(); this.queue = []; this.center = "";
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
          wanted.push([x,null,z]);
        }
      }
      for (const [key, entry] of this.loaded) {
        if (Math.abs(entry.cell[0]-cx)>this.radius+1 || Math.abs(entry.cell[2]-cz)>this.radius+1) {
          this.release(entry); this.loaded.delete(key); this.invalidated.delete(key);
          this.stats.voxels -= entry.solidVoxels; this.stats.faces -= entry.faceCount;
        }
      }
      this.queue = wanted
        .sort((a,b) => (a[0]-cx)**2+(a[2]-cz)**2 - ((b[0]-cx)**2+(b[2]-cz)**2));
    }
    // One fixed-size chunk per update; workers can later replace build without changing residency.
    let cell = this.queue.shift();
    if (cell && cell[1] === null) {
      const [x,,z] = cell;
      const levels = this.generator.getChunkLevels?.(x,z) || Array.from({length:Math.ceil(this.generator.maxSolidHeight/CHUNK_SIZE)},(_,y)=>y);
      // Include previously resident levels so cuts also replace chunks above the new surface.
      const dirty=[...this.loaded.values()].filter(e=>e.cell[0]===x&&e.cell[2]===z&&this.invalidated.has(chunkKey(e.cell))).map(e=>e.cell[1]);
      const cells = [...new Set([...levels,...dirty])].sort((a,b)=>b-a).map(y=>[x,y,z]).filter(c=>!this.loaded.has(chunkKey(c))||this.invalidated.has(chunkKey(c)));
      this.queue.unshift(...cells);
      cell = cells.length ? this.queue.shift() : null;
    }
    if (cell) {
      const start = performance.now(), entry = this.build(cell);
      const key=chunkKey(cell),previous=this.loaded.get(key);
      if(previous){this.release(previous);this.stats.voxels-=previous.solidVoxels;this.stats.faces-=previous.faceCount;}
      this.invalidated.delete(key);
      this.loaded.set(chunkKey(cell), { ...entry, cell });
      this.stats.generated++; this.stats.voxels += entry.solidVoxels; this.stats.faces += entry.faceCount;
      this.stats.generationMs += entry.generationMs; this.stats.meshingMs += entry.meshingMs;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, performance.now()-start);
    }
    this.stats.loaded = this.loaded.size; this.stats.queued = this.queue.length;
  }
  invalidateBounds(bounds) {
    for (const [key,entry] of this.loaded) {
      const [x,,z]=entry.cell;
      if ((x+1)*32<bounds.minX || x*32>bounds.maxX || (z+1)*32<bounds.minZ || z*32>bounds.maxZ) continue;
      this.invalidated.add(key);
    }
    this.queue.length=0;this.center='';this.stats.loaded=this.loaded.size;
  }
  dispose() {
    for (const entry of this.loaded.values()) this.release(entry);
    this.loaded.clear(); this.invalidated.clear(); this.queue.length = 0; this.center = "";
    Object.assign(this.stats, { loaded: 0, queued: 0, voxels: 0, faces: 0 });
  }
}
