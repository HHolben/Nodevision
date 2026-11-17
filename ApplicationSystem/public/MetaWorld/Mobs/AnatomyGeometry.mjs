// Shared declarative geometry contract. Legacy v1 positions remain root-local.
export const MAX_PARTS=128,MAX_DEPTH=32,MAX_REGIONS=8;
export function partRegions(p){return p.regions??[{id:p.id+'-region',shape:p.hitRegion?.shape||'box',position:[0,0,0],rotation:[0,0,0],dimensions:p.bounds,enabled:p.hitRegion?.exposed!==false}];}
export function validateAnatomyGeometry(schema){
 const parts=schema?.parts;if(!Array.isArray(parts)||!parts.length||parts.length>MAX_PARTS)throw Error('Anatomy requires 1–128 parts');
 if(schema.coordinates!==undefined&&schema.coordinates!=='parent-local')throw Error('Unsupported anatomy coordinates');
 const ids=new Map(),regions=new Set(),vec=(v,positive=false)=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e4&&(!positive||n>=.0001));
 for(const p of parts){if(typeof p.id!=='string'||ids.has(p.id)||!vec(p.position)||p.rotation!==undefined&&!vec(p.rotation)||p.scale!==undefined&&(!vec(p.scale,true)||p.scale.some(n=>n<.01||n>100)))throw Error('Invalid/duplicate anatomical transform or ID');ids.set(p.id,p);
  const rr=partRegions(p);if(!Array.isArray(rr)||rr.length>MAX_REGIONS)throw Error('At most eight hit regions per part');
  for(const r of rr){if(typeof r.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,159}$/.test(r.id)||regions.has(r.id)||!['box','sphere','capsule'].includes(r.shape)||!vec(r.position??[0,0,0])||!vec(r.rotation??[0,0,0])||!vec(r.dimensions,true)||r.enabled!==undefined&&typeof r.enabled!=='boolean')throw Error('Invalid hit region');regions.add(r.id);if(r.owner!==undefined&&r.owner!==p.id)throw Error('Hit-region owner mismatch');if(r.shape==='sphere'&&(r.dimensions[0]!==r.dimensions[1]||r.dimensions[0]!==r.dimensions[2]))throw Error('Sphere requires equal diameters');if(r.shape==='capsule'&&(r.dimensions[0]!==r.dimensions[2]||r.dimensions[1]<r.dimensions[0]))throw Error('Capsule requires equal X/Z diameters and height ≥ diameter');}
  if(p.initialCondition!==undefined&&(!Number.isFinite(p.initialCondition)||p.initialCondition<0||p.initialCondition>p.maxCondition))throw Error('Invalid initial condition');
 }
 for(const p of parts){const seen=new Set([p.id]);let parent=p.parent;while(parent){if(!ids.has(parent)||seen.has(parent)||seen.size>=MAX_DEPTH)throw Error('Invalid/cyclic/deep anatomical hierarchy');seen.add(parent);parent=ids.get(parent).parent;}if(p.requires!==undefined&&(!Array.isArray(p.requires)||p.requires.length>128||new Set(p.requires).size!==p.requires.length))throw Error('Invalid functional dependencies');for(const id of p.requires||[])if(!ids.has(id)||id===p.id)throw Error('Unknown/self functional dependency');}
 // Functional dependency cycles are invalid independently of the anatomical hierarchy.
 const done=new Set(),visit=(id,path=new Set())=>{if(path.has(id))throw Error('Cyclic functional dependencies');if(done.has(id))return;path.add(id);for(const dep of ids.get(id).requires||[])visit(dep,path);path.delete(id);done.add(id);};parts.forEach(p=>visit(p.id));
}
export function anatomyMatrices(THREE,schema){
 const result=new Map(),byId=new Map(schema.parts.map(p=>[p.id,p]));
 function matrix(p){if(result.has(p.id))return result.get(p.id);const m=new THREE.Matrix4().compose(new THREE.Vector3(...p.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation||[0,0,0]))),new THREE.Vector3(...(p.scale||[1,1,1])));if(schema.coordinates==='parent-local'&&p.parent)m.premultiply(matrix(byId.get(p.parent)));result.set(p.id,m);return m;}
 schema.parts.forEach(matrix);return result;
}
export function compiledRegions(THREE,schema){const matrices=anatomyMatrices(THREE,schema);return schema.parts.flatMap(p=>partRegions(p).filter(r=>r.enabled!==false).map(r=>{const m=matrices.get(p.id).clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...(r.position||[0,0,0])),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r.rotation||[0,0,0]))),new THREE.Vector3(1,1,1)));return {...r,part:p.id,matrix:m,inverse:m.clone().invert(),box:new THREE.Box3(new THREE.Vector3(...r.dimensions).multiplyScalar(-.5),new THREE.Vector3(...r.dimensions).multiplyScalar(.5))};})).sort((a,b)=>a.id.localeCompare(b.id));}
