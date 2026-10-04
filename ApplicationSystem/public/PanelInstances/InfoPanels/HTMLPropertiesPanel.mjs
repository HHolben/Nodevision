// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs
// This module mounts the bounded HTML Properties prototype within the standard panel and tab lifecycle.
import { mountHtmlProperties } from '../Common/HtmlProperties/PropertiesController.mjs';
export const createPanel = host => setupPanel(host);
export function setupPanel(host) {
  let controller = mountHtmlProperties(host);
  host.__nvHtmlProperties = controller;
  const stop = () => { controller?.dispose(); controller = null; host.__nvHtmlProperties = null; };
  host.cleanup = stop;
  return { deactivate: stop, activate() { if (!controller) { controller = mountHtmlProperties(host); host.__nvHtmlProperties = controller; } }, destroy: stop };
}
