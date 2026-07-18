// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/GifAnimations.mjs
// Opens the GIF animation controls for the shared raster GIF editor.

export default function GifAnimations() {
  const keyframeAnimationContext = window.KeyframeAnimationContext;
  const toggleKeyframePanel = keyframeAnimationContext?.togglePanel || keyframeAnimationContext?.showPanel;
  if (typeof toggleKeyframePanel === "function") {
    toggleKeyframePanel();
    return;
  }

  const glbAnimationContext = window.GLBAnimationContext;
  const toggleGlbAnimationPane = glbAnimationContext?.togglePane || glbAnimationContext?.showPane;
  if (typeof toggleGlbAnimationPane === "function") {
    toggleGlbAnimationPane();
    return;
  }

  window.dispatchEvent(
    new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "Animations", force: true, toggle: true },
    }),
  );
}
