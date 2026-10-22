// Nodevision/ApplicationSystem/public/Models/ValidateModelFile.mjs
// Validate local imports before writing; companion files must already live beside Notebook glTF sources.
export async function validateModelFile(file){
 const ext=file.name.split('.').pop().toLowerCase();if(!['gox','gltf','glb'].includes(ext))return;
 if(file.size>128*1024*1024)throw Error('Model exceeds the 128 MiB import limit');const data=await file.arrayBuffer();
 if(ext==='gox'){const {decodeGox}=await import('/Voxels/GoxCodec.mjs');await decodeGox(data);return;}
 let json;
 if(ext==='gltf')json=JSON.parse(new TextDecoder().decode(data));
 else {const view=new DataView(data);if(data.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('Invalid GLB 2.0 file');const size=view.getUint32(12,true);if(20+size>data.byteLength)throw Error('Truncated GLB');json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,size)));}
 if(json.asset?.version!=='2.0')throw Error('Only glTF 2.0 models are supported');
 if([...json.buffers||[],...json.images||[]].some(v=>v.uri&&!v.uri.startsWith('data:')))throw Error('This model has companion files. Choose its Notebook folder containing those files, or import a self-contained GLB.');
 const {GLTFLoader}=await import('/lib/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().parseAsync(data,'');const resources=new Set();gltf.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const resource of resources)resource.dispose();
}
