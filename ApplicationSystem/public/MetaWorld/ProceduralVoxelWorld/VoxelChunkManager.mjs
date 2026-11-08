// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkManager.mjs
// This module bounds chunk residency and synchronous work while exposing cumulative and resident generation measurements.

import {RevisionMap,RevisionSet} from '../TerrainLOD/ResidencyVersion.mjs';
import { planColumns } from '../TerrainLOD/PredictiveColumns.mjs';
import {ChunkRegionIndex} from './ChunkRegionIndex.mjs';
import { advanceProgressive,cancelProgressive } from './ProgressiveChunks.mjs';
import { horizontalRange, CHUNK_SIZE, chunkKey, voxelToChunk } from "./VoxelCoordinates.mjs";
export class VoxelChunkManager {
  constructor(generator, radius, build, release, options=null) {
    Object.assign(this, { generator, radius, build, release, options });
    this.columnLevels = new RevisionMap(); this.streaming = false; this.predictive = false;
    this.loaded = new ChunkRegionIndex(); this.invalidated = new RevisionSet(); this.queue = []; this.center = "";
    this.stats = { installationMs:0,evicted:0,requestedChunks:0,residentHits:0,residentMisses:0, residentBytes:0,peakLoaded:0,maxUpdateMs:0,cancelled:0, loaded: 0, queued: 0, generated: 0, voxels: 0, faces: 0, generationMs: 0, meshingMs: 0, maxBuildMs: 0 };
  }
  update(voxel) {
    const [cx,,cz] = voxelToChunk(voxel), center = `${cx},${cz}`;
    if (center !== this.center && this.streaming) planColumns(this,cx,cz);
    if (center !== this.center) {
      cancelProgressive(this);this.center = center;
      const wanted = [];
      const [width,,depth] = this.generator.dimensions;
      const [minX,maxX]=horizontalRange(cx,this.radius,Math.ceil(width/CHUNK_SIZE),this.generator.dimensions.infinite),[minZ,maxZ]=horizontalRange(cz,this.radius,Math.ceil(depth/CHUNK_SIZE),this.generator.dimensions.infinite);
      for (let z=minZ;z<=maxZ;z++) {
        for (let x=minX;x<=maxX;x++) {
          wanted.push([x,null,z]);
        }
      }
      for (const [key, entry] of this.loaded) {
        if (Math.abs(entry.cell[0]-cx)>this.radius+1 || Math.abs(entry.cell[2]-cz)>this.radius+1) {
          this.stats.evicted++;this.release(entry); this.loaded.delete(key); this.invalidated.delete(key);
          this.stats.residentBytes-=entry.residentBytes??0;this.stats.voxels -= entry.solidVoxels; this.stats.faces -= entry.faceCount;
        }
      }
      for(const key of this.columnLevels.keys()){const [x,z]=key.split(',').map(Number);if(Math.max(Math.abs(x-cx),Math.abs(z-cz))>this.radius+3)this.columnLevels.delete(key);}
      this.queue = wanted
        .sort((a,b) => (a[0]-cx)**2+(a[2]-cz)**2 - ((b[0]-cx)**2+(b[2]-cz)**2));
    }
    if(this.options){advanceProgressive(this);return;}
    // One fixed-size chunk per update; workers can later replace build without changing residency.
    let cell = this.queue.shift();
    if (cell && cell[1] === null) {
      const [x,,z] = cell, queryStart=performance.now();
      const levels = this.generator.getChunkLevels?.(x,z) || Array.from({length:Math.ceil(this.generator.maxSolidHeight/CHUNK_SIZE)},(_,y)=>y);
      this.stats.levelQueryMs=(this.stats.levelQueryMs||0)+performance.now()-queryStart;
      // Include previously resident levels so cuts also replace chunks above the new surface.
      const dirty=[...this.loaded.values()].filter(e=>e.cell[0]===x&&e.cell[2]===z&&this.invalidated.has(chunkKey(e.cell))).map(e=>e.cell[1]);
      this.columnLevels.set(`${x},${z}`,levels);
      const cells = [...new Set([...levels,...dirty])].sort((a,b)=>b-a).map(y=>[x,y,z]).filter(c=>!this.loaded.has(chunkKey(c))||this.invalidated.has(chunkKey(c)));
      this.stats.requestedChunks+=cells.length;this.stats.residentMisses+=cells.length;this.stats.residentHits+=Math.max(0,levels.length-cells.length);
      this.queue.unshift(...cells);
      cell = cells.length ? this.queue.shift() : null;
    }
    if (cell) {
      const start = performance.now(), entry = this.build(cell);
      const key=chunkKey(cell),previous=this.loaded.get(key);
      if(previous){this.release(previous);this.stats.residentBytes-=previous.residentBytes??0;this.stats.voxels-=previous.solidVoxels;this.stats.faces-=previous.faceCount;}
      this.invalidated.delete(key);
      this.loaded.set(chunkKey(cell), { ...entry, cell });
      this.stats.residentBytes+=entry.residentBytes??0;this.stats.generated++; this.stats.voxels += entry.solidVoxels; this.stats.faces += entry.faceCount;
      this.stats.installationMs += entry.installationMs || 0;
      this.stats.generationMs += entry.generationMs; this.stats.meshingMs += entry.meshingMs;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, performance.now()-start);
    }
    this.stats.loaded = this.loaded.size; this.stats.queued = this.queue.length;
  }
  columnReady(x,z){const levels=this.columnLevels.get(`${x},${z}`);return !!levels&&levels.every(y=>this.loaded.has(`${x},${y},${z}`)&&!this.invalidated.has(`${x},${y},${z}`));}
  releaseEntry(key){
    const e=this.loaded.get(key);if(!e)return;this.release(e);this.loaded.delete(key);this.invalidated.delete(key);
    this.stats.voxels-=e.solidVoxels;this.stats.faces-=e.faceCount;this.stats.residentBytes-=e.residentBytes??0;
  }
  storeEntry(cell,entry){
    const key=chunkKey(cell);this.releaseEntry(key);this.loaded.set(key,{...entry,cell});this.invalidated.delete(key);
    this.stats.generated++;this.stats.voxels+=entry.solidVoxels;this.stats.faces+=entry.faceCount;this.stats.residentBytes+=entry.residentBytes??0;
    this.stats.installationMs+=entry.installationMs||0;this.stats.generationMs+=entry.generationMs;this.stats.meshingMs+=entry.meshingMs;this.stats.maxBuildMs=Math.max(this.stats.maxBuildMs,entry.buildMs??0);
  }
  invalidateRegion(bounds){
    for(const key of this.columnLevels.keys()){const [x,z]=key.split(',').map(Number);if((x+1)*32>bounds.min[0]&&x*32<bounds.max[0]&&(z+1)*32>bounds.min[2]&&z*32<bounds.max[2])this.columnLevels.delete(key);}
    cancelProgressive(this);
    for(const key of [...this.loaded.region(bounds)])this.releaseEntry(key);
    this.queue.length=0;this.center='';this.stats.loaded=this.loaded.size;
  }
  invalidateBounds(bounds) {
    for(const key of this.columnLevels.keys()){const [x,z]=key.split(',').map(Number);if((x+1)*32>bounds.minX&&x*32<bounds.maxX&&(z+1)*32>bounds.minZ&&z*32<bounds.maxZ)this.columnLevels.delete(key);}
    cancelProgressive(this);
    for (const [key,entry] of this.loaded) {
      const [x,,z]=entry.cell;
      if ((x+1)*32<bounds.minX || x*32>bounds.maxX || (z+1)*32<bounds.minZ || z*32>bounds.maxZ) continue;
      this.invalidated.add(key);
    }
    this.queue.length=0;this.center='';this.stats.loaded=this.loaded.size;
  }
  invalidateAll() {
    cancelProgressive(this);this.columnLevels.clear();
    for(const key of this.loaded.keys())this.invalidated.add(key);
    this.queue.length=0;this.center='';
  }
  dispose() {
    cancelProgressive(this);
    for (const entry of this.loaded.values()) this.release(entry);
    this.loaded.clear(); this.columnLevels.clear(); this.invalidated.clear(); this.queue.length = 0; this.center = "";
    Object.assign(this.stats, { loaded: 0, queued: 0, voxels: 0, faces: 0,residentBytes:0 });
  }
}
