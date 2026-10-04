// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/HtmlLayerInvalidation.mjs
// This module keeps an HTML Layers membership cache independent of editor history and distinguishes topology changes from row-label or visibility changes while preserving ordinary DOM observation as the invalidation source.
export function createHtmlLayerInvalidation() {
  let cached = null;
  const hasElements = nodes => Array.from(nodes || []).some(node => node.nodeType === 1);
  return {
    read(collect) { return cached ||= collect(); },
    mutations(records) {
      let rowsChanged = false;
      for (const record of records) {
        if (record.type === 'attributes') {
          rowsChanged = true;
          if (['id', 'data-nv-layer-ignore'].includes(record.attributeName)) cached = null;
        } else if (record.type === 'childList' && (hasElements(record.addedNodes) || hasElements(record.removedNodes))) {
          cached = null; rowsChanged = true;
        }
      }
      return rowsChanged;
    },
    clear() { cached = null; },
  };
}
