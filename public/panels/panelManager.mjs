// Nodevision/public/panels/panelManager.mjs
// This file uses other modules to handle panel creation and manipulation.

import { ensureWorkspace, ensureTopRow, createCell } from "./workspace.mjs";
import { createPanelDOM, loadPanelDefinitions } from "./panelFactory.mjs";
import { attachControlEvents } from "./panelControls.mjs";
import { attachDragEvents } from "./panelDrag.mjs";
import { attachResizeEvents } from "./panelResize.mjs";

let panelCounter = 0;
let panelDefinitions = null; // cache definitions after first load

export async function createPanel(templateName = "Panel") {
  if (!panelDefinitions) {
    try {
      panelDefinitions = await loadPanelDefinitions();
    } catch (err) {
      console.error("Failed to load panel definitions:", err);
      return;
    }
  }

  const workspace = ensureWorkspace();
  const topRow = ensureTopRow(workspace);
  const cell = createCell(topRow);

  const instanceId = `panel-${panelCounter++}`;
  const { panel, header, dockBtn, maxBtn, closeBtn, resizer } =
    createPanelDOM(templateName, instanceId, panelDefinitions);

  if (!(panel instanceof Node)) {
    console.error("createPanelDOM() did not return a valid DOM node:", panel);
    return;
  }

  cell.appendChild(panel);

  // Wire up behavior
  attachControlEvents(panel, dockBtn, maxBtn, closeBtn);
  attachDragEvents(panel, header);
  attachResizeEvents(panel, resizer);

  return panel;
}
