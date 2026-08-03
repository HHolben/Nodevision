// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonDeleteSelectedPanel.mjs
// This toolbar callback deletes the selected cartoon frame from the current editable document.

import { deleteSelectedCartoonFrame } from "./cartoonTools.mjs";

export default function cartoonDeleteSelectedPanel() {
  deleteSelectedCartoonFrame();
}
