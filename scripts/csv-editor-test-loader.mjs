// Nodevision/scripts/csv-editor-test-loader.mjs
// This Node test loader replaces browser presentation services while exercising the real CSV editor controller and model without a browser or network server.
const stubs = {
  '/EditorAttentionState.mjs': 'export function setEditorContext() {} export function setSelectionContext() {} export function clearEditorContext() {}',
  '/panels/createToolbar.mjs': 'export function updateToolbarState(patch) { globalThis.csvTest.toolbarUpdates++; Object.assign(window.NodevisionState, patch); }',
  '/ToolbarCallbacks/insert/tableTools.mjs': 'export function setActiveTableCell() {}',
  './CSVGridView.mjs': 'export function createCsvGridView() { return globalThis.csvTest.view; }',
  './CSVRangeInteraction.mjs': 'export function bindCsvRangeInteraction() { return {selectionChanged(){}, invalidate(){}, dispose(){}}; }',
};
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(stubs, specifier)) {
    return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  }
  return next(specifier, context);
}
