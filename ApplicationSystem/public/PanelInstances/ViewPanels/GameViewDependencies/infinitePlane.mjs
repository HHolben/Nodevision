// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/infinitePlane.mjs
// This module renders an equation plane with a single viewport quad and analytic depth, and derives picking and collision equations from its ordinary object transform.
export function transformedPlaneEquation(THREE, mesh) {
  mesh.updateWorldMatrix(true, false);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(mesh.matrixWorld);
  return { ...mesh.userData.equationCollider, a: plane.normal.x, b: plane.normal.y, c: plane.normal.z, d: plane.constant,
    boundX: false, boundY: false, boundZ: false };
}
export function installInfinitePlane(THREE, mesh, options = {}) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(2, 2);
  mesh.material.dispose();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      clipToLocal: { value: new THREE.Matrix4() }, localToClip: { value: new THREE.Matrix4() },
      tint: { value: new THREE.Color(options.color || '#d8dee4') }, alpha: { value: options.opacity ?? 1 }
    },
    vertexShader: `varying vec2 screenPoint;
      void main() { screenPoint = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform mat4 clipToLocal; uniform mat4 localToClip; uniform vec3 tint; uniform float alpha; varying vec2 screenPoint;
      void main() {
        vec4 nearH = clipToLocal * vec4(screenPoint, -1.0, 1.0);
        vec4 farH = clipToLocal * vec4(screenPoint, 1.0, 1.0);
        vec3 nearP = nearH.xyz / nearH.w; vec3 farP = farH.xyz / farH.w;
        vec3 ray = farP - nearP;
        if (abs(ray.y) < 0.000001) discard;
        float t = -nearP.y / ray.y;
        if (t < 0.0 || t > 1.0) discard;
        vec3 point = nearP + t * ray;
        vec4 clip = localToClip * vec4(point, 1.0);
        gl_FragDepthEXT = (clip.z / clip.w) * 0.5 + 0.5;
        gl_FragColor = vec4(tint, alpha);
      }`,
    opacity: options.opacity ?? 1, transparent: (options.opacity ?? 1) < 1,
    extensions: { fragDepth: true }, side: THREE.DoubleSide
  });
  // Keep existing material editing and serialization's color contract.
  material.color = material.uniforms.tint.value;
  mesh.material = material;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    material.uniforms.alpha.value = material.opacity;
    material.uniforms.localToClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    material.uniforms.clipToLocal.value.copy(material.uniforms.localToClip.value).invert();
  };
  const point = new THREE.Vector3();
  mesh.raycast = (raycaster, hits) => {
    const eq = transformedPlaneEquation(THREE, mesh);
    const plane = new THREE.Plane(new THREE.Vector3(eq.a, eq.b, eq.c), eq.d);
    if (!raycaster.ray.intersectPlane(plane, point)) return;
    const distance = point.distanceTo(raycaster.ray.origin);
    if (distance < raycaster.near || distance > raycaster.far) return;
    hits.push({ object: mesh, distance, point: point.clone(), face: { normal: new THREE.Vector3(0, 1, 0) } });
  };
}
