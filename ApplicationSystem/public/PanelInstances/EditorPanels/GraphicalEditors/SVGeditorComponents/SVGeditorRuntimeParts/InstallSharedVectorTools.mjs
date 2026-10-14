// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSharedVectorTools.mjs
// This adapter commits shared vector gestures through the SVG editor's snapshot history and active layer. The established Line controller retains ownership of its constrained multi-click gestures.
import { bindVectorInteraction } from '../../../../../VectorDrawing/BindVectorInteraction.mjs';
import { vectorTools } from '../../../../../VectorDrawing/VectorGeometry.mjs';
import { createVectorElement, renderVectorPreview } from '../../../../../VectorDrawing/VectorSvgRenderer.mjs';
import { toSvgPoint } from '../svgDom.mjs';
export function installSharedVectorTools(session) {
  let layer;
  const preview = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  preview.setAttribute('data-nv-editor-ui', 'vector-preview');
  preview.setAttribute('pointer-events', 'none');
  preview.style.color = 'var(--selection-color, #0078d7)';
  const binding = bindVectorInteraction({
    surface: session.svgRoot, keyboardHost: session.wrapper,
    getTool() {
      session.syncModeFromToolbarState();
      const mode = session.toolState.mode;
      return vectorTools.includes(mode) && mode !== 'line' ? mode : null;
    },
    begin() { layer = session.getActiveLayer() || session.svgRoot; session.clearSelection(); },
    toPoint(event) {
      let point = toSvgPoint(session.svgRoot, event.clientX, event.clientY);
      if (event.shiftKey && session.toolState.mode !== 'arc') point = session.findNearestSnapPointInRoot(point, session.pointerToleranceInSvgUnits(10)) || point;
      return session.rootPointToElementPoint(layer || session.svgRoot, point);
    },
    preview(geometry, points) {
      if (geometry || points?.length) (layer || session.svgRoot).append(preview);
      renderVectorPreview(preview, geometry, points);
      if (!geometry && !points?.length) preview.remove();
    },
    commit(geometry) {
      const style = session.currentStyleDefaults();
      const element = session.runSvgSnapshotOperation(`draw-${geometry.kind}`, () => {
        const node = createVectorElement(geometry, { stroke: style.stroke, 'stroke-width': style.strokeWidth, fill: ['line', 'arc'].includes(geometry.kind) ? 'none' : style.fill });
        layer.append(node); return node;
      });
      session.setSelection([element], { primary: element });
      session.setStatus(`${geometry.kind} drawn`);
    },
    modifierChanged(event) {
      const state = session.lineToolState;
      if (state.active && state.rawCursorRoot && !state.grab) {
        session.updateLineToolPreview(session.resolveLineToolPoint(state.rawCursorRoot, event));
      }
    },
    cancelOnDeactivate() { session.cancelLineToolAndDeletePlaced(); return true; },
    status: text => session.setStatus(text)
  });
  session.sharedVectorTools = binding;
}
