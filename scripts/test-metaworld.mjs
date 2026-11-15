// Nodevision/scripts/test-metaworld.mjs
// Run all MetaWorld regressions with the application's browser-root namespace available to imported browser adapters. Paths are anchored to this script rather than the caller's working directory.
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=new URL('../ApplicationSystem/public/MetaWorld/',import.meta.url);
const files=(await readdir(root,{recursive:true})).filter(p=>p.endsWith('.test.mjs')).sort().map(p=>fileURLToPath(new URL(p,root)));
const child=spawn(process.execPath,['--import',fileURLToPath(new URL('./register-browser-test-imports.mjs',import.meta.url)),'--test',...files],{stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
