// Nodevision/scripts/astronomy-session-browser.mjs
// This fixture validates astronomical Sandbox initialization and pause-menu solar-event jumps against a deterministic host clock.
export async function checkSessionAstronomy(ctx,mode){
 const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);};
 const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25));}throw Error('Astronomy timeout');};
 await wait(()=>ctx.astronomy?.stars);
 const runtime=ctx.astronomy;ok(runtime.season==='autumn','mock date sets season');
 ok(runtime.clock.timezone==='America/Chicago','configured source timezone');
 ok(Math.abs(runtime.clock.instant-Date.parse('2026-10-07T18:00:00Z'))<120000,'fresh system initialization');
 ok(runtime.sky.sun.altitude>0,'daytime Sun above horizon');
 const sun=runtime.bodies.entries.find(e=>e.body.type==='sun');ok(sun.light.intensity>0,'declared Sun illuminates terrain');
 ok(runtime.stars.points.material.uniforms.visibility.value===0,'daytime stars faded');
 const buffer=runtime.stars.points.geometry.attributes.position,host=Date.now();
 ctx.pause();
 ok(ctx.panel.querySelectorAll('[data-sleep]').length===1,'one sleep action');
 const choices=ctx.panel.querySelector('.nv-world-sleep-target');
 ok(choices.options.length===7,'seven available times');
 ok(choices.value===runtime.sleepOptions()[0].id,'nearest upcoming time selected');
 const first=runtime.clock.instant;
 ctx.panel.querySelector('.nv-world-sleep-target').value='nightfall';ctx.panel.querySelector('[data-sleep="selected"]').click();
 await wait(()=>runtime.sky.state==='night');
 ok(runtime.clock.instant>first,'nightfall advances');ok(Date.now()===host,'host clock unchanged');
 ok(runtime.stars.points.material.uniforms.visibility.value>.99,'stars visible at nightfall');
 ok(sun.light.intensity===0,'night removes sunlight');
 const night=runtime.clock.instant;
 ctx.panel.querySelector('.nv-world-sleep-target').value='daybreak';ctx.panel.querySelector('[data-sleep="selected"]').click();
 await wait(()=>runtime.clock.instant>night&&runtime.sky.sun.altitude>-.015);
 ok(sun.mesh.visible,'Sun returns at computed dawn');
 ok(runtime.stars.points.geometry.attributes.position===buffer,'catalog buffer stays resident');
 ok(runtime.stars.points.material.uniforms.visibility.value<.2,'dawn fades stars');
 ctx.resume();await new Promise(r=>setTimeout(r,50));ok(runtime.clock.instant>night,'no snap back to host');
 return runtime;
}
