// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/iframeProjection.mjs
// This module maps a webpage viewport onto its world object using CSS homogeneous projection. It preserves perspective while avoiding document reflow as the camera moves.
export function projectIframe(THREE, overlay, target, camera, viewportWidth, viewportHeight) {
  const params = target.geometry.parameters || {};
  const width = Number(params.width) || 1.6, height = Number(params.height) || .9;
  const depth = (Number(params.depth) || .04) / 2 + .002;
  const pixelsWidth = 1024, pixelsHeight = Math.max(1, Math.round(pixelsWidth * height / width));
  overlay.projection ||= new THREE.Matrix4();
  overlay.pixelPlane ||= new THREE.Matrix4();
  overlay.eye ||= new THREE.Vector3();
  overlay.eye.setFromMatrixPosition(camera.matrixWorld);
  target.worldToLocal(overlay.eye);
  if (overlay.eye.z <= depth) { overlay.element.style.display = 'none'; return; }
  overlay.pixelPlane.set(width/pixelsWidth,0,0,-width/2, 0,-height/pixelsHeight,0,height/2, 0,0,1,depth, 0,0,0,1);
  const m = overlay.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
    .multiply(target.matrixWorld).multiply(overlay.pixelPlane).elements;
  for (let col=0;col<4;col++) {
    const i=col*4, w=m[i+3];
    m[i]=viewportWidth*.5*(m[i]+w); m[i+1]=viewportHeight*.5*(-m[i+1]+w); m[i+2]=col===2?1:0;
  }
  overlay.element.style.width = pixelsWidth+'px';
  overlay.element.style.height = pixelsHeight+'px';
  overlay.element.style.display = 'block';
  overlay.element.style.transform = `matrix3d(${m.join(',')})`;
}
