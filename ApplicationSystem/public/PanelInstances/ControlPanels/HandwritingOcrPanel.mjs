// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/HandwritingOcrPanel.mjs
// ControlPanel wrapper for the handwriting OCR text input panel.

import { mountHandwritingOcrPanel } from "/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs";

export async function setupPanel(panel, panelVars = {}) {
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.minHeight = "0";
  panel.style.overflow = "hidden";

  const api = mountHandwritingOcrPanel(panel, panelVars);
  panel.cleanup = async () => {
    await api?.dispose?.();
  };
}
