// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphGeometricZoom.mjs
// This module applies geometric commands directly to the Cytoscape camera while retaining the rendered anchor and leaving graph layout unchanged.
export function graphGeometricZoom(container, graph, command) {
  if (graph.destroyed()) return false;
  if (command.action === 'fit') { graph.fit(undefined, 24); return true; }
  if (!['zoom', 'in', 'out', 'set', 'reset'].includes(command.action)) return false;
  const scale = command.action === 'reset' ? 1 : command.zoom ?? graph.zoom() * (command.factor || 1);
  if (!Number.isFinite(scale) || scale <= 0) return false;
  const rect = container.getBoundingClientRect();
  const renderedPosition = { x: Number.isFinite(command.clientX) ? command.clientX - rect.left : rect.width / 2,
    y: Number.isFinite(command.clientY) ? command.clientY - rect.top : rect.height / 2 };
  graph.zoom({ level: Math.min(graph.maxZoom(), Math.max(graph.minZoom(), scale)), renderedPosition });
  return true;
}
