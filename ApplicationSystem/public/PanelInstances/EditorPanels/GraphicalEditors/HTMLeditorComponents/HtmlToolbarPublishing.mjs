// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlToolbarPublishing.mjs
// This module suppresses equivalent HTML selection patches against the current toolbar state while allowing changed values and externally replaced state to reach the existing toolbar publisher.
export function createHtmlToolbarPublisher(publish, readState) {
  return patch => {
    const current = readState() || {};
    if (Object.keys(patch).every(key => Object.is(current[key], patch[key]))) return false;
    publish(patch);
    return true;
  };
}
