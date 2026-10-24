// Nodevision/scripts/build-geographic-deps.mjs
// This script bundles locked npm geographic readers into local browser modules for offline imports.
import { build } from 'esbuild';
import { mkdir, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
const out='ApplicationSystem/public/vendor/geographic';
await mkdir(out,{recursive:true});
const packages=new Set();
for(const [name,pkg] of [['reader','geotiff'],['projection','proj4'],['clipping','polygon-clipping']]) {
  const result=await build({metafile:true,stdin:{contents:`export * from '${pkg}'; ${pkg!=='geotiff'?`export { default } from '${pkg}';`:''}`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false,outfile:`${out}/${name}.mjs`});
  for(const input of Object.keys(result.metafile.inputs)){const parts=input.split('/');if(parts[0]==='node_modules')packages.add(parts[1].startsWith('@')?parts.slice(1,3).join('/'):parts[1]);}
  await copyFile(`node_modules/${pkg}/${pkg==='proj4'?'LICENSE.md':pkg==='polygon-clipping'?'LICENSE.md':'LICENSE'}`,`${out}/${pkg}-LICENSE`);
}

const notices=[];
for(const pkg of [...packages].sort()){
  const dir='node_modules/'+pkg,manifest=JSON.parse(await readFile(dir+'/package.json','utf8'));
  const files=(await readdir(dir)).filter(f=>/^licen[cs]e|^notice/i.test(f));
  notices.push(pkg+' '+manifest.version+' ('+manifest.license+')');
  for(const file of files)notices.push(await readFile(dir+'/'+file,'utf8'));
}
await writeFile(out+'/THIRD-PARTY-LICENSES.txt',notices.join('\n\n'));
