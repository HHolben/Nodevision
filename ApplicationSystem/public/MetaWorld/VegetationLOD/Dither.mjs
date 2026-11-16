// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Dither.mjs
// Opaque, depth-writing pixel-stable ordered screen-door coverage. Only owned procedural materials opt in; the identical stable field coordinates proxy/detail coverage without transparency sorting or scaling trees.
export function vegetationDither(material,texture,{proxy=false,fade={value:1},direction={value:0}}={}){
 const owned=material.clone();owned.userData.vegetationDither=true;
 owned.onBeforeCompile=shader=>{
  shader.uniforms.nvTrees={value:texture};shader.uniforms.nvFade=fade;shader.uniforms.nvOutgoing=direction;
  shader.vertexShader='attribute float nvTree;\nuniform sampler2D nvTrees;\nvarying float nvDetail;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nnvDetail=${proxy?'nvTree<0.5?0.0:':''}texture2D(nvTrees,vec2((nvTree+0.5)/4096.0,0.5)).r;`);
  shader.fragmentShader='uniform float nvOutgoing;\nuniform float nvFade;\nvarying float nvDetail;\nfloat nvNoise(float seed){vec2 q=mod(floor(gl_FragCoord.xy)+seed,8.0);float a=mod(q.x,2.0)*2.0+mod(q.y,2.0);float b=mod(floor(q.x/2.0),2.0)*2.0+mod(floor(q.y/2.0),2.0);float c=floor(q.x/4.0)*2.0+floor(q.y/4.0);return (16.0*a+4.0*b+c+0.5)/64.0;}\n'+shader.fragmentShader;
  const discard=proxy?'if(nvDetail>0.0){if(nvDetail>=1.0||nvNoise(0.0)<nvDetail)discard;}':'if(nvDetail<1.0){if(nvDetail<=0.0||nvNoise(0.0)>=nvDetail)discard;}';
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\n${discard}\nif(nvOutgoing>0.5){if(nvNoise(2.0)<nvFade)discard;}else if(nvFade<1.0&&nvNoise(2.0)>=nvFade)discard;`);
 };
 owned.customProgramCacheKey=()=>`nv-vegetation-v1:${proxy}`;return owned;
}
export function vegetationTransitionActive(transition,refs){
 if(!transition)return false;
 if(transition.fade.value<1||transition.direction?.value>0)return true;
 for(const id of refs.keys()){const v=transition.ownership.value(id);if(v>0&&v<1)return true;}
 return false;
}
