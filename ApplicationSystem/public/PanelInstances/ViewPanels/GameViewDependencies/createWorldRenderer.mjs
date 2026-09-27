// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/createWorldRenderer.mjs
// This module acquires a compatible WebGL context before constructing the world renderer. It preserves browser diagnostics and releases contexts when renderer construction fails.

export function createWorldRenderer({ THREE, canvas = document.createElement("canvas") }) {
  const messages = new Set();
  const onError = (event) => { if (event.statusMessage) messages.add(event.statusMessage); };
  canvas.addEventListener("webglcontextcreationerror", onError);
  let context = null;
  try {
    // Prefer WebGL2 without multisampling over downgrading to WebGL1.
    for (const type of ["webgl2", "webgl", "experimental-webgl"]) {
      for (const antialias of [true, false]) {
        try {
          context = canvas.getContext(type, {
            alpha: false, depth: true, stencil: true, antialias,
            premultipliedAlpha: true, preserveDrawingBuffer: false,
            powerPreference: "default", failIfMajorPerformanceCaveat: false,
          });
        } catch (error) { messages.add(error.message); }
        if (context) break;
      }
      if (context) break;
    }
  } finally {
    canvas.removeEventListener("webglcontextcreationerror", onError);
  }
  if (!context) {
    const error = new Error("The browser could not create a WebGL context.");
    error.code = "WEBGL_UNAVAILABLE";
    error.details = [...messages].join("\n");
    throw error;
  }
  try {
    return new THREE.WebGLRenderer({ canvas, context, alpha: false });
  } catch (error) {
    context.getExtension("WEBGL_lose_context")?.loseContext();
    throw error;
  }
}
