// Nodevision/scripts/weather-session-browser.mjs
// This fixture checks shared weather ownership, rendering, pause and declaration persistence through actual Sandbox sessions.
export async function checkSessionWeather(ctx, mode) {
  const ok=(value,message)=>{if(!value)throw Error(mode+': '+message);};
  for(let i=0;i<200&&!ctx.weatherController?.runtime;i++)await new Promise(resolve=>setTimeout(resolve,25));
  const controller=ctx.weatherController,runtime=controller?.runtime;
  ok(runtime,'Earth atmosphere starts shared weather');
  ok(runtime.renderer.regions.size<=49&&runtime.renderer.regions.size>0,'bounded cloud regions');
  ok(!ctx.objects.includes(runtime.renderer.root),'weather excluded from authored objects');
  ok(ctx.colliders.every(c=>c.target!==runtime.renderer.root),'clouds have no colliders');
  const lights=[];ctx.scene.traverse(o=>{if(o.isLight)lights.push(o);});
  ok(lights.every(light=>light.userData.astronomicalOwner),'only explicitly owned astronomical lights');
  const camera=ctx.camera.clone();camera.position.set(0,90,0);camera.lookAt(80,95,-100);
  ctx.renderer.render(ctx.scene,camera);ok(ctx.renderer.info.render.triangles>0,'cloud scene renders without light');
  ctx.pause();const time=runtime.time;
  await new Promise(resolve=>setTimeout(resolve,60));ok(runtime.time===time,'pause freezes weather time');
  ctx.resume();
  return JSON.stringify(runtime.state);
}
