// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.mjs
// This module registers graph annotation detail as a view capability over the existing Cytoscape instance. It suppresses only annotation paint, preserving label metrics, selection, graph data, layout, and the existing geometric viewport implementation.
import { registerPanelZoomCapabilities, setPanelZoomMode } from '../../../panels/panelZoomCapabilities.mjs';

import { graphGeometricZoom } from './GraphGeometricZoom.mjs';

const marker = 'nv-semantic-structure';
const selector = `edge.${marker}`;
export const graphSemanticLevels = [
  { value: 'structure', label: 'Structure' },
  { value: 'annotations', label: 'Annotations' }
];

export function installGraphSemanticZoom(container, graph) {
  container.__nvGraphSemanticZoom?.();
  let level = 'annotations', disposed = false, applyingLevel = false;
  // Opacity leaves label text and its bounding metrics intact, unlike label: ''.
  graph.style().selector(selector).style({ 'text-opacity': 0 }).update();
  const updateEdge = edge => {
    const suppress = level === 'structure' && !edge.selected() && !edge.hasClass('nv-selected-link') && !edge.hasClass('nv-broken-link-edge');
    if (edge.hasClass(marker) !== suppress) edge.toggleClass(marker, suppress);
  };
  const onEdge = event => { if (!applyingLevel) updateEdge(event.target); };
  graph.on('add select unselect class', 'edge', onEdge);
  // Ctrl/Meta gestures belong to the workspace router, including refused inactive input.
  // Cytoscape may continue owning ordinary wheel camera navigation.
  const reserveModifiedWheel = event => {
    if ((event.ctrlKey || event.metaKey) && event.composedPath().includes(container)) event.stopImmediatePropagation();
  };
  // The surface precedes Cytoscape's own capture listeners on its canvas container.
  const gestureHost = container.closest('[data-graph-manager-surface]') || container.parentElement || container;
  gestureHost.addEventListener('wheel', reserveModifiedWheel, true);
  const unregister = registerPanelZoomCapabilities(container, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset', 'fit'], unit: 'camera scale' }, semantic: { actions: ['zoom', 'set', 'reset'], levels: graphSemanticLevels } },
    getState(mode) {
      return mode === 'semantic' ? { level } : { zoom: graph.zoom(), panX: graph.pan().x, panY: graph.pan().y };
    },
    geometric: command => graphGeometricZoom(container, graph, command),
    fisheye: false,
    semantic(command) {
      if (disposed) return false;
      let next;
      if (command.action === 'reset') next = 'annotations';
      else if (command.action === 'set') next = command.level;
      else if (['zoom', 'in', 'out'].includes(command.action) && Number.isFinite(command.factor) && command.factor > 0) {
        next = command.factor === 1 ? level : command.factor > 1 ? 'annotations' : 'structure';
      } else return false;
      if (!graphSemanticLevels.some(item => item.value === next)) return false;
      if (next === level) return true;
      level = next;
      // Collection operations batch Cytoscape's style work; avoid one nested update per edge.
      applyingLevel = true;
      try {
        graph.batch(() => {
          const edges = graph.edges();
          edges.toggleClass(marker, level === 'structure');
          if (level === 'structure') edges.filter(':selected, .nv-selected-link, .nv-broken-link-edge').removeClass(marker);
        });
      } finally { applyingLevel = false; }
      return true;
    }
  });
  setPanelZoomMode(container, 'geometric');
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unregister();
    gestureHost.removeEventListener('wheel', reserveModifiedWheel, true);
    graph.off('add select unselect class', 'edge', onEdge);
    graph.off('destroy', dispose);
    if (!graph.destroyed()) {
      graph.edges().removeClass(marker);
      // Remove only our rule, retaining later user stylesheet changes and bypasses.
      graph.style().fromJson(graph.style().json().filter(rule => rule.selector !== selector)).update();
    }
    if (container.__nvGraphSemanticZoom === dispose) delete container.__nvGraphSemanticZoom;
  };
  graph.on('destroy', dispose);
  container.__nvGraphSemanticZoom = dispose;
  return dispose;
}
