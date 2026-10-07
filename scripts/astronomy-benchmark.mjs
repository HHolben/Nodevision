// Nodevision/scripts/astronomy-benchmark.mjs
// This benchmark separates offline catalog parsing, astronomy initialization, ephemeris queries and shared star transforms.
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from '../ApplicationSystem/public/lib/three/three.module.js';
import {createAstronomyRuntime} from '../ApplicationSystem/public/MetaWorld/Astronomy/AstronomyRuntime.mjs';
import {earthSandboxAstronomy,MIDWEST_OBSERVER} from '../ApplicationSystem/public/MetaWorld/Astronomy/AstronomyConfig.mjs';
import {skyAt,celestialMatrix} from '../ApplicationSystem/public/MetaWorld/Astronomy/CelestialCoordinates.mjs';
const text=await readFile('ApplicationSystem/public/vendor/hyg/bright-stars.json','utf8');
let start=performance.now();const catalog=JSON.parse(text),parseMs=performance.now()-start;
let elapsedSeconds=0;const temporal={getTimeSeconds:()=>elapsedSeconds,getSettings:()=>({elapsedSeconds,timeScale:1,staticTimeEnabled:false,staticTimeSeconds:0}),applySettings:s=>{elapsedSeconds=s.elapsedSeconds;}};
const config=earthSandboxAstronomy();config.clock={mode:'fixed',initialTime:'2026-10-07T18:00:00Z'};
const scene=new THREE.Scene();start=performance.now();const runtime=createAstronomyRuntime(THREE,scene,temporal,config,{catalog});await runtime.ready;
const initializationMs=performance.now()-start;
start=performance.now();for(let i=0;i<1000;i++)skyAt(runtime.clock.instant+i*1000,MIDWEST_OBSERVER);const ephemerisMs=(performance.now()-start)/1000;
start=performance.now();for(let i=0;i<1000;i++)celestialMatrix(THREE,runtime.clock.instant+i*1000,MIDWEST_OBSERVER);const transformMs=(performance.now()-start)/1000;
const camera=new THREE.PerspectiveCamera();start=performance.now();for(let i=0;i<1000;i++){elapsedSeconds=i/60;runtime.update(camera);}const updateMs=(performance.now()-start)/1000;
const geometry=runtime.stars.points.geometry,starBufferBytes=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);
const report={stars:catalog.stars.length,catalogBytes:Buffer.byteLength(text),parseMs,initializationMs,ephemerisMs,transformMs,updateMs,starBufferBytes,starBatches:1,bodyMeshes:runtime.bodies.entries.length};
runtime.dispose();await writeFile('docs/astronomy-performance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
