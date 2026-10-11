// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisPolygonTool.mjs
// This compatibility adapter routes the original Boolean region controls through the shared polygon interaction controller. Existing region records retain their ordered coordinate-pair format and transient lifetime.
import { createVectorInteraction } from '../VectorDrawing/VectorInteraction.mjs';
import { renderVectorPreview } from '../VectorDrawing/VectorSvgRenderer.mjs';
export function createAnalysisPolygonTool(svg, onFinish, setStatus) {
  const draft = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  draft.style.pointerEvents = 'none'; svg.append(draft);
  const controller = createVectorInteraction({
    preview: (geometry, points) => renderVectorPreview(draft, geometry, points),
    commit: geometry => onFinish(geometry.points.map(p => [p.x, p.y])), status: setStatus
  });
  controller.setTool('polygon');
  return { place: point => controller.down(point), move: point => controller.move(point),
    get points() { return controller.points.map(p => [p.x, p.y]); },
    finish: controller.finish, cancel: controller.cancel, key: controller.key,
    dispose() { controller.cancel(); draft.remove(); } };
}
