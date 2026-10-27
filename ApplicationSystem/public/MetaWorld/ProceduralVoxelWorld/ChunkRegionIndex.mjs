// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ChunkRegionIndex.mjs
// This map indexes resident chunks by axis so regional invalidation visits only intersecting columns and levels, including negative coordinates.
export class ChunkRegionIndex extends Map {
 constructor(){super();this.axes=new Map();}
 set(key,value){if(this.has(key))this.delete(key);const [x,y,z]=value.cell;let ys=this.axes.get(x);if(!ys)this.axes.set(x,ys=new Map());let zs=ys.get(y);if(!zs)ys.set(y,zs=new Map());zs.set(z,key);return super.set(key,value);}
 delete(key){const v=this.get(key);if(!v)return false;const [x,y,z]=v.cell,ys=this.axes.get(x),zs=ys.get(y);zs.delete(z);if(!zs.size)ys.delete(y);if(!ys.size)this.axes.delete(x);return super.delete(key);}
 clear(){super.clear();this.axes.clear();}
 *region(bounds){const hits=(n,i)=>(n+1)*32>bounds.min[i]&&n*32<bounds.max[i];for(const [x,ys] of this.axes)if(hits(x,0))for(const [y,zs] of ys)if(hits(y,1))for(const [z,key] of zs)if(hits(z,2))yield key;}
}
