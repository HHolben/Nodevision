// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/resizeObserver.mjs
// This file keeps the renderer and camera sized to the containing panel.

export function setupResizeObserver(panel, cameraOrCameras, renderer) {
  const resizeObserver = new ResizeObserver(() => {
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    if (!w || !h) return;
    const cameras = Array.isArray(cameraOrCameras) ? cameraOrCameras : [cameraOrCameras];
    for (const camera of cameras) {
      if (!camera) continue;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.setSize(w, h, false);
  });
  resizeObserver.observe(panel);
  panel._vrResizeObserver = resizeObserver;
}
