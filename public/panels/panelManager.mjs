// Nodevision/public/panels/panelManager.mjs
// This file uses other modules to handle panel creation and manipulation.

import { ensureWorkspace, ensureTopRow, createCell } from "./workspace.mjs";
import { createPanelDOM } from "./panelFactory.mjs";
import { attachControlEvents } from "./panelControls.mjs";
import { attachDragEvents } from "./panelDrag.mjs";
import { attachResizeEvents } from "./panelResize.mjs";

let panelCounter = 0;

export function createPanel(templateName = "Panel", panelType = "GenericPanel", panelVars = {}) {
  const workspace = ensureWorkspace();
  const topRow = ensureTopRow(workspace);
  const cell = createCell(topRow);

  const instanceId = `panel-${panelCounter++}`;
  const result = createPanelDOM(templateName, instanceId, panelType, panelVars);

  if (!result || !result.panel) {
    console.error("createPanelDOM() did not return a valid DOM node:", result);
    return null;
  }

  const { panel, header, dockBtn, maxBtn, closeBtn, resizer } = result;

  cell.appendChild(panel);

  attachControlEvents(panel, dockBtn, maxBtn, closeBtn);
  attachDragEvents(panel, header);
  attachResizeEvents(panel, resizer);

  return panel;
}
