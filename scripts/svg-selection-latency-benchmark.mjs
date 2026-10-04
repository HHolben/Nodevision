// Nodevision/scripts/svg-selection-latency-benchmark.mjs
// This benchmark measures selection-marker reconciliation with instrumented objects, excluding browser DOM, geometry, painting, and Layers panel rendering.
import { performance } from 'node:perf_hooks';
import { createSvgSelectionMarkers } from '../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.mjs';
// Reference implementation extracted unchanged from the pre-change runtime.
function baselineMarkers(getElements) {
  const legacy = 'drop-shadow(0 0 2px #ff2f2f)';
  return { update(selected) {
    getElements().forEach(element => {
      if (!selected.includes(element)) {
        element.removeAttribute('data-selected');
        if (element.style.filter === legacy) element.style.filter = '';
      }
    });
    selected.forEach(element => {
      element.setAttribute('data-selected', 'true');
      if (element.style.filter === legacy) element.style.filter = '';
    });
  } };
}
const baseline = process.argv.includes('--baseline');
const createMarkers = baseline ? baselineMarkers : createSvgSelectionMarkers;
const reports = [];
for (const count of [100, 1000, 5000]) {
  const runs = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    let scans = 0, writes = 0, reads = 0;
    const elements = Array.from({ length: count }, () => {
      const attrs = new Map();
      return { style: { filter: '' }, getAttribute(name) { reads++; return attrs.get(name) ?? null; },
        hasAttribute(name) { reads++; return attrs.has(name); },
        setAttribute(name, value) { writes++; attrs.set(name, value); },
        removeAttribute(name) { writes++; attrs.delete(name); } };
    });
    const markers = createMarkers(() => { scans++; return elements; });
    markers.update([elements[0]]);
    scans = writes = reads = 0;
    const times = [];
    for (let i = 1; i <= 100; i++) {
      const start = performance.now();
      markers.update([elements[i % count]]);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    runs.push({ p50: times[50], p95: times[95], max: times[99], scans, writes, reads });
  }
  reports.push({ objects: count, runs });
}
console.log(JSON.stringify({ baseline, node: process.version, platform: process.platform, measurements: 'milliseconds; marker reconciliation only; 3 runs, 100 selections after initial reconciliation', reports }, null, 2));
