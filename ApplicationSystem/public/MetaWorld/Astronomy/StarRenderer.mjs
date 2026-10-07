// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/StarRenderer.mjs
// This module caches an offline real-star catalog and renders it as one magnitude-weighted point batch with a shared celestial transform.
import { celestialMatrix, RAD } from './CelestialCoordinates.mjs';
let catalogPromise;
export function loadStarCatalog() {
  return catalogPromise ||= fetch('/vendor/hyg/bright-stars.json').then(response => {
    if (!response.ok) throw Error('Offline star catalog unavailable');
    return response.json();
  }).catch(error => { catalogPromise = null; throw error; });
}
export function createStarRenderer(THREE, catalog) {
  const positions=[], colors=[], sizes=[];
  for (const [, , ra, dec, mag, ci] of catalog.stars) {
    const a=ra*15*RAD,d=dec*RAD;
    positions.push(Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d));
    const tint=Math.max(-.3,Math.min(1.8,ci??.6));colors.push(1-.06*Math.max(0,.5-tint),1-.08*Math.max(0,tint-.5),1-.16*Math.max(0,tint-.5));
    sizes.push(Math.max(1,Math.min(5,3.5-mag*.4)));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
    uniforms:{visibility:{value:1}},
    vertexShader:`attribute vec3 color; attribute float size; varying vec3 tint; varying float altitude;
      void main(){tint=color; vec4 p=modelMatrix*vec4(position,0.0); altitude=p.y;
      gl_Position=projectionMatrix*viewMatrix*(vec4(p.xyz*900.0,1.0)+vec4(cameraPosition,0.0)); gl_PointSize=size;}`,
    fragmentShader:`uniform float visibility; varying vec3 tint; varying float altitude;
      void main(){if(altitude<0.0)discard; float r=length(gl_PointCoord-.5); if(r>.5)discard;
      gl_FragColor=vec4(tint,visibility*smoothstep(.5,.1,r));}` });
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=-100;
  points.matrixAutoUpdate=false;points.raycast=()=>{};
  return {points,update(instant,observer,visibility){points.matrix.copy(celestialMatrix(THREE,instant,observer));material.uniforms.visibility.value=visibility;},
    dispose(){geometry.dispose();material.dispose();points.removeFromParent();}};
}
