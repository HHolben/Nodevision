// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/BodyRenderer.mjs
// This module renders explicitly declared Sun and Moon spheres and owns only the directional lights requested by those bodies.
import { horizontalDirection } from './CelestialCoordinates.mjs';
export function createBodyRenderer(THREE, scene, declarations) {
  const root=new THREE.Group();root.name='Declared astronomical bodies';root.userData.runtimeGenerated=true;scene.add(root);
  const entries=declarations.map(body=>{
    const material=body.type==='sun'?new THREE.MeshBasicMaterial({color:'#fff0c2',depthTest:true,depthWrite:false}):new THREE.ShaderMaterial({
      depthTest:true,depthWrite:false,uniforms:{illumination:{value:new THREE.Vector3(0,0,1)}},
      vertexShader:'varying vec3 n; void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 illumination; varying vec3 n; void main(){float b=.035+.965*max(0.0,dot(normalize(n),illumination));gl_FragColor=vec4(vec3(.82)*b,1.0);}' });
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(3.5,24,16),material);mesh.name=body.id;mesh.renderOrder=-90;mesh.raycast=()=>{};root.add(mesh);
    const intensity=Number.isFinite(body.intensity)?Math.max(0,body.intensity):body.type==='sun'?2:0;
    const light=intensity>0?new THREE.DirectionalLight(body.type==='sun'?'#fff2d5':'#c4d2ff',intensity):null;
    if(light){root.add(light);root.add(light.target);light.userData.astronomicalOwner=body.id;}
    return {body,mesh,light,intensity};
  });
  return {root,entries,update(sky,camera){
    for(const e of entries){
      const position=sky[e.body.type],direction=new THREE.Vector3(...horizontalDirection(position));
      e.mesh.position.copy(camera.position).addScaledVector(direction,800);e.mesh.visible=position.altitude>-.016;
      if(e.light){e.light.position.copy(camera.position).addScaledVector(direction,100);e.light.target.position.copy(camera.position);
        e.light.intensity=e.intensity*Math.max(0,Math.min(1,(position.altitude+.02)/.15));}
      if(e.body.type==='moon'){
        const c=2*sky.phase.fraction-1,s=Math.sqrt(Math.max(0,1-c*c)),a=sky.phase.angle-(sky.moon.parallacticAngle||0);
        e.mesh.material.uniforms.illumination.value.set(s*Math.sin(a),s*Math.cos(a),c);
      }
    }
  },dispose(){for(const e of entries){e.mesh.geometry.dispose();e.mesh.material.dispose();e.light?.dispose();}root.clear();root.removeFromParent();}};
}
